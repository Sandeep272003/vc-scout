export async function parseJSONFile(file: File) {
  const text = await file.text()
  try {
    const data = JSON.parse(text)
    if (!Array.isArray(data)) throw new Error('JSON must be an array of objects')
    return data
  } catch {
    throw new Error('Invalid JSON file')
  }
}

export async function parseCSVFile(file: File) {
  const text = await file.text()
  const lines = text.split(/\r?\n/).filter(Boolean)
  if (lines.length === 0) return []
  const headers = splitCSVLine(lines[0])
  const rows = lines.slice(1).map(line => {
    const values = splitCSVLine(line)
    const obj: any = {}
    headers.forEach((h, i) => obj[h.trim()] = (values[i] || '').trim())
    return obj
  })
  return rows
}

function splitCSVLine(line: string) {
  const re = /("([^"]*(?:""[^"]*)*)"|[^,]+|)(?:,|$)/g
  const out: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(line)) !== null) {
    if (m[1] === '') continue
    let v = m[1]
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1).replace(/""/g, '"')
    out.push(v)
  }
  return out
}

export function normalizeWebsite(url?: string) {
  if (!url) return ''
  try {
    const u = new URL(url.trim())
    let host = u.origin.toLowerCase()
    if (host.endsWith('/')) host = host.slice(0, -1)
    return host
  } catch {
    return url.trim().replace(/\/+$/, '').toLowerCase()
  }
}
