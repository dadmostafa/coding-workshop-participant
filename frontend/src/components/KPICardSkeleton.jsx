import { Card, CardContent, Skeleton } from '@mui/material'

export default function KPICardSkeleton() {
  return (
    <Card sx={{ bgcolor: '#1e2029', border: '1px solid #2a2d3e', height: '100%' }}>
      <CardContent
        sx={{
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 1.2,
          '&:last-child': { pb: 2 },
        }}
      >
        <Skeleton variant="rounded" width={34} height={34} sx={{ bgcolor: '#252736', borderRadius: 2 }} />
        <Skeleton variant="text" width="40%" height={40} sx={{ bgcolor: '#2a2d3e' }} />
        <Skeleton variant="text" width="65%" height={16} sx={{ bgcolor: '#252736' }} />
        <Skeleton variant="text" width="50%" height={12} sx={{ bgcolor: '#252736' }} />
      </CardContent>
    </Card>
  )
}
