import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Grid, Box, Typography, CircularProgress, Alert,
  Card, CardContent,
} from '@mui/material'
import {
  Groups, Person, EmojiEvents, LocationOff,
  WorkOff, TrendingUp, AccountTree,
} from '@mui/icons-material'
import { getStats } from '../services/api'
import { useAuth } from '../context/AuthContext'

const STAT_CARDS = [
  { key: 'total_teams',        label: 'Total Teams',          icon: Groups,       color: '#6BCB77', bg: 'rgba(107,203,119,0.12)' },
  { key: 'total_members',      label: 'Total Members',        icon: Person,       color: '#4ECDC4', bg: 'rgba(78,205,196,0.12)' },
  { key: 'total_achievements', label: 'Achievements',         icon: EmojiEvents,  color: '#FFD166', bg: 'rgba(255,209,102,0.12)' },
]

const INSIGHT_CARDS = [
  { key: 'leader_not_colocated', label: 'Leader not co-located',  icon: LocationOff, color: '#FF6B6B', bg: 'rgba(255,107,107,0.12)', subtitle: 'Leader ≠ team location' },
  { key: 'leader_non_direct',    label: 'Non-direct leader',      icon: WorkOff,     color: '#FF9F43', bg: 'rgba(255,159,67,0.12)',  subtitle: 'Team leader is non-direct' },
  { key: 'high_nondirect_ratio', label: 'High non-direct ratio',  icon: TrendingUp,  color: '#A29BFE', bg: 'rgba(162,155,254,0.12)', subtitle: '>20% non-direct staff' },
  { key: 'has_org_leader',       label: 'Under org leader',       icon: AccountTree, color: '#74B9FF', bg: 'rgba(116,185,255,0.12)', subtitle: 'Reporting to org leader' },
]

function StatCard({ label, value, icon: Icon, color, bg, subtitle, onClick }) {
  return (
    <Card
      onClick={onClick}
      sx={{
        bgcolor: '#1e2029', border: '1px solid #2a2d3e', height: '100%',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s',
        '&:hover': onClick ? { border: `1px solid ${color}60`, transform: 'translateY(-2px)' } : {},
      }}
    >
      <CardContent sx={{ p: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="caption" sx={{ color: '#8b8fa8', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
              {label}
            </Typography>
            <Typography variant="h4" fontWeight={700} sx={{ color, mt: 0.5, lineHeight: 1 }}>
              {value ?? '—'}
            </Typography>
            {subtitle && (
              <Typography variant="caption" sx={{ color: '#8b8fa8', mt: 0.5, display: 'block' }}>
                {subtitle}
              </Typography>
            )}
          </Box>
          <Box sx={{ p: 1.2, borderRadius: 2, bgcolor: bg }}>
            <Icon sx={{ fontSize: 24, color }} />
          </Box>
        </Box>
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()
  const navigate  = useNavigate()
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
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
      <CircularProgress sx={{ color: '#6BCB77' }} />
    </Box>
  )

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" fontWeight={700} color="text.primary">
          Good morning, {user?.full_name?.split(' ')[0] || user?.username} 👋
        </Typography>
        <Typography variant="body2" color="text.secondary" mt={0.5}>
          Here's what's happening across your organization
        </Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {/* Main stats */}
      <Grid container spacing={2} mb={4}>
        {STAT_CARDS.map(card => (
          <Grid item xs={12} sm={4} key={card.key}>
            <StatCard
              label={card.label}
              value={stats?.[card.key]}
              icon={card.icon}
              color={card.color}
              bg={card.bg}
              onClick={() => {
                if (card.key === 'total_teams') navigate('/teams')
                if (card.key === 'total_members') navigate('/members')
                if (card.key === 'total_achievements') navigate('/achievements')
              }}
            />
          </Grid>
        ))}
      </Grid>

      {/* Section header */}
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Typography variant="body2" fontWeight={700} sx={{ color: '#8b8fa8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Organizational insights
        </Typography>
        <Box sx={{ flexGrow: 1, height: '1px', bgcolor: '#2a2d3e' }} />
      </Box>

      {/* Insight cards */}
      <Grid container spacing={2}>
        {INSIGHT_CARDS.map(card => (
          <Grid item xs={12} sm={6} md={3} key={card.key}>
            <StatCard
              label={card.label}
              value={stats?.[card.key]}
              icon={card.icon}
              color={card.color}
              bg={card.bg}
              subtitle={card.subtitle}
            />
          </Grid>
        ))}
      </Grid>
    </Box>
  )
}
