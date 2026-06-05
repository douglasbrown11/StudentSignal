'use client';

import { useEffect, useState } from 'react';

type WorkOrdersResponse =
  | {
      success: true;
      count: number;
      workOrders: unknown[];
    }
  | {
      success: false;
      error: string;
    };

export default function Home() {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [payload, setPayload] = useState<WorkOrdersResponse | null>(null);

  async function loadWorkOrders() {
    setStatus('loading');

    try {
      const response = await fetch('/api/work-orders?limit=5', {
        cache: 'no-store',
      });
      const data = (await response.json()) as WorkOrdersResponse;

      if (!response.ok || !data.success) {
        throw new Error(
          data.success ? `Request failed with status ${response.status}` : data.error,
        );
      }

      setPayload(data);
      setStatus('ready');
    } catch (error) {
      setPayload({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      setStatus('error');
    }
  }

  useEffect(() => {
    void loadWorkOrders();
  }, []);

  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">CriticalAsset starter</p>
        <h1 className="title">StudentSignal</h1>
        <p className="subtitle">
          This app is wired so the browser only calls your Next.js backend, and the backend
          handles OAuth2 client credentials before it talks to CriticalAsset.
        </p>
        <div className="pill-row">
          <span className="pill">
            Backend auth: <strong>enabled</strong>
          </span>
          <span className="pill">
            Work order route: <strong>/api/work-orders</strong>
          </span>
          <span className={`pill ${status === 'error' ? 'status error' : 'status ok'}`}>
            Status: <strong>{status}</strong>
          </span>
        </div>
      </section>

      <section className="grid">
        <div className="card stack">
          <div>
            <h2>How the auth layer works</h2>
            <p>
              The client ID and secret live in `.env.local`. The route handler requests a token,
              caches it on the server, and uses the token to fetch live work orders.
            </p>
          </div>

          <ul className="step-list">
            <li className="step">
              <strong>1. Browser hits Next.js</strong>
              <span>Frontend calls your own API route, not CriticalAsset directly.</span>
            </li>
            <li className="step">
              <strong>2. Backend gets a token</strong>
              <span>Server exchanges `CA_CLIENT_ID` and `CA_CLIENT_SECRET` for an access token.</span>
            </li>
            <li className="step">
              <strong>3. Backend fetches work orders</strong>
              <span>Token is attached to the GraphQL request, then the JSON comes back to the UI.</span>
            </li>
          </ul>

          <div className="toolbar">
            <button className="button" onClick={() => void loadWorkOrders()} disabled={status === 'loading'}>
              {status === 'loading' ? 'Loading...' : 'Refresh work orders'}
            </button>
            <span className="status">
              Test endpoint: <code>/api/work-orders?limit=5</code>
            </span>
          </div>
        </div>

        <div className="card">
          <h3>Live response</h3>
          <p>
            This panel shows the backend response. If the auth is working and CriticalAsset is
            reachable, you’ll see real work order data here.
          </p>
          <pre className="json">{JSON.stringify(payload, null, 2)}</pre>
          <div className="footer-note">
            If this returns an error, check that your CriticalAsset credentials are valid and the
            account has the required scopes.
          </div>
        </div>
      </section>
    </main>
  );
}
