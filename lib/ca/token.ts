// Server-side access-token manager for the CriticalAsset GraphQL API.
// Holds the client secret, mints a token via the client-credentials mutation,
// caches it in memory, and refreshes shortly before expiry. The browser never
// imports this module.

const SCOPE = "assets.read locations.read workorders.read workorders.write";
const SKEW_MS = 60_000; // refresh this long before the real expiry

interface CachedToken {
  token: string;
  expMs: number;
}

let cached: CachedToken | null = null;
let inFlight: Promise<string> | null = null;

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

const MINT_MUTATION = `
  mutation Mint($input: ApplicationClientCredentialsInput!) {
    applicationClientCredentialsToken(input: $input) {
      accessToken
      tokenType
      expiresIn
    }
  }`;

async function mint(): Promise<CachedToken> {
  const apiUrl = env("CA_API_URL");
  const res = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: MINT_MUTATION,
      variables: {
        input: {
          clientId: env("CA_CLIENT_ID"),
          clientSecret: env("CA_CLIENT_SECRET"),
          scope: SCOPE,
        },
      },
    }),
  });

  const json = await res.json().catch(() => null);
  const payload = json?.data?.applicationClientCredentialsToken;
  if (!payload?.accessToken) {
    const msg = json?.errors?.[0]?.message ?? `HTTP ${res.status}`;
    throw new Error(`Failed to mint CriticalAsset token: ${msg}`);
  }

  const expiresInMs = (Number(payload.expiresIn) || 3600) * 1000;
  return { token: payload.accessToken, expMs: Date.now() + expiresInMs };
}

/**
 * Returns a valid access token, minting or refreshing as needed.
 * Concurrent callers share a single in-flight mint.
 */
export async function getToken(force = false): Promise<string> {
  const now = Date.now();
  if (!force && cached && now < cached.expMs - SKEW_MS) {
    return cached.token;
  }
  if (inFlight) return inFlight;

  inFlight = mint()
    .then((t) => {
      cached = t;
      return t.token;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

/** Test/debug helper — clears the cached token. */
export function _resetTokenCache(): void {
  cached = null;
  inFlight = null;
}
