const DEFAULT_GRAPHQL_URL = 'https://company-dev.criticalasset.com/api';
const DEFAULT_SCOPES = ['workorders.read', 'assets.read', 'locations.read'].join(' ');
const TOKEN_REFRESH_SKEW_MS = 60_000;

type TokenResponse = {
  accessToken: string;
  refreshToken?: string;
  tokenType?: string;
  expiresIn?: number;
  scope?: string;
};

type ApplicationTokenResponse = {
  applicationClientCredentialsToken: TokenResponse;
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
  description: string | null;
  severity: string | null;
  executionPriority: string | null;
  workOrderStage: {
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
  const graphqlUrl = process.env.CA_GRAPHQL_URL ?? DEFAULT_GRAPHQL_URL;
  const scope = process.env.CA_SCOPES ?? DEFAULT_SCOPES;

  const response = await fetch(graphqlUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      query: /* GraphQL */ `
        mutation ApplicationToken($input: ApplicationClientCredentialsInput!) {
          applicationClientCredentialsToken(input: $input) {
            accessToken
            refreshToken
            tokenType
            expiresIn
            scope
          }
        }
      `,
      variables: {
        input: {
          clientId,
          clientSecret,
          scope,
        },
      },
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`CriticalAsset token request failed (${response.status}): ${details}`);
  }

  const payload = (await response.json()) as GraphQLResponse<ApplicationTokenResponse>;
  if (payload.errors?.length) {
    throw new Error(payload.errors.map((error) => error.message).join('; '));
  }

  const token = payload.data?.applicationClientCredentialsToken;
  if (!token?.accessToken) {
    throw new Error('CriticalAsset token response did not include an access token.');
  }

  const expiresInSeconds = Number(token.expiresIn ?? 3600);
  return {
    accessToken: token.accessToken,
    expiresAt: Date.now() + expiresInSeconds * 1000,
  };
}

export async function getCriticalAssetAccessToken(): Promise<string> {
  const currentToken = cachedToken;
  const tokenStillValid =
    currentToken !== null && currentToken.expiresAt - TOKEN_REFRESH_SKEW_MS > Date.now();

  if (tokenStillValid) {
    return currentToken.accessToken;
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
  const graphqlUrl = process.env.CA_GRAPHQL_URL ?? DEFAULT_GRAPHQL_URL;

  const response = await fetch(graphqlUrl, {
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
      totalCount
      nodes {
        id
        title
        description
        severity
        executionPriority
        workOrderStage {
          name
        }
      }
    }
  }
`;

type WorkOrdersResponse = {
  workOrders: {
    totalCount: number;
    nodes: CriticalAssetWorkOrder[];
  };
};

export async function fetchWorkOrders(limit = 25): Promise<CriticalAssetWorkOrder[]> {
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(100, Math.trunc(limit))) : 25;
  const data = await criticalAssetGraphQL<WorkOrdersResponse>(FETCH_WORK_ORDERS_QUERY, {
    limit: safeLimit,
  });

  return data.workOrders.nodes ?? [];
}
