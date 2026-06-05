# StudentSignal

Next.js starter for the CriticalAsset hackathon dashboard.

## What is wired up

- Server-side OAuth2 client credentials flow
- Token caching on the backend
- `GET /api/work-orders` proxy route
- A homepage that tests the proxy route from the browser

## Setup

1. Install dependencies:

```bash
npm install
```

2. Start the dev server:

```bash
npm run dev
```

3. Open the app and check the live response panel.

## Environment

Secrets live in `.env.local` and are ignored by git.

Required variables:

- `CA_CLIENT_ID`
- `CA_CLIENT_SECRET`

## API route

- `GET /api/work-orders?limit=5`

This route calls CriticalAsset from the server, so the browser never sees the secret.
