'use client';

export function RequestErrorPanel({
  message,
  requestId,
  onRetry,
}: {
  message: string;
  requestId?: string | undefined;
  onRetry: () => void;
}) {
  return (
    <div
      className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
      role="alert"
    >
      <p>{message}</p>
      {requestId && (
        <p className="mt-1 text-xs">Request reference: {requestId}</p>
      )}
      <button
        className="mt-3 rounded border border-red-300 px-3 py-1.5 font-medium"
        onClick={onRetry}
      >
        Retry
      </button>
    </div>
  );
}
