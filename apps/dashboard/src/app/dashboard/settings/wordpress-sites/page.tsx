'use client';

import { FormEvent, useEffect, useState } from 'react';
import { dashboardApi, type WordPressConnection } from '@/lib/api-client';
import { PageHeading } from '@/components/page-heading';

export default function WordPressSitesPage() {
  const [sites, setSites] = useState<WordPressConnection[]>([]);
  const [method, setMethod] = useState<'connector' | 'application_password'>(
    'connector',
  );
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = () =>
    dashboardApi
      .connections()
      .then(setSites)
      .catch((e: unknown) =>
        setError(
          e instanceof Error ? e.message : 'Could not load WordPress sites.',
        ),
      );
  useEffect(() => {
    setShowForm(new URLSearchParams(location.search).has('connect'));
    void load();
  }, []);
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed.');
    } finally {
      setBusy(false);
    }
  };
  const connect = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void run(async () => {
      const credentials =
        method === 'connector'
          ? { connector_token: String(data.get('connector_token')) }
          : {
              username: String(data.get('username')),
              application_password: String(data.get('application_password')),
            };
      await dashboardApi.createConnection(undefined, {
        name: String(data.get('name')),
        site_url: String(data.get('site_url')),
        authentication_type: method,
        ...credentials,
      });
      setShowForm(false);
      await load();
    });
  };
  return (
    <div className="space-y-6">
      <PageHeading
        title="WordPress Sites"
        description="Manage reusable WordPress connections for every project in your organization."
      />
      <div className="flex justify-end">
        <button
          className="bg-primary text-primary-foreground rounded-lg px-4 py-2"
          onClick={() => setShowForm(!showForm)}
        >
          Connect WordPress site
        </button>
      </div>
      {error && (
        <p role="alert" className="rounded bg-red-50 p-3 text-red-700">
          {error}
        </p>
      )}
      {showForm && (
        <form onSubmit={connect} className="card grid gap-3 p-6 sm:grid-cols-2">
          <input
            className="field"
            name="name"
            placeholder="Site name"
            required
          />
          <input
            className="field"
            name="site_url"
            type="url"
            placeholder="https://example.com"
            required
          />
          <select
            className="field sm:col-span-2"
            value={method}
            onChange={(e) => setMethod(e.target.value as typeof method)}
          >
            <option value="connector">Connector token (recommended)</option>
            <option value="application_password">Application password</option>
          </select>
          {method === 'connector' ? (
            <input
              className="field sm:col-span-2"
              name="connector_token"
              type="password"
              placeholder="Connector token"
              required
            />
          ) : (
            <>
              <input
                className="field"
                name="username"
                placeholder="WordPress username"
                required
              />
              <input
                className="field"
                name="application_password"
                type="password"
                placeholder="Application password"
                required
              />
            </>
          )}
          <p className="text-muted-foreground text-xs sm:col-span-2">
            Secrets are encrypted and are never returned by the API.
          </p>
          <button
            disabled={busy}
            className="bg-primary text-primary-foreground rounded-lg p-3 sm:col-span-2"
          >
            Save connection
          </button>
        </form>
      )}
      <div className="grid gap-4">
        {sites.map((site) => (
          <article className="card p-5" key={site.id}>
            <div className="flex flex-wrap justify-between gap-4">
              <div>
                <h2 className="font-semibold">{site.name}</h2>
                <p className="text-muted-foreground text-sm">
                  {site.siteUrl} · {site.authenticationType.replace('_', ' ')} ·{' '}
                  <span className="capitalize">{site.status}</span>
                </p>
                <p className="mt-2 text-sm">
                  WordPress {site.wordpressVersion ?? '—'} · Elementor{' '}
                  {site.elementorVersion ?? '—'} · Connector{' '}
                  {site.connectorVersion ?? '—'}
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  Last tested{' '}
                  {site.lastVerifiedAt
                    ? new Date(site.lastVerifiedAt).toLocaleString()
                    : 'never'}{' '}
                  · Last deployment{' '}
                  {site.deploymentsMaxCompletedAt
                    ? new Date(site.deploymentsMaxCompletedAt).toLocaleString()
                    : 'never'}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  disabled={busy}
                  className="rounded border px-3 py-2 text-sm"
                  onClick={() =>
                    void run(async () => {
                      await dashboardApi.verifyConnection(site.id);
                      await load();
                    })
                  }
                >
                  Test
                </button>
                <button
                  disabled={busy}
                  className="rounded border px-3 py-2 text-sm"
                  onClick={() => setShowForm(true)}
                >
                  Reconnect
                </button>
                <button
                  disabled={busy}
                  className="rounded border px-3 py-2 text-sm text-red-700"
                  onClick={() =>
                    void run(async () => {
                      await dashboardApi.deleteConnection(site.id);
                      await load();
                    })
                  }
                >
                  Delete
                </button>
              </div>
            </div>
          </article>
        ))}
        {!sites.length && !showForm && (
          <div className="card text-muted-foreground p-8 text-center text-sm">
            No WordPress sites connected.
          </div>
        )}
      </div>
    </div>
  );
}
