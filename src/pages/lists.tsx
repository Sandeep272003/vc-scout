import { useEffect, useState } from 'react'
import companies from '../data/companies.json'
import {
  loadLists,
  createList,
  deleteList,
  addCompanyToList,
  removeCompanyFromList,
  exportListAsCSV,
  exportListAsJSON,
  ListItem
} from '../lib/lists'
import { parseCSVFile, parseJSONFile, normalizeWebsite } from '../lib/imports'
import '../styles/globals.css'
import Link from 'next/link'

export default function ListsPage() {
  const [lists, setLists] = useState<ListItem[]>([])
  const [newListName, setNewListName] = useState('')
  const [selectedListId, setSelectedListId] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [report, setReport] = useState<any>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => setLists(loadLists()), [])

  function refresh() { setLists(loadLists()) }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  function handleCreate() {
    if (!newListName.trim()) return showToast('Enter a name')
    createList(newListName.trim())
    setNewListName('')
    refresh()
    showToast('List created')
  }

  function handleDelete(id: string) {
    if (!confirm('Delete list?')) return
    deleteList(id)
    refresh()
    showToast('List deleted')
  }

  function handleExportCSV(id: string) {
    const url = exportListAsCSV(id, companies)
    if (!url) return showToast('List empty')
    const a = document.createElement('a')
    a.href = url
    a.download = `list_${id}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleExportJSON(id: string) {
    const url = exportListAsJSON(id, companies)
    if (!url) return showToast('List empty')
    const a = document.createElement('a')
    a.href = url
    a.download = `list_${id}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFile(e.target.files?.[0] || null)
  }

  async function handleImport() {
    if (!file) return showToast('Choose file')
    if (!selectedListId) return showToast('Select list')
    let rows: any[] = []
    try {
      if (file.name.toLowerCase().endsWith('.json')) rows = await parseJSONFile(file)
      else rows = await parseCSVFile(file)
    } catch (err:any) {
      return showToast(err.message || 'Parse failed')
    }

    const matched: string[] = []
    const duplicates: string[] = []
    const unmatched: any[] = []

    for (const r of rows) {
      const id = (r.id || '').toString().trim()
      const website = normalizeWebsite(r.website || r.url || r.site)
      let match = null
      if (id) match = companies.find((c:any) => c.id === id)
      if (!match && website) match = companies.find((c:any) => normalizeWebsite(c.website) === website)
      if (match) {
        const listNow = loadLists().find(l => l.id === selectedListId)
        if (listNow && listNow.companyIds.includes(match.id)) duplicates.push(match.id)
        else { addCompanyToList(selectedListId, match.id); matched.push(match.id) }
      } else unmatched.push(r)
    }

    setReport({ matched, duplicates, unmatched, totalRows: rows.length })
    refresh()
    showToast(`Imported: ${matched.length} added`)
  }

  return (
    <div className="container page-advanced">
      <div className="toolbar">
        <div className="search-wrap">
          <h2>Your Lists</h2>
        </div>

        <div className="actions">
          <input className="input-sm" placeholder="New list name" value={newListName} onChange={e => setNewListName(e.target.value)} />
          <button className="btn primary" onClick={handleCreate}>Create</button>
        </div>
      </div>

      <div className="lists-grid">
        {lists.length === 0 && <div className="muted">No lists yet</div>}
        {lists.map(l => (
          <div key={l.id} className="list-card pro">
            <div className="list-header">
              <div>
                <div className="list-title">{l.name}</div>
                <div className="muted">{l.companyIds.length} companies</div>
              </div>
              <div className="list-actions">
                <button className="btn small" onClick={() => handleExportCSV(l.id)}>Export CSV</button>
                <button className="btn small" onClick={() => handleExportJSON(l.id)}>Export JSON</button>
                <button className="btn small" onClick={() => handleDelete(l.id)}>Delete</button>
              </div>
            </div>

            <div className="list-body">
              {l.companyIds.length === 0 && <div className="muted">Empty</div>}
              {l.companyIds.map(cid => {
                const c = companies.find(x => x.id === cid)
                return c ? (
                  <div key={cid} className="list-row">
                    <div>
                      <Link href={`/companies/${c.id}`} className="link">{c.name}</Link>
                      <div className="muted small">{c.industry} • {c.location}</div>
                    </div>
                    <div>
                      <button className="btn tiny" onClick={() => { removeCompanyFromList(l.id, c.id); refresh(); }}>Remove</button>
                    </div>
                  </div>
                ) : null
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="import-panel">
        <h3>Import into selected list</h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select value={selectedListId} onChange={e => setSelectedListId(e.target.value)}>
            <option value="">Select list</option>
            {lists.map(l => <option key={l.id} value={l.id}>{l.name} ({l.companyIds.length})</option>)}
          </select>
          <input type="file" accept=".csv,.json" onChange={handleFileChange} />
          <button className="btn" onClick={handleImport}>Import</button>
        </div>

        {report && (
          <div className="import-report">
            <div>Total rows: {report.totalRows}</div>
            <div>Added: {report.matched.length}</div>
            <div>Duplicates: {report.duplicates.length}</div>
            <div>Unmatched: {report.unmatched.length}</div>
          </div>
        )}
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
