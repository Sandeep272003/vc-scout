import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import companies from '../../data/companies.json'
import {
  loadLists,
  createList,
  addCompanyToList,
  removeCompanyFromList,
  exportListAsCSV,
  exportListAsJSON,
  ListItem
} from '../../lib/lists'
import { parseCSVFile, parseJSONFile, normalizeWebsite } from '../../lib/imports'


export default function CompaniesPage() {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 8

  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({})
  const [lists, setLists] = useState<ListItem[]>([])
  const [selectedListId, setSelectedListId] = useState('')
  const [newListName, setNewListName] = useState('')
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importReport, setImportReport] = useState<any>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => setLists(loadLists()), [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return companies
    return companies.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.short_desc || '').toLowerCase().includes(q) ||
      (c.tags || []).join(' ').toLowerCase().includes(q)
    )
  }, [query])

  const total = filtered.length
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  function toggleSelect(id: string) {
    setSelectedIds(s => ({ ...s, [id]: !s[id] }))
  }

  function selectAllOnPage() {
    const next = { ...selectedIds }
    pageItems.forEach(p => next[p.id] = true)
    setSelectedIds(next)
  }

  function clearSelection() {
    setSelectedIds({})
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

  function handleAddSelectedToList() {
    if (!selectedListId) return showToast('Choose a list first')
    const ids = Object.keys(selectedIds).filter(k => selectedIds[k])
    if (ids.length === 0) return showToast('No companies selected')
    ids.forEach(id => {
      try { addCompanyToList(selectedListId, id) } catch {}
    })
    refreshLists()
    showToast(`Added ${ids.length} companies`)
  }

  function handleRemoveSelectedFromList() {
    if (!selectedListId) return showToast('Choose a list first')
    const ids = Object.keys(selectedIds).filter(k => selectedIds[k])
    if (ids.length === 0) return showToast('No companies selected')
    ids.forEach(id => {
      try { removeCompanyFromList(selectedListId, id) } catch {}
    })
    refreshLists()
    showToast(`Removed ${ids.length} companies`)
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setImportReport(null)
    const f = e.target.files?.[0] || null
    setImportFile(f)
  }

  async function handleImport() {
    if (!importFile) return showToast('Choose a CSV or JSON file first')
    if (!selectedListId) return showToast('Select a list to import into')
    let rows: any[] = []
    try {
      if (importFile.name.toLowerCase().endsWith('.json')) rows = await parseJSONFile(importFile)
      else rows = await parseCSVFile(importFile)
    } catch (err:any) {
      return showToast(err.message || 'Failed to parse file')
    }

    const matched: string[] = []
    const unmatched: any[] = []
    const duplicates: string[] = []

    for (const r of rows) {
      const id = (r.id || '').toString().trim()
      const website = normalizeWebsite(r.website || r.url || r.site)
      let match = null
      if (id) match = companies.find((c:any) => c.id === id)
      if (!match && website) match = companies.find((c:any) => normalizeWebsite(c.website) === website)
      if (match) {
        const listsNow = loadLists()
        const list = listsNow.find(l => l.id === selectedListId)
        if (list && list.companyIds.includes(match.id)) duplicates.push(match.id)
        else {
          try { addCompanyToList(selectedListId, match.id); matched.push(match.id) } catch { unmatched.push(r) }
        }
      } else {
        unmatched.push(r)
      }
    }

    setImportReport({ matched, duplicates, unmatched, totalRows: rows.length })
    refreshLists()
    showToast(`Import: ${matched.length} added, ${duplicates.length} duplicates, ${unmatched.length} unmatched`)
  }

  function downloadUnmatched() {
    if (!importReport || !importReport.unmatched || importReport.unmatched.length === 0) return showToast('No unmatched rows')
    const blob = new Blob([JSON.stringify(importReport.unmatched, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'unmatched.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="container page-advanced">
      <div className="toolbar">
        <div className="search-wrap">
          <input className="search" placeholder="Search companies, tags, descriptions..." value={query} onChange={e => { setQuery(e.target.value); setPage(1) }} />
          <div className="meta">{total} results</div>
        </div>

        <div className="actions">
          <select className="select-list" value={selectedListId} onChange={e => setSelectedListId(e.target.value)}>
            <option value="">Select list</option>
            {lists.map(l => <option key={l.id} value={l.id}>{l.name} ({l.companyIds.length})</option>)}
          </select>

          <input className="input-sm" placeholder="New list name" value={newListName} onChange={e => setNewListName(e.target.value)} />
          <button className="btn primary" onClick={handleCreateList}>Create list</button>

          <button className="btn" onClick={selectAllOnPage}>Select page</button>
          <button className="btn" onClick={clearSelection}>Clear</button>

          <button className="btn success" onClick={handleAddSelectedToList}>Add selected</button>
          <button className="btn warn" onClick={handleRemoveSelectedFromList}>Remove selected</button>

          <input id="file" type="file" accept=".csv,.json" onChange={handleFileChange} style={{ display: 'none' }} />
          <label htmlFor="file" className="btn">Choose file</label>
          <button className="btn" onClick={handleImport}>Import into list</button>
          <button className="btn" onClick={downloadUnmatched}>Download unmatched</button>
        </div>
      </div>

      <div className="grid cards">
        {pageItems.map(c => (
          <div key={c.id} className="card pro">
            <div className="card-left">
              <label className="checkbox">
                <input type="checkbox" checked={!!selectedIds[c.id]} onChange={() => toggleSelect(c.id)} />
                <span />
              </label>
              <div className="card-info">
                <h3 className="card-title">{c.name}</h3>
                <div className="card-desc">{c.short_desc}</div>
                <div className="card-meta">{c.stage} • {c.industry} • {c.location}</div>
                <div className="tags">{(c.tags || []).map((t:string) => <span key={t} className="tag">{t}</span>)}</div>
              </div>
            </div>

            <div className="card-right">
              <Link href={`/companies/${c.id}`} className="btn small dark">Open</Link>
              <a className="btn small" href={c.website} target="_blank" rel="noreferrer">Website</a>
            </div>
          </div>
        ))}
      </div>

      <div className="pager">
        <button className="btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Prev</button>
        <div className="page-indicator">{page} / {pages}</div>
        <button className="btn" onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}>Next</button>
      </div>

      {importReport && (
        <div className="import-report">
          <div><strong>Import report</strong></div>
          <div>Total rows: {importReport.totalRows}</div>
          <div>Added: {importReport.matched.length}</div>
          <div>Duplicates: {importReport.duplicates.length}</div>
          <div>Unmatched: {importReport.unmatched.length}</div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
