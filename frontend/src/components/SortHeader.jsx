import { Box, TableCell, Typography } from '@mui/material'
import { ArrowUpward, ArrowDownward, UnfoldMore } from '@mui/icons-material'

/**
 * SortHeader — a TableCell that shows sort direction and handles clicks
 */
export default function SortHeader({ label, field, sortField, sortDir, onSort, sx = {}, ...props }) {
  const isActive = sortField === field
  return (
    <TableCell
      onClick={() => onSort(field)}
      sx={{
        cursor: 'pointer',
        userSelect: 'none',
        '&:hover': { color: '#6BCB77' },
        color: isActive ? '#6BCB77' : 'inherit',
        transition: 'color 0.15s ease',
        ...sx,
      }}
      {...props}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Typography variant="inherit" noWrap>{label}</Typography>
        {isActive ? (
          sortDir === 'asc'
            ? <ArrowUpward   sx={{ fontSize: 13, color: '#6BCB77' }} />
            : <ArrowDownward sx={{ fontSize: 13, color: '#6BCB77' }} />
        ) : (
          <UnfoldMore sx={{ fontSize: 13, color: '#2a2d3e' }} />
        )}
      </Box>
    </TableCell>
  )
}
