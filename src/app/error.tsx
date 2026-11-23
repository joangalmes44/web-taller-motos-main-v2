'use client';
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  return (
    <div style={{ padding: 32, fontFamily: 'monospace', background: '#111', color: '#ff5555', minHeight: '100vh' }}>
      <h1>Error real detectat:</h1>
      <pre style={{ whiteSpace: 'pre-wrap' }}>{error?.message}</pre>
      <pre style={{ whiteSpace: 'pre-wrap', color: '#aaa', fontSize: 12 }}>{error?.stack}</pre>
    </div>
  );
}
