import { Box, Grid, Card, CardContent, Skeleton } from '@mui/material'
import KPICardSkeleton from './KPICardSkeleton'
import { ProjectRowSkeleton } from './ProjectCardSkeleton'

export default function DashboardSkeleton() {
  return (
    <Box>
      <Skeleton variant="rounded" width={580} height={48} sx={{ bgcolor: '#1e2029', borderRadius: 3, mb: 4 }} />

      <Box sx={{ mb: 3 }}>
        <Skeleton variant="text" width={280} height={32} sx={{ bgcolor: '#2a2d3e', mb: 0.5 }} />
        <Skeleton variant="text" width={180} height={16} sx={{ bgcolor: '#252736' }} />
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Grid item xs={6} sm={4} md={2} key={i}>
            <KPICardSkeleton />
          </Grid>
        ))}
      </Grid>

      <Card sx={{ bgcolor: '#1e2029', border: '1px solid #2a2d3e', mb: 3 }}>
        <CardContent sx={{ p: 2.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
            <Skeleton variant="text" width={140} height={20} sx={{ bgcolor: '#2a2d3e' }} />
            <Skeleton variant="text" width={120} height={16} sx={{ bgcolor: '#252736' }} />
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            {['Spent', 'Utilization', 'Total Budget'].map((_, i) => (
              <Box key={i}>
                <Skeleton variant="text" width={60} height={14} sx={{ bgcolor: '#252736', mb: 0.3 }} />
                <Skeleton variant="text" width={80} height={28} sx={{ bgcolor: '#2a2d3e' }} />
              </Box>
            ))}
          </Box>
          <Skeleton variant="rounded" width="100%" height={6} sx={{ bgcolor: '#252736', borderRadius: 3 }} />
        </CardContent>
      </Card>

      <Grid container spacing={3}>
        <Grid item xs={12} md={7}>
          <Card sx={{ bgcolor: '#1e2029', border: '1px solid #2a2d3e' }}>
            <CardContent sx={{ p: 0 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2.5, py: 2, borderBottom: '1px solid #2a2d3e' }}>
                <Skeleton variant="text" width={120} height={20} sx={{ bgcolor: '#2a2d3e' }} />
                <Skeleton variant="rounded" width={80} height={28} sx={{ bgcolor: '#252736', borderRadius: 2 }} />
              </Box>
              {Array.from({ length: 6 }).map((_, i) => (
                <ProjectRowSkeleton key={i} />
              ))}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={5}>
          <Card sx={{ bgcolor: '#1e2029', border: '1px solid #2a2d3e', mb: 2 }}>
            <CardContent sx={{ p: 0 }}>
              <Box sx={{ px: 2.5, py: 2, borderBottom: '1px solid #2a2d3e' }}>
                <Skeleton variant="text" width={80} height={20} sx={{ bgcolor: '#2a2d3e' }} />
              </Box>
              <Box sx={{ p: 1.5 }}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 1, py: 0.8 }}>
                    <Skeleton variant="circular" width={7} height={7} sx={{ bgcolor: '#2a2d3e' }} />
                    <Skeleton variant="text" width="60%" height={16} sx={{ bgcolor: '#2a2d3e', flex: 1 }} />
                    <Skeleton variant="rounded" width={28} height={20} sx={{ bgcolor: '#252736', borderRadius: 10 }} />
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>

          <Card sx={{ bgcolor: '#1e2029', border: '1px solid #2a2d3e' }}>
            <CardContent sx={{ p: 0 }}>
              <Box sx={{ px: 2.5, py: 2, borderBottom: '1px solid #2a2d3e' }}>
                <Skeleton variant="text" width={100} height={20} sx={{ bgcolor: '#2a2d3e' }} />
              </Box>
              <Box sx={{ p: 1.5 }}>
                {Array.from({ length: 3 }).map((_, i) => (
                  <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 1, py: 0.8 }}>
                    <Skeleton variant="rounded" width={30} height={30} sx={{ bgcolor: '#252736', borderRadius: 1.5 }} />
                    <Skeleton variant="text" width="50%" height={16} sx={{ bgcolor: '#2a2d3e', flex: 1 }} />
                    <Skeleton variant="text" width={28} height={20} sx={{ bgcolor: '#2a2d3e' }} />
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  )
}
