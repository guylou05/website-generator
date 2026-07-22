'use client';
import { useEffect, useState } from 'react';
import { dashboardApi, type MediaAsset } from '../../../lib/api-client';

export default function MediaLibraryPage() {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [message, setMessage] = useState('Loading media…');
  useEffect(() => {
    const query = new URLSearchParams();
    if (search) query.set('search', search);
    if (status) query.set('status', status);
    const timer = setTimeout(
      () =>
        dashboardApi
          .listMedia(query.toString())
          .then((x) => {
            setAssets(x.data);
            setMessage(x.data.length ? '' : 'No media matches these filters.');
          })
          .catch(() => setMessage('Media could not be loaded.')),
      250,
    );
    return () => clearTimeout(timer);
  }, [search, status]);
  async function upload(file: File) {
    setMessage(`Uploading ${file.name}…`);
    const pending = await dashboardApi.initiateUpload({
      filename: file.name,
      mime_type: file.type,
      size_bytes: file.size,
    });
    await fetch(pending.upload.url, {
      method: 'PUT',
      headers: pending.upload.headers,
      body: file,
    });
    const asset = await dashboardApi.completeUpload(pending.asset.id);
    setAssets((x) => [asset, ...x]);
    setMessage(`${file.name} is queued for secure processing.`);
  }
  return (
    <main className="space-y-6 p-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-violet-600">
            Asset workspace
          </p>
          <h1 className="text-3xl font-bold">Media library</h1>
          <p className="text-slate-600">
            Upload, generate, organize, and safely reuse revision-pinned images.
          </p>
        </div>
        <label className="cursor-pointer rounded-lg bg-violet-600 px-4 py-2 font-semibold text-white focus-within:ring-2">
          <span>Upload images</span>
          <input
            className="sr-only"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            multiple
            onChange={(e) => [...(e.target.files ?? [])].forEach(upload)}
          />
        </label>
      </header>
      <section className="grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-[1fr_14rem]">
        <label className="text-sm font-medium">
          Search media
          <input
            className="mt-1 w-full rounded-md border p-2"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, alt text, or description"
          />
        </label>
        <label className="text-sm font-medium">
          Status
          <select
            className="mt-1 w-full rounded-md border p-2"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All statuses</option>
            <option>ready</option>
            <option>processing</option>
            <option>failed</option>
          </select>
        </label>
      </section>
      <p aria-live="polite" className="text-sm text-slate-600">
        {message}
      </p>
      <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        {assets.map((a) => (
          <li key={a.id}>
            <button
              className="w-full overflow-hidden rounded-xl border bg-white text-left shadow-sm focus:ring-2 focus:ring-violet-600"
              aria-label={`${a.display_name}, ${a.status}`}
            >
              <div className="aspect-square bg-slate-100">
                {a.url ? (
                  <img
                    src={a.url}
                    alt={a.alt_text ?? ''}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-slate-500">
                    {a.status}
                  </div>
                )}
              </div>
              <div className="space-y-1 p-3">
                <p className="truncate font-semibold">{a.display_name}</p>
                <p className="text-xs text-slate-500">
                  {a.width && a.height
                    ? `${a.width} × ${a.height}`
                    : 'Awaiting dimensions'}{' '}
                  · {(a.size_bytes / 1048576).toFixed(1)} MB
                </p>
                <p className="text-xs">
                  {a.source_type} · {a.usage_count ?? 0} uses
                </p>
                {!a.alt_text && (
                  <p className="text-xs text-amber-700">Missing alt text</p>
                )}
              </div>
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
