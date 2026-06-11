import { useState, useMemo } from 'react'

/**
 * usePagination — reusable pagination for any array
 *
 * Usage:
 *   const { page, pageSize, totalPages, paginated, setPage, setPageSize } = usePagination(data, 20)
 */
export function usePagination(data = [], defaultPageSize = 20) {
  const [page,     setPage]     = useState(1)
  const [pageSize, setPageSize] = useState(defaultPageSize)

  // Reset to page 1 when data changes (e.g. after filter)
  const totalPages = Math.max(1, Math.ceil(data.length / pageSize))
  const safePage   = Math.min(page, totalPages)

  const paginated = useMemo(() => {
    const start = (safePage - 1) * pageSize
    return data.slice(start, start + pageSize)
  }, [data, safePage, pageSize])

  const goToPage = (p) => setPage(Math.max(1, Math.min(p, totalPages)))

  return {
    page:       safePage,
    pageSize,
    totalPages,
    total:      data.length,
    paginated,
    setPage:    goToPage,
    setPageSize: (size) => { setPageSize(size); setPage(1) },
    hasNext:    safePage < totalPages,
    hasPrev:    safePage > 1,
    start:      data.length === 0 ? 0 : (safePage - 1) * pageSize + 1,
    end:        Math.min(safePage * pageSize, data.length),
  }
}
