// Thin GraphQL client for the CriticalAsset API. Adds the bearer token,
// retries once on 401 (re-mint) and once on 429 (backoff), and maps upstream
// error shapes to typed errors the API routes can translate to HTTP statuses.

import { getToken } from "./token";

export class CAError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "CAError";
    this.status = status;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function post(query: string, variables: unknown, token: string): Promise<Response> {
  const apiUrl = process.env.CA_API_URL;
  if (!apiUrl) throw new CAError("Missing CA_API_URL", 500);
  return fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });
}

export async function caQuery<T = any>(
  query: string,
  variables: Record<string, unknown> = {},
): Promise<T> {
  let token = await getToken();
  let res = await post(query, variables, token);

  // 401 -> token likely expired; re-mint once and retry.
  if (res.status === 401) {
    token = await getToken(true);
    res = await post(query, variables, token);
  }

  // 429 -> back off once and retry.
  if (res.status === 429) {
    const retryAfter = Number(res.headers.get("retry-after")) || 1;
    await sleep(Math.min(retryAfter, 5) * 1000);
    res = await post(query, variables, token);
    if (res.status === 429) throw new CAError("Rate limited by upstream API", 429);
  }

  const json = await res.json().catch(() => null);

  if (json?.errors?.length) {
    const messages: string[] = json.errors.map((e: any) => e.message);
    const joined = messages.join("; ");
    if (/scope/i.test(joined)) throw new CAError(`Missing required scope: ${joined}`, 403);
    throw new CAError(`Upstream GraphQL error: ${joined}`, 502);
  }

  if (!res.ok) throw new CAError(`Upstream HTTP ${res.status}`, 502);
  if (!json?.data) throw new CAError("Upstream returned no data", 502);

  return json.data as T;
}
