import { Box, Typography, IconButton, Select, MenuItem } from '@mui/material'
import { ChevronLeft, ChevronRight, FirstPage, LastPage } from '@mui/icons-material'

export default function Pagination({
  page, pageSize, totalPages, total, start, end,
  setPage, setPageSize, hasNext, hasPrev,
  pageSizeOptions = [10, 20, 50],
}) {
  if (total === 0) return null

  return (
    <Box sx={{
      display: 'flex', alignItems: 'center',
      justifyContent: 'space-between',
      px: 2, py: 1.5,
      borderTop: '1px solid #2a2d3e',
      flexWrap: 'wrap', gap: 1,
    }}>
      {/* Left — count */}
      <Typography variant="caption" color="text.secondary">
        Showing <b style={{ color: '#e8eaf0' }}>{start}–{end}</b> of{' '}
        <b style={{ color: '#e8eaf0' }}>{total}</b>
      </Typography>

      {/* Center — page controls */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <IconButton size="small" onClick={() => setPage(1)} disabled={!hasPrev}
          sx={{ color: hasPrev ? '#8b8fa8' : '#2a2d3e',
            '&:hover': { color: '#6BCB77' } }}>
          <FirstPage sx={{ fontSize: 16 }} />
        </IconButton>
        <IconButton size="small" onClick={() => setPage(page - 1)} disabled={!hasPrev}
          sx={{ color: hasPrev ? '#8b8fa8' : '#2a2d3e',
            '&:hover': { color: '#6BCB77' } }}>
          <ChevronLeft sx={{ fontSize: 16 }} />
        </IconButton>

        {/* Page numbers */}
        <Box sx={{ display: 'flex', gap: 0.4 }}>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
            .reduce((acc, p, idx, arr) => {
              if (idx > 0 && p - arr[idx - 1] > 1) {
                acc.push('...')
              }
              acc.push(p)
              return acc
            }, [])
            .map((p, i) =>
              p === '...' ? (
                <Typography key={`ellipsis-${i}`} variant="caption"
                  sx={{ color: '#8b8fa8', px: 0.5, lineHeight: '28px' }}>
                  …
                </Typography>
              ) : (
                <Box key={p} onClick={() => setPage(p)} sx={{
                  width: 28, height: 28, borderRadius: 1.5,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer',
                  bgcolor: p === page ? '#6BCB77' : 'transparent',
                  color:   p === page ? '#13141a' : '#8b8fa8',
                  fontWeight: p === page ? 700 : 400,
                  fontSize: '0.78rem',
                  border: p === page ? 'none' : '1px solid #2a2d3e',
                  transition: 'all 0.15s ease',
                  '&:hover': {
                    bgcolor: p === page ? '#6BCB77' : '#252736',
                    color:   p === page ? '#13141a' : '#fff',
                  },
                }}>
                  {p}
                </Box>
              )
            )
          }
        </Box>

        <IconButton size="small" onClick={() => setPage(page + 1)} disabled={!hasNext}
          sx={{ color: hasNext ? '#8b8fa8' : '#2a2d3e',
            '&:hover': { color: '#6BCB77' } }}>
          <ChevronRight sx={{ fontSize: 16 }} />
        </IconButton>
        <IconButton size="small" onClick={() => setPage(totalPages)} disabled={!hasNext}
          sx={{ color: hasNext ? '#8b8fa8' : '#2a2d3e',
            '&:hover': { color: '#6BCB77' } }}>
          <LastPage sx={{ fontSize: 16 }} />
        </IconButton>
      </Box>

      {/* Right — page size */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="caption" color="text.secondary">Rows</Typography>
        <Select
          value={pageSize}
          onChange={e => setPageSize(Number(e.target.value))}
          size="small"
          sx={{
            height: 28, fontSize: '0.78rem',
            bgcolor: '#16171f', color: 'text.primary',
            '& .MuiOutlinedInput-notchedOutline': { borderColor: '#2a2d3e' },
            '& .MuiSelect-icon': { color: '#8b8fa8' },
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#6BCB77' },
          }}
        >
          {pageSizeOptions.map(s => (
            <MenuItem key={s} value={s} sx={{ fontSize: '0.78rem' }}>{s}</MenuItem>
          ))}
        </Select>
      </Box>
    </Box>
  )
}
