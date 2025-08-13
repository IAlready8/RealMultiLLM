'use client';

import * as Sentry from '@sentry/nextjs';

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  // Report to Sentry
  Sentry.captureException(error);

  return (
    <html>
      <body style={{ padding: 24, fontFamily: 'system-ui' }}>
        <h1>Something went wrong</h1>
        <p>{process.env.NODE_ENV === 'development' ? String(error?.message ?? 'Error') : 'Please try again.'}</p>
      </body>
    </html>
  );
}