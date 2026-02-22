export async function enrich({ url, companyId }: { url: string; companyId: string }) {
  const resp = await fetch('/api/enrich', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, companyId })
  })
  const text = await resp.text()
  let body: any
  try { body = JSON.parse(text) } catch { body = { error: text } }
  if (!resp.ok) {
    throw new Error(body?.error || `Enrich failed: ${resp.status} ${text}`)
  }
  return body
}
