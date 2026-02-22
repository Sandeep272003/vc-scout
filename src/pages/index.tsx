// src/pages/index.tsx
import { useEffect } from 'react'
import { useRouter } from 'next/router'
import companies from '../data/companies.json' // <- fixed path

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    // If you want to redirect to the companies list
    router.replace('/companies')
  }, [router])

  return (
    <div style={{ padding: 24, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <h2 style={{ marginTop: 0 }}>VC Scout</h2>
      <p>Redirecting to <strong>/companies</strong>… (seed has {companies.length} companies)</p>
    </div>
  )
}
