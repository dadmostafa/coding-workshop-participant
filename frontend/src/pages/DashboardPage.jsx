import { useState, useEffect } from 'react'
import {
  Grid, Card, CardContent, Typography, Box,
  CircularProgress, Alert, Divider,
} from '@mui/material'
import {
  Groups, Person, EmojiEvents, LocationOff,
  WorkOff, TrendingUp, AccountTree,
} from '@mui/icons-material'
import { getStats } from '../services/api'

function StatCard({ icon, label, value, color = 'primary.main', subtitle }) {
  return (
    <Card elevation={2} sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
          <Box sx={{
            p: 1.5, borderRadius: 2, bgcolor: `${color}15`,
            display: 'flex', alignItems: 'center',
          }}>
            <Box sx={{ color, '& svg': { fontSize: 28 } }}>{icon}</Box>
          </Box>
          <Box>
            <Typography variant="h4" fontWeight={700}>{value ?? '–'}</Typography>
            <Typography variant="body2" color="text.secondary" fontWeight={500}>{label}</Typography>
            {subtitle && (
              <Typography variant="caption" color="text.disabled">{subtitle}</Typography>
            )}
          </Box>
        </Box>
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const [stats,   setStats]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  useEffect(() => {
    getStats()
      .then(setStats)
      .catch(() => setError('Could not load dashboard stats'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
      <CircularProgress />
    </Box>
  )

  if (error) return <Alert severity="error">{error}</Alert>

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={3}>Dashboard</Typography>

      <Typography variant="subtitle2" color="text.secondary" mb={2}>Overview</Typography>
      <Grid container spacing={2} mb={4}>
        <Grid item xs={12} sm={6} md={4}>
          <StatCard icon={<Groups />} label="Total Teams" value={stats.total_teams} color="#1565C0" />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <StatCard icon={<Person />} label="Total Members" value={stats.total_members} color="#2E7D32" />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <StatCard icon={<EmojiEvents />} label="Achievements" value={stats.total_achievements} color="#F57C00" />
        </Grid>
      </Grid>

      <Divider sx={{ mb: 3 }} />
      <Typography variant="subtitle2" color="text.secondary" mb={2}>Organizational Insights</Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            icon={<LocationOff />}
            label="Leader not co-located"
            value={stats.leader_not_colocated}
            color="#C62828"
            subtitle="Teams where leader ≠ team location"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            icon={<WorkOff />}
            label="Leader is non-direct"
            value={stats.leader_non_direct}
            color="#AD1457"
            subtitle="Teams with non-direct team leader"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            icon={<TrendingUp />}
            label="High non-direct ratio"
            value={stats.high_nondirect_ratio}
            color="#6A1B9A"
            subtitle="Teams with >20% non-direct staff"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            icon={<AccountTree />}
            label="Under org leader"
            value={stats.has_org_leader}
            color="#00695C"
            subtitle="Teams reporting to an org leader"
          />
        </Grid>
      </Grid>
    </Box>
  )
}
