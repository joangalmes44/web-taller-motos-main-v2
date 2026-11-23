'use client';
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  return (
    <html>
      <body style={{ padding: 32, fontFamily: 'monospace', background: '#111', color: '#ff5555' }}>
        <h1>Error global detectat:</h1>
        <pre style={{ whiteSpace: 'pre-wrap' }}>{error?.message}</pre>
        <pre style={{ whiteSpace: 'pre-wrap', color: '#aaa', fontSize: 12 }}>{error?.stack}</pre>
      </body>
    </html>
  );
}
