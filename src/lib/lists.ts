export type ListItem = { id: string; name: string; companyIds: string[] }

const KEY = 'vc:lists'

export function loadLists(): ListItem[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveLists(lists: ListItem[]) {
  localStorage.setItem(KEY, JSON.stringify(lists))
}

export function createList(name: string) {
  const lists = loadLists()
  const id = `list_${Date.now()}`
  const l: ListItem = { id, name, companyIds: [] }
  lists.push(l)
  saveLists(lists)
  return l
}

export function addCompanyToList(listId: string, companyId: string) {
  const lists = loadLists()
  const l = lists.find(x => x.id === listId)
  if (!l) throw new Error('List not found')
  if (!l.companyIds.includes(companyId)) l.companyIds.push(companyId)
  saveLists(lists)
}

export function removeCompanyFromList(listId: string, companyId: string) {
  const lists = loadLists()
  const l = lists.find(x => x.id === listId)
  if (!l) throw new Error('List not found')
  l.companyIds = l.companyIds.filter(id => id !== companyId)
  saveLists(lists)
}

export function deleteList(listId: string) {
  const lists = loadLists().filter(l => l.id !== listId)
  saveLists(lists)
}

export function exportListAsCSV(listId: string, companies: any[]) {
  const lists = loadLists()
  const l = lists.find(x => x.id === listId)
  if (!l) throw new Error('List not found')
  const rows = companies.filter(c => l.companyIds.includes(c.id)).map(c => ({
    id: c.id,
    name: c.name,
    website: c.website,
    stage: c.stage,
    industry: c.industry,
    location: c.location,
    tags: (c.tags || []).join('|'),
    short_desc: c.short_desc || ''
  }))
  if (rows.length === 0) return null
  const header = Object.keys(rows[0])
  const csv = [header.join(',')].concat(
    rows.map(r =>
      header.map(h => `"${String((r as any)[h] || '').replace(/"/g, '""')}"`).join(',')
    )
  ).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  return URL.createObjectURL(blob)
}

export function exportListAsJSON(listId: string, companies: any[]) {
  const lists = loadLists()
  const l = lists.find(x => x.id === listId)
  if (!l) throw new Error('List not found')
  const data = companies.filter(c => l.companyIds.includes(c.id))
  if (data.length === 0) return null
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  return URL.createObjectURL(blob)
}
