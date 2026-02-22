// src/pages/_app.tsx
import '../styles/globals.css'
import type { AppProps } from 'next/app'
import Head from 'next/head'

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <title>{process.env.NEXT_PUBLIC_APP_TITLE || 'VC Scout'}</title>
        <meta name="viewport" content="width=device-width,initial-scale=1" />
      </Head>
      <div style={{ fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial', padding: 16 }}>
        <header style={{ marginBottom: 16 }}>
          <h1 style={{ margin: 0 }}>{process.env.NEXT_PUBLIC_APP_TITLE || 'VC Scout'}</h1>
        </header>
        <main>
          <Component {...pageProps} />
        </main>
      </div>
    </>
  )
}
