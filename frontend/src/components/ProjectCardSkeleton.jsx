import { Box, Card, CardContent, Skeleton } from '@mui/material'

export function ProjectRowSkeleton() {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 2, py: 1.5, borderBottom: '1px solid #2a2d3e' }}>
      <Skeleton variant="circular" width={8} height={8} sx={{ bgcolor: '#2a2d3e', flexShrink: 0 }} />
      <Box sx={{ flex: 1 }}>
        <Skeleton variant="text" width="45%" height={16} sx={{ bgcolor: '#2a2d3e', mb: 0.4 }} />
        <Skeleton variant="text" width="30%" height={12} sx={{ bgcolor: '#252736' }} />
      </Box>
      <Skeleton variant="rounded" width={60} height={20} sx={{ bgcolor: '#2a2d3e', borderRadius: 10 }} />
      <Box sx={{ width: 80 }}>
        <Skeleton variant="rounded" width="100%" height={4} sx={{ bgcolor: '#2a2d3e', borderRadius: 2 }} />
      </Box>
      <Skeleton variant="text" width={28} height={16} sx={{ bgcolor: '#2a2d3e' }} />
    </Box>
  )
}

export function KanbanCardSkeleton() {
  return (
    <Card sx={{ bgcolor: '#1e2029', border: '1px solid #2a2d3e', borderRadius: 2.5, mb: 1.5 }}>
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
          <Skeleton variant="rounded" width={70} height={20} sx={{ bgcolor: '#252736', borderRadius: 10 }} />
          <Skeleton variant="text" width={12} height={16} sx={{ bgcolor: '#252736' }} />
        </Box>
        <Skeleton variant="text" width="85%" height={16} sx={{ bgcolor: '#2a2d3e', mb: 0.5 }} />
        <Skeleton variant="text" width="55%" height={12} sx={{ bgcolor: '#252736', mb: 1 }} />
        <Skeleton variant="rounded" width="100%" height={3} sx={{ bgcolor: '#252736', borderRadius: 2, mb: 1 }} />
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Skeleton variant="rounded" width={55} height={18} sx={{ bgcolor: '#252736', borderRadius: 10 }} />
          <Skeleton variant="rounded" width={55} height={18} sx={{ bgcolor: '#252736', borderRadius: 10 }} />
        </Box>
      </CardContent>
    </Card>
  )
}
