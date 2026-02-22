// src/pages/api/enrich.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import cheerio from 'cheerio'
import companies from '../../data/companies.json'

type EnrichResponse = {
  summary: string
  whatTheyDo: string[]
  keywords: string[]
  derivedSignals: string[]
  sources: { url: string; fetchedAt: string }[]
}

function isValidUrl(u: string) {
  try {
    const url = new URL(u)
    // block local/internal hosts
    if (['localhost', '127.0.0.1', '::1'].includes(url.hostname)) return false
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

const MAX_BYTES = 1_000_000 // 1MB
const FETCH_TIMEOUT = 12_000

async function fetchWithTimeout(url: string, timeoutMs = FETCH_TIMEOUT) {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const resp = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'vc-scout/1.0' } })
    clearTimeout(id)
    return resp
  } catch (err) {
    clearTimeout(id)
    throw err
  }
}

function extractKeywordsFromText(text: string, limit = 10) {
  const STOP = new Set(['the','and','for','with','that','this','from','are','was','were','have','has','had','you','your','our','we','not','but','they'])
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean)
  const freq: Record<string, number> = {}
  for (const w of words) {
    if (w.length < 3 || STOP.has(w)) continue
    freq[w] = (freq[w] || 0) + 1
  }
  return Object.entries(freq).sort((a,b)=>b[1]-a[1]).map(e=>e[0]).slice(0, limit)
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { url, companyId } = req.body || {}
  if (!url || !companyId || typeof url !== 'string' || typeof companyId !== 'string') {
    return res.status(400).json({ error: 'Missing url or companyId' })
  }
  if (!isValidUrl(url)) return res.status(400).json({ error: 'Invalid or disallowed URL' })

  try {
    // Attempt to fetch the target page
    const resp = await fetchWithTimeout(url)
    if (!resp.ok) {
      // Upstream non-2xx
      console.error(`[enrich] upstream fetch failed ${resp.status} ${url}`)
      // Fall through to fallback behavior below
      throw new Error(`Upstream fetch failed with status ${resp.status}`)
    }

    // Check content-length header
    const contentLength = resp.headers.get('content-length')
    if (contentLength && Number(contentLength) > MAX_BYTES) {
      console.warn(`[enrich] content-length too large: ${contentLength}`)
      return res.status(413).json({ error: 'Target page too large' })
    }

    // Stream read with size guard
    const reader = resp.body?.getReader()
    let html = ''
    if (reader) {
      let received = 0
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (value) {
          received += value.length
          if (received > MAX_BYTES) {
            console.warn('[enrich] stream exceeded max bytes')
            return res.status(413).json({ error: 'Target page too large (stream truncated)' })
          }
          html += new TextDecoder().decode(value, { stream: true })
        }
      }
    } else {
      html = await resp.text()
    }

    // Parse HTML with Cheerio
    const $ = cheerio.load(html)
    let summary = $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || ''
    if (!summary) {
      const firstP = $('p').filter((i, el) => $(el).text().trim().length > 40).first().text().trim()
      summary = firstP || $('title').text().slice(0, 300) || $('body').text().slice(0, 300)
    }

    const bullets: string[] = []
    $('h1,h2,h3').each((i, el) => {
      const txt = $(el).text().trim()
      if (txt && bullets.length < 6) bullets.push(txt)
    })
    if (bullets.length < 3) {
      $('p').each((i, el) => {
        const txt = $(el).text().trim()
        if (txt && txt.length > 40 && bullets.length < 6) bullets.push(txt.slice(0, 200))
      })
    }

    const bodyText = $('body').text().replace(/\s+/g, ' ').trim()
    const keywords = extractKeywordsFromText(bodyText, 10)

    const derivedSignals: string[] = []
    const bodyHtml = $.html()
    if (/careers|jobs|join.*team|open positions/i.test(bodyHtml)) derivedSignals.push('careers_page:true')
    if (/blog|news|updates|press/i.test(bodyHtml)) derivedSignals.push('recent_blog:true')
    if (/changelog|release|version/i.test(bodyHtml)) derivedSignals.push('changelog:true')
    if (/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+/i.test(bodyHtml)) derivedSignals.push('github_linked:true')
    if (derivedSignals.length === 0) derivedSignals.push('no_signals_detected')

    const out: EnrichResponse = {
      summary: String(summary).slice(0, 1000),
      whatTheyDo: bullets.length ? bullets.slice(0,6) : ['No clear bullets extracted'],
      keywords: Array.from(new Set(keywords)).slice(0,10),
      derivedSignals,
      sources: [{ url, fetchedAt: new Date().toISOString() }]
    }

    return res.status(200).json(out)
  } catch (err: any) {
    console.error('[enrich] error:', err?.message || err)

    // Fallback: return a safe, deterministic summary from seed data if available
    try {
      const seed = (companies as any[]).find(c => c.id === companyId)
      if (seed) {
        const fallback: EnrichResponse = {
          summary: `Fallback summary: ${seed.short_desc || seed.name}`,
          whatTheyDo: seed.signals?.map((s:any)=>s.text).slice(0,6) || ['No bullets'],
          keywords: (seed.tags || []).slice(0,10),
          derivedSignals: ['fallback_used'],
          sources: [{ url: seed.website || url, fetchedAt: new Date().toISOString() }]
        }
        return res.status(200).json(fallback)
      }
    } catch (e) {
      console.error('[enrich] fallback failed', e)
    }

    // If no fallback, return structured error for client to show
    if (err?.name === 'AbortError') return res.status(504).json({ error: 'Fetch timed out' })
    return res.status(500).json({ error: 'Internal server error', detail: String(err?.message || err) })
  }
}
