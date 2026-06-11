import { TableRow, TableCell, Skeleton, Box } from '@mui/material'

export default function TableSkeleton({ rows = 5, cols = 5 }) {
  return Array.from({ length: rows }).map((_, i) => (
    <TableRow key={i} sx={{ '& td': { borderColor: '#2a2d3e' } }}>
      {Array.from({ length: cols }).map((_, j) => (
        <TableCell key={j}>
          {j === 0 ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
              <Skeleton
                variant="circular"
                width={32}
                height={32}
                sx={{ bgcolor: '#2a2d3e', flexShrink: 0 }}
              />
              <Box sx={{ flex: 1 }}>
                <Skeleton
                  variant="text"
                  width="70%"
                  height={16}
                  sx={{ bgcolor: '#2a2d3e', mb: 0.5 }}
                />
                <Skeleton variant="text" width="50%" height={12} sx={{ bgcolor: '#252736' }} />
              </Box>
            </Box>
          ) : j === cols - 1 ? (
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
              <Skeleton variant="circular" width={24} height={24} sx={{ bgcolor: '#2a2d3e' }} />
              <Skeleton variant="circular" width={24} height={24} sx={{ bgcolor: '#2a2d3e' }} />
            </Box>
          ) : (
            i % 3 === 0 ? (
              <Skeleton
                variant="rounded"
                width={64}
                height={22}
                sx={{ bgcolor: '#2a2d3e', borderRadius: 10 }}
              />
            ) : (
              <Skeleton
                variant="text"
                width={`${50 + Math.random() * 30}%`}
                height={16}
                sx={{ bgcolor: '#2a2d3e' }}
              />
            )
          )}
        </TableCell>
      ))}
    </TableRow>
  ))
}
