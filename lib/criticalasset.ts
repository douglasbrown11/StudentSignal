const TOKEN_URL = 'https://api.criticalasset.com/oauth/token';
const GRAPHQL_URL = 'https://api.criticalasset.com/api';
const REQUESTED_SCOPES = ['workorders:read', 'assets:read', 'locations:read'].join(' ');
const TOKEN_REFRESH_SKEW_MS = 60_000;

type TokenResponse = {
  access_token: string;
  expires_in?: number;
  token_type?: string;
};

type TokenCache = {
  accessToken: string;
  expiresAt: number;
};

type GraphQLResponse<TData> = {
  data?: TData;
  errors?: Array<{ message: string }>;
};

export type CriticalAssetWorkOrder = {
  id: string;
  title: string;
  status: string;
  priority: string;
  createdAt: string;
  dueDate: string | null;
  asset: {
    id: string;
    name: string;
    category: string | null;
  } | null;
  location: {
    id: string;
    locationName: string;
    address: string | null;
  } | null;
  assignee: {
    id: string;
    name: string;
  } | null;
};

let cachedToken: TokenCache | null = null;
let tokenRequest: Promise<TokenCache> | null = null;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is missing. Add it to .env.local.`);
  }
  return value;
}

async function requestToken(): Promise<TokenCache> {
  const clientId = requireEnv('CA_CLIENT_ID');
  const clientSecret = requireEnv('CA_CLIENT_SECRET');

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    scope: REQUESTED_SCOPES,
  });

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body,
    cache: 'no-store',
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`CriticalAsset token request failed (${response.status}): ${details}`);
  }

  const payload = (await response.json()) as TokenResponse;
  if (!payload.access_token) {
    throw new Error('CriticalAsset token response did not include an access token.');
  }

  const expiresInSeconds = Number(payload.expires_in ?? 3600);
  return {
    accessToken: payload.access_token,
    expiresAt: Date.now() + expiresInSeconds * 1000,
  };
}

export async function getCriticalAssetAccessToken(): Promise<string> {
  const tokenStillValid =
    cachedToken && cachedToken.expiresAt - TOKEN_REFRESH_SKEW_MS > Date.now();

  if (tokenStillValid) {
    return cachedToken.accessToken;
  }

  if (!tokenRequest) {
    tokenRequest = requestToken()
      .then((token) => {
        cachedToken = token;
        return token;
      })
      .finally(() => {
        tokenRequest = null;
      });
  }

  const token = await tokenRequest;
  return token.accessToken;
}

export async function criticalAssetGraphQL<TData>(
  query: string,
  variables: Record<string, unknown> = {},
): Promise<TData> {
  const accessToken = await getCriticalAssetAccessToken();

  const response = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ query, variables }),
    cache: 'no-store',
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`CriticalAsset API request failed (${response.status}): ${details}`);
  }

  const payload = (await response.json()) as GraphQLResponse<TData>;
  if (payload.errors?.length) {
    throw new Error(payload.errors.map((error) => error.message).join('; '));
  }

  if (!payload.data) {
    throw new Error('CriticalAsset returned an empty GraphQL payload.');
  }

  return payload.data;
}

const FETCH_WORK_ORDERS_QUERY = /* GraphQL */ `
  query FetchWorkOrders($limit: Int!) {
    workOrders(limit: $limit) {
      id
      title
      status
      priority
      createdAt
      dueDate
      asset {
        id
        name
        category
      }
      location {
        id
        locationName
        address
      }
      assignee {
        id
        name
      }
    }
  }
`;

type WorkOrdersResponse = {
  workOrders: CriticalAssetWorkOrder[];
};

export async function fetchWorkOrders(limit = 25): Promise<CriticalAssetWorkOrder[]> {
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(100, Math.trunc(limit))) : 25;
  const data = await criticalAssetGraphQL<WorkOrdersResponse>(FETCH_WORK_ORDERS_QUERY, {
    limit: safeLimit,
  });

  return data.workOrders ?? [];
}
