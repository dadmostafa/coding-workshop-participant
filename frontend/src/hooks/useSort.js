import { useState, useMemo } from 'react'

/**
 * useSort — reusable column sorting for any array of objects
 * 
 * Usage:
 *   const { sorted, sortBy, sortField, sortDir } = useSort(data, 'name', 'asc')
 *   <SortHeader label="Name" field="name" sortField={sortField} sortDir={sortDir} onSort={sortBy} />
 */
export function useSort(data = [], defaultField = '', defaultDir = 'asc') {
  const [sortField, setSortField] = useState(defaultField)
  const [sortDir,   setSortDir]   = useState(defaultDir)

  const sortBy = (field) => {
    if (field === sortField) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  const sorted = useMemo(() => {
    if (!sortField || !data.length) return data
    return [...data].sort((a, b) => {
      let aVal = a[sortField] ?? ''
      let bVal = b[sortField] ?? ''

      // Numbers
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal
      }

      // Dates
      if (sortField.includes('date') || sortField.includes('_at')) {
        const aDate = aVal ? new Date(aVal).getTime() : 0
        const bDate = bVal ? new Date(bVal).getTime() : 0
        return sortDir === 'asc' ? aDate - bDate : bDate - aDate
      }

      // Strings
      aVal = String(aVal).toLowerCase()
      bVal = String(bVal).toLowerCase()
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDir === 'asc' ? 1  : -1
      return 0
    })
  }, [data, sortField, sortDir])

  return { sorted, sortBy, sortField, sortDir }
}
