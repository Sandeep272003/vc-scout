import { useRouter } from 'next/router'
import companies from '../../data/companies.json'
import { useEffect, useState } from 'react'
import { enrich } from '../../lib/enrichClient'
import {
  loadLists,
  createList,
  addCompanyToList,
  removeCompanyFromList,
  exportListAsCSV,
  exportListAsJSON,
  ListItem
} from '../../lib/lists'


export default function CompanyProfile() {
  const router = useRouter()
  const { id } = router.query
  const company = companies.find(c => c.id === id)

  const [enrichState, setEnrichState] = useState<'idle'|'loading'|'done'|'error'>('idle')
  const [enrichData, setEnrichData] = useState<any>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [lists, setLists] = useState<ListItem[]>([])
  const [selectedListId, setSelectedListId] = useState('')
  const [newListName, setNewListName] = useState('')
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => setLists(loadLists()), [])

  useEffect(() => {
    if (!company) return
    const cacheKey = `vc:enrichCache:${company.id}`
    const raw = localStorage.getItem(cacheKey)
    if (raw) {
      try {
        const parsed = JSON.parse(raw)
        setEnrichData(parsed.data)
        setEnrichState('done')
      } catch {}
    }
  }, [company])

  if (!company) return <div className="container">Company not found</div>

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  async function handleEnrich() {
    setEnrichState('loading')
    setErrorMsg('')
    try {
      const res = await enrich({ url: company.website, companyId: company.id })
      setEnrichData(res)
      setEnrichState('done')
      localStorage.setItem(`vc:enrichCache:${company.id}`, JSON.stringify({ enrichedAt: new Date().toISOString(), data: res }))
      showToast('Enrichment complete')
    } catch (err: any) {
      setErrorMsg(err?.message || 'Enrichment failed')
      setEnrichState('error')
      showToast('Enrichment failed')
    }
  }

  function refreshLists() {
    setLists(loadLists())
  }

  function handleCreateList() {
    if (!newListName.trim()) return showToast('Enter a list name')
    const l = createList(newListName.trim())
    setNewListName('')
    refreshLists()
    setSelectedListId(l.id)
    showToast(`List "${l.name}" created`)
  }

  function handleAddToList(listId: string) {
    try {
      addCompanyToList(listId, company.id)
      refreshLists()
      showToast('Added to list')
    } catch (e:any) {
      showToast(String(e.message || e))
    }
  }

  function handleRemoveFromList(listId: string) {
    try {
      removeCompanyFromList(listId, company.id)
      refreshLists()
      showToast('Removed from list')
    } catch (e:any) {
      showToast(String(e.message || e))
    }
  }

  function handleExportCSV(listId: string) {
    try {
      const url = exportListAsCSV(listId, companies)
      if (!url) { showToast('List is empty'); return }
      const a = document.createElement('a')
      a.href = url
      a.download = `list_${listId}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e:any) {
      showToast(String(e.message || e))
    }
  }

  function handleExportJSON(listId: string) {
    try {
      const url = exportListAsJSON(listId, companies)
      if (!url) { showToast('List is empty'); return }
      const a = document.createElement('a')
      a.href = url
      a.download = `list_${listId}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e:any) {
      showToast(String(e.message || e))
    }
  }

  return (
    <div className="container page-advanced">
      <div className="profile-header">
        <div>
          <h2>{company.name}</h2>
          <div className="muted">{company.short_desc}</div>
          <div className="meta">{company.stage} • {company.industry} • {company.location}</div>
        </div>

        <div className="profile-actions">
          <a className="btn" href={company.website} target="_blank" rel="noreferrer">Visit website</a>
          <button className="btn primary" onClick={handleEnrich} disabled={enrichState === 'loading'}>{enrichState === 'loading' ? 'Enriching…' : 'Enrich'}</button>
        </div>
      </div>

      <section className="signals">
        <h4>Signals</h4>
        <ul>
          {company.signals.map((s:any) => <li key={s.ts}><small className="muted">{s.ts}</small> — {s.text}</li>)}
        </ul>
      </section>

      <section className="lists-panel">
        <h4>Lists</h4>
        <div className="list-controls">
          <select value={selectedListId} onChange={e => setSelectedListId(e.target.value)}>
            <option value="">Select list</option>
            {lists.map(l => <option key={l.id} value={l.id}>{l.name} ({l.companyIds.length})</option>)}
          </select>
          <input className="input-sm" placeholder="New list name" value={newListName} onChange={e => setNewListName(e.target.value)} />
          <button className="btn" onClick={handleCreateList}>Create</button>
          <button className="btn success" onClick={() => selectedListId ? handleAddToList(selectedListId) : showToast('Select a list')}>Add to list</button>
          <button className="btn warn" onClick={() => selectedListId ? handleRemoveFromList(selectedListId) : showToast('Select a list')}>Remove from list</button>
        </div>

        <div className="lists-grid">
          {lists.length === 0 && <div className="muted">No lists yet</div>}
          {lists.map(l => (
            <div key={l.id} className="list-card">
              <div className="list-title">{l.name} <small className="muted">({l.companyIds.length})</small></div>
              <div className="list-actions">
                <button className="btn small" onClick={() => l.companyIds.includes(company.id) ? handleRemoveFromList(l.id) : handleAddToList(l.id)}>{l.companyIds.includes(company.id) ? 'Remove' : 'Add'}</button>
                <button className="btn small" onClick={() => handleExportCSV(l.id)}>Export CSV</button>
                <button className="btn small" onClick={() => handleExportJSON(l.id)}>Export JSON</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="enrichment">
        <h4>Enrichment</h4>
        {enrichState === 'idle' && <div className="muted">No enrichment yet. Click Enrich to fetch public page content.</div>}
        {enrichState === 'loading' && <div>Loading enrichment…</div>}
        {enrichState === 'error' && <div className="error">{errorMsg}</div>}
        {enrichState === 'done' && enrichData && (
          <div className="enrich-card">
            <h5>Summary</h5>
            <p>{enrichData.summary}</p>

            <h5>What they do</h5>
            <ul>{(enrichData.whatTheyDo || []).map((b:string,i:number)=><li key={i}>{b}</li>)}</ul>

            <h5>Keywords</h5>
            <div className="tags">{(enrichData.keywords || []).map((k:string)=><span key={k} className="tag">{k}</span>)}</div>

            <h5>Derived signals</h5>
            <ul>{(enrichData.derivedSignals || []).map((s:string,i:number)=><li key={i}>{s}</li>)}</ul>

            <h5>Sources</h5>
            <ul>{(enrichData.sources || []).map((s:any,i:number)=><li key={i}><a href={s.url} target="_blank" rel="noreferrer">{s.url}</a> — <small className="muted">{s.fetchedAt}</small></li>)}</ul>
          </div>
        )}
      </section>

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
