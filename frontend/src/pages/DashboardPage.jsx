import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import {
  Grid, Box, Typography, CircularProgress, Alert,
  Card, CardContent, Button, Chip, LinearProgress,
  Avatar, Tooltip, Divider, InputBase, Paper,
  ClickAwayListener, IconButton, List, ListItem, ListItemText,
} from '@mui/material'
import {
  Assignment, Warning, CheckCircle, Groups,
  AttachMoney, Person, EmojiEvents, ArrowForward,
  Add, Search, Close, TrendingUp, Error,
  PauseCircle, Schedule,
} from '@mui/icons-material'
import {
  getStats, getPipeline, getProjects, getResourceAllocation,
} from '../services/api'
import { useAuth }    from '../context/AuthContext'
import DueDateChip from '../components/DueDateChip'
import UtilizationBar from '../components/UtilizationBar'
import DashboardSkeleton from '../components/DashboardSkeleton'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'

const BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3001') + '/api/team-service'

const STATUS_CONFIG = {
  backlog:     { label: 'Backlog',     color: '#8b8fa8' },
  planning:    { label: 'Planning',    color: '#74B9FF' },
  in_progress: { label: 'In Progress', color: '#FFD166' },
  review:      { label: 'Review',      color: '#A29BFE' },
  completed:   { label: 'Completed',   color: '#6BCB77' },
  on_hold:     { label: 'On Hold',     color: '#FF9F43' },
  cancelled:   { label: 'Cancelled',   color: '#FF6B6B' },
}

const PRIORITY_CONFIG = {
  low:      { color: '#8b8fa8', icon: '▽' },
  medium:   { color: '#FFD166', icon: '△' },
  high:     { color: '#FF9F43', icon: '▲' },
  critical: { color: '#FF6B6B', icon: '⬆' },
}

const AVATAR_COLORS = ['#FF6B6B','#FFD166','#6BCB77','#4ECDC4','#A29BFE','#74B9FF']
const getAvatarColor = name => AVATAR_COLORS[(name?.charCodeAt(0) || 0) % AVATAR_COLORS.length]

const fmt = (amount) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0
  }).format(amount || 0)

function AnimatedNumber({ value, color }) {
  const count = useMotionValue(0)
  const rounded = useTransform(count, v => Math.round(v))
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    const controls = animate(count, value || 0, {
      duration: 1.2,
      ease: 'easeOut',
    })
    const unsub = rounded.on('change', v => setDisplay(v))
    return () => { controls.stop(); unsub() }
  }, [value, count, rounded])

  return (
    <motion.span style={{ color }}>
      {display}
    </motion.span>
  )
}

// ── Health Card ───────────────────────────────────────────────────────────────
function HealthCard({ label, value, icon: Icon, color, subtitle, onClick, alert }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      whileHover={onClick ? { y: -3, transition: { duration: 0.15 } } : {}}
      style={{ height: '100%' }}
    >
      <Card onClick={onClick} sx={{
        bgcolor: '#1e2029',
        border: `1px solid ${alert ? color + '35' : '#2a2d3e'}`,
        height: '100%',
        cursor: onClick ? 'pointer' : 'default',
      }}>
        <CardContent sx={{
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          '&:last-child': { pb: 2 },
        }}>
          <Box sx={{
            width: 34,
            height: 34,
            borderRadius: 2,
            bgcolor: alert ? `${color}18` : '#252736',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Icon sx={{ fontSize: 18, color }} />
          </Box>

          <Typography variant="h4" fontWeight={800}
            sx={{ lineHeight: 1, letterSpacing: '-0.02em' }}>
            <AnimatedNumber value={value} color={color} />
          </Typography>

          <Box>
            <Typography variant="body2" fontWeight={600} color="text.primary"
              sx={{ fontSize: '0.8rem', lineHeight: 1.3 }}>
              {label}
            </Typography>
            {subtitle && (
              <Typography variant="caption" color="text.secondary"
                sx={{ fontSize: '0.68rem', display: 'block', mt: 0.2 }}>
                {subtitle}
              </Typography>
            )}
          </Box>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ── Project Row ───────────────────────────────────────────────────────────────
function ProjectRow({ project, navigate, index = 0 }) {
  const status   = STATUS_CONFIG[project.status]    || STATUS_CONFIG.backlog
  const priority = PRIORITY_CONFIG[project.priority] || PRIORITY_CONFIG.medium

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05, duration: 0.2, ease: 'easeOut' }}
    >
      <Box onClick={() => navigate(`/projects/${project.id}`)} sx={{
        display: 'flex', alignItems: 'center', gap: 2,
        px: 2, py: 1.5, cursor: 'pointer', borderRadius: 2,
        transition: 'background 0.15s ease',
        '&:hover': { bgcolor: '#252736' },
      }}>
      {/* Status dot */}
      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: status.color, flexShrink: 0 }} />

      {/* Name + flags */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" fontWeight={600} noWrap>{project.name}</Typography>
          {project.is_overdue && (
            <Chip label="Overdue" size="small" sx={{
              bgcolor: 'rgba(255,107,107,0.12)', color: '#FF6B6B',
              border: '1px solid rgba(255,107,107,0.25)',
              fontSize: '0.6rem', height: 18, fontWeight: 700,
            }} />
          )}
          {project.is_at_risk && !project.is_overdue && (
            <Chip label="At Risk" size="small" sx={{
              bgcolor: 'rgba(255,159,67,0.12)', color: '#FF9F43',
              border: '1px solid rgba(255,159,67,0.25)',
              fontSize: '0.6rem', height: 18, fontWeight: 700,
            }} />
          )}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mt: 0.2, flexWrap: 'wrap' }}>
          {project.owner_name && (
            <Typography variant="caption" color="text.secondary">
              {project.owner_name}
            </Typography>
          )}
          {project.owner_name && project.due_date && (
            <Typography variant="caption" color="text.secondary">·</Typography>
          )}
          <DueDateChip date={project.due_date} status={project.status} />
        </Box>
      </Box>

      {/* Priority */}
      <Typography variant="caption" sx={{ color: priority.color, fontWeight: 700, flexShrink: 0 }}>
        {priority.icon}
      </Typography>

      {/* Progress */}
      <Box sx={{ width: 80, flexShrink: 0 }}>
        <LinearProgress variant="determinate" value={project.progress || 0}
          sx={{ height: 4, borderRadius: 2, bgcolor: '#252736',
            '& .MuiLinearProgress-bar': { bgcolor: status.color, borderRadius: 2 } }} />
      </Box>
      <Typography variant="caption" sx={{ color: status.color, fontWeight: 700, width: 32, flexShrink: 0 }}>
        {project.progress || 0}%
      </Typography>
      </Box>
    </motion.div>
  )
}

// ── Search Bar ────────────────────────────────────────────────────────────────
function DashboardSearch() {
  const navigate  = useNavigate()
  const [q,       setQ]       = useState('')
  const [results, setResults] = useState(null)
  const [open,    setOpen]    = useState(false)
  const [loading, setLoading] = useState(false)

  const doSearch = useCallback(async (val) => {
    if (!val || val.length < 2) { setResults(null); return }
    setLoading(true)
    try {
      const token = localStorage.getItem('acme_token')
      const r = await axios.get(
        `${BASE}/search?q=${encodeURIComponent(val)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setResults(r.data)
    } catch { setResults(null) }
    finally { setLoading(false) }
  }, [])

  const handleChange = (e) => {
    const val = e.target.value
    setQ(val)
    setOpen(true)
    clearTimeout(window._searchTimer)
    window._searchTimer = setTimeout(() => doSearch(val), 350)
  }

  const handleClear = () => {
    setQ(''); setResults(null); setOpen(false)
    clearTimeout(window._searchTimer)
  }

  const go = (path) => { handleClear(); navigate(path) }

  const SECTIONS = [
    { key: 'projects',     label: 'Projects',     color: '#A29BFE', nav: id => go(`/projects/${id}`) },
    { key: 'teams',        label: 'Teams',        color: '#6BCB77', nav: id => go(`/teams/${id}`)    },
    { key: 'members',      label: 'Members',      color: '#4ECDC4', nav: ()  => go('/members')       },
    { key: 'achievements', label: 'Achievements', color: '#FFD166', nav: ()  => go('/achievements')  },
  ]

  return (
    <ClickAwayListener onClickAway={handleClear}>
      <Box sx={{ position: 'relative', maxWidth: 580, mb: 4 }}>
        <Paper sx={{
          display: 'flex', alignItems: 'center', gap: 1.5,
          px: 2.5, py: 1.3, bgcolor: '#1e2029',
          border: '1px solid',
          borderColor: open && q ? '#6BCB77' : '#2a2d3e',
          borderRadius: 3,
          boxShadow: open && q ? '0 0 0 3px rgba(107,203,119,0.08)' : 'none',
          transition: 'all 0.2s ease',
        }}>
          {loading
            ? <CircularProgress size={16} sx={{ color: '#8b8fa8', flexShrink: 0 }} />
            : <Search sx={{ color: '#8b8fa8', fontSize: 18, flexShrink: 0 }} />
          }
          <InputBase
            placeholder="Search projects, teams, members, achievements…"
            value={q} onChange={handleChange}
            onFocus={() => q.length >= 2 && setOpen(true)}
            sx={{ flex: 1, fontSize: '0.9rem',
              '& input::placeholder': { color: '#8b8fa8', opacity: 1 } }}
          />
          {q && (
            <IconButton size="small" onClick={handleClear}
              sx={{ color: '#8b8fa8', p: 0.2 }}>
              <Close sx={{ fontSize: 15 }} />
            </IconButton>
          )}
        </Paper>

        {open && q.length >= 2 && (
          <Paper sx={{
            position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
            bgcolor: '#1e2029', border: '1px solid #2a2d3e',
            borderRadius: 2.5, zIndex: 9999,
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            maxHeight: 400, overflow: 'auto',
          }}>
            {loading && (
              <Box sx={{ p: 3, display: 'flex', justifyContent: 'center' }}>
                <CircularProgress size={20} sx={{ color: '#6BCB77' }} />
              </Box>
            )}
            {!loading && results?.total === 0 && (
              <Box sx={{ p: 3, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">No results for "{q}"</Typography>
              </Box>
            )}
            {!loading && results?.total > 0 && SECTIONS.map(section => {
              const items = results[section.key] || []
              if (!items.length) return null
              return (
                <Box key={section.key}>
                  <Typography variant="caption" sx={{
                    display: 'block', px: 2, pt: 1.5, pb: 0.5,
                    color: '#8b8fa8', fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.65rem',
                  }}>
                    {section.label} · {items.length}
                  </Typography>
                  {items.map(item => (
                    <Box key={item.id} onClick={() => section.nav(item.id)} sx={{
                      display: 'flex', alignItems: 'center', gap: 1.5,
                      px: 2, py: 1, cursor: 'pointer',
                      '&:hover': { bgcolor: '#252736' },
                    }}>
                      <Avatar sx={{
                        width: 26, height: 26,
                        bgcolor: `${section.color}18`,
                        color: section.color,
                        fontSize: 11, fontWeight: 700, flexShrink: 0,
                      }}>
                        {(item.name || item.title || '?')[0].toUpperCase()}
                      </Avatar>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={600} noWrap>
                          {item.name || item.title}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" noWrap>
                          {item.department || item.role || item.status || item.impact || ''}
                        </Typography>
                      </Box>
                      <Chip label={section.label} size="small" sx={{
                        bgcolor: `${section.color}12`, color: section.color,
                        border: `1px solid ${section.color}25`,
                        fontSize: '0.6rem', height: 18, flexShrink: 0,
                      }} />
                    </Box>
                  ))}
                  <Divider sx={{ borderColor: '#2a2d3e' }} />
                </Box>
              )
            })}
            {!loading && results?.total > 0 && (
              <Box sx={{ px: 2, py: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  {results.total} result{results.total !== 1 ? 's' : ''} for "{q}"
                </Typography>
              </Box>
            )}
          </Paper>
        )}
      </Box>
    </ClickAwayListener>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user, getGreeting, canWrite } = useAuth()
  const navigate = useNavigate()

  const [stats,      setStats]      = useState(null)
  const [pipeline,   setPipeline]   = useState(null)
  const [projects,   setProjects]   = useState([])
  const [allocation, setAllocation] = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState('')

  useEffect(() => {
    Promise.all([
      getStats(),
      getPipeline(),
      getProjects(),
      getResourceAllocation().catch(() => null),
    ])
      .then(([s, p, pr, alloc]) => {
        setStats(s)
        setPipeline(p)
        // Show at-risk and overdue first, then active, limit 8
        const sorted = [...pr].sort((a, b) => {
          const score = x => (x.is_overdue ? 3 : x.is_at_risk ? 2 : x.is_over_budget ? 1 : 0)
          return score(b) - score(a)
        })
        setProjects(sorted.filter(p => !['completed','cancelled'].includes(p.status)).slice(0, 8))
        setAllocation(alloc)
      })
      .catch(() => setError('Could not load dashboard'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <DashboardSkeleton />

  const budgetPct = stats?.total_budget > 0
    ? Math.round((stats.spent_budget / stats.total_budget) * 100)
    : 0

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: i => ({
      opacity: 1, y: 0,
      transition: { delay: i * 0.08, duration: 0.3, ease: 'easeOut' },
    }),
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>

      {/* Search */}
      <DashboardSearch />

      {/* Greeting */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={700} letterSpacing="-0.01em">
          {getGreeting()}
        </Typography>
        <Typography variant="body2" color="text.secondary" mt={0.5}>
          Project Management Dashboard
        </Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {/* ── 6 Health Cards — 3 per row, 2 rows ──────────────────────────── */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          {
            label: 'Active Projects',
            value: stats?.active_projects,
            icon: Assignment,
            color: '#6BCB77',
            subtitle: 'Not completed',
            path: '/projects',
            alert: false,
          },
          {
            label: 'At Risk',
            value: stats?.at_risk_projects,
            icon: Warning,
            color: '#FF9F43',
            subtitle: 'Due ≤14 days, <70%',
            path: '/projects',
            alert: stats?.at_risk_projects > 0,
          },
          {
            label: 'Overdue',
            value: stats?.overdue_projects,
            icon: Error,
            color: '#FF6B6B',
            subtitle: 'Past deadline',
            path: '/projects',
            alert: stats?.overdue_projects > 0,
          },
          {
            label: 'Over Budget',
            value: stats?.over_budget_count,
            icon: AttachMoney,
            color: '#A29BFE',
            subtitle: '>80% budget used',
            path: '/projects',
            alert: stats?.over_budget_count > 0,
          },
          {
            label: 'Over-Allocated',
            value: stats?.over_allocated,
            icon: Person,
            color: '#4ECDC4',
            subtitle: 'Members on 2+ projects',
            path: '/members',
            alert: stats?.over_allocated > 0,
          },
          {
            label: 'Total Projects',
            value: stats?.total_projects,
            icon: TrendingUp,
            color: '#74B9FF',
            subtitle: 'All time',
            path: '/projects',
            alert: false,
          },
        ].map((card, i) => (
          <Grid item xs={6} sm={4} md={2} key={card.label}>
            <motion.div
              custom={i}
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              style={{ height: '100%' }}
            >
              <HealthCard {...card} onClick={() => navigate(card.path)} />
            </motion.div>
          </Grid>
        ))}
      </Grid>

      {/* ── Budget Overview ──────────────────────────────────────────────── */}
      {stats?.total_budget > 0 && (
        <Card sx={{ bgcolor: '#1e2029', border: '1px solid #2a2d3e', mb: 3 }}>
          <CardContent sx={{ p: 2.5 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
              <Typography variant="body2" fontWeight={700}>
                Portfolio Budget
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Across all active projects
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Box>
                <Typography variant="caption" color="text.secondary" display="block">Spent</Typography>
                <Typography variant="h6" fontWeight={700}
                  sx={{ color: budgetPct > 80 ? '#FF6B6B' : budgetPct > 60 ? '#FF9F43' : '#6BCB77' }}>
                  {fmt(stats.spent_budget)}
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary" display="block">Utilization</Typography>
                <Typography variant="h6" fontWeight={700}
                  sx={{ color: budgetPct > 80 ? '#FF6B6B' : '#FFD166' }}>
                  {budgetPct}%
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="caption" color="text.secondary" display="block">Total Budget</Typography>
                <Typography variant="h6" fontWeight={700} color="text.primary">
                  {fmt(stats.total_budget)}
                </Typography>
              </Box>
            </Box>
            <LinearProgress variant="determinate" value={Math.min(100, budgetPct)}
              sx={{ height: 6, borderRadius: 3, bgcolor: '#252736',
                '& .MuiLinearProgress-bar': {
                  bgcolor: budgetPct > 80 ? '#FF6B6B' : budgetPct > 60 ? '#FF9F43' : '#6BCB77',
                  borderRadius: 3,
                }
              }}
            />
          </CardContent>
        </Card>
      )}

      <Grid container spacing={3}>

        {/* ── Active Projects List ─────────────────────────────────────── */}
        <Grid item xs={12} md={7}>
          <Card sx={{ bgcolor: '#1e2029', border: '1px solid #2a2d3e' }}>
            <CardContent sx={{ p: 0 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2.5, py: 2, borderBottom: '1px solid #2a2d3e' }}>
                <Typography variant="body1" fontWeight={700}>Active Projects</Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  {canWrite && (
                    <Button size="small" startIcon={<Add sx={{ fontSize: 14 }} />}
                      onClick={() => navigate('/projects')}
                      sx={{ bgcolor: '#6BCB77', color: '#13141a', fontWeight: 700,
                        fontSize: '0.75rem', px: 1.5, py: 0.5,
                        '&:hover': { bgcolor: '#5ab868' } }}>
                      New
                    </Button>
                  )}
                  <Button size="small" endIcon={<ArrowForward sx={{ fontSize: 13 }} />}
                    onClick={() => navigate('/projects')}
                    sx={{ color: '#8b8fa8', fontSize: '0.75rem',
                      border: '1px solid #2a2d3e', borderRadius: 2,
                      '&:hover': { color: 'text.primary', borderColor: '#8b8fa8' } }}>
                    All
                  </Button>
                </Box>
              </Box>

              {projects.length === 0 ? (
                <Box sx={{ py: 5, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">No active projects</Typography>
                  {canWrite && (
                    <Button size="small" startIcon={<Add />} onClick={() => navigate('/projects')}
                      sx={{ mt: 1.5, bgcolor: '#6BCB77', color: '#13141a',
                        '&:hover': { bgcolor: '#5ab868' } }}>
                      Create First Project
                    </Button>
                  )}
                </Box>
              ) : (
                <Box sx={{ py: 0.5 }}>
                  {projects.map((p, i) => (
                    <ProjectRow key={p.id} project={p} navigate={navigate} index={i} />
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* ── Right column ─────────────────────────────────────────────── */}
        <Grid item xs={12} md={5}>

          {/* Pipeline breakdown */}
          <Card sx={{ bgcolor: '#1e2029', border: '1px solid #2a2d3e', mb: 2 }}>
            <CardContent sx={{ p: 0 }}>
              <Box sx={{ px: 2.5, py: 2, borderBottom: '1px solid #2a2d3e' }}>
                <Typography variant="body1" fontWeight={700}>Pipeline</Typography>
              </Box>
              <Box sx={{ p: 1.5 }}>
                {pipeline && Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
                  const count = pipeline.statuses?.[key]?.count || 0
                  if (count === 0) return null
                  return (
                    <Box key={key} onClick={() => navigate(`/projects`)}
                      sx={{ display: 'flex', alignItems: 'center', gap: 1.5,
                        px: 1, py: 0.8, borderRadius: 2, cursor: 'pointer',
                        '&:hover': { bgcolor: '#252736' } }}>
                      <Box sx={{ width: 7, height: 7, borderRadius: '50%',
                        bgcolor: cfg.color, flexShrink: 0 }} />
                      <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
                        {cfg.label}
                      </Typography>
                      <Chip label={count} size="small" sx={{
                        bgcolor: `${cfg.color}12`, color: cfg.color,
                        border: `1px solid ${cfg.color}25`,
                        fontSize: '0.7rem', fontWeight: 700, height: 20,
                      }} />
                    </Box>
                  )
                })}
              </Box>
            </CardContent>
          </Card>

          {/* Over-allocated members */}
          {allocation?.over_allocated?.length > 0 && (
            <Card sx={{ bgcolor: '#1e2029', border: '1px solid rgba(255,107,107,0.3)', mb: 2 }}>
              <CardContent sx={{ p: 0 }}>
                <Box sx={{ px: 2.5, py: 2, borderBottom: '1px solid rgba(255,107,107,0.15)' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Warning sx={{ color: '#FF6B6B', fontSize: 18 }} />
                    <Typography variant="body1" fontWeight={700} sx={{ color: '#FF6B6B' }}>
                      Over-Allocated Members
                    </Typography>
                    <Chip label={allocation.over_allocated_count} size="small"
                      sx={{ bgcolor: 'rgba(255,107,107,0.12)', color: '#FF6B6B',
                        border: '1px solid rgba(255,107,107,0.25)', fontWeight: 700, height: 20 }} />
                  </Box>
                </Box>
                <Box sx={{ p: 1.5 }}>
                  {allocation.over_allocated.slice(0, 5).map(m => {
                    const color = getAvatarColor(m.member_name)
                    return (
                      <Box key={m.member_id} sx={{
                        display: 'flex', alignItems: 'center', gap: 1.5,
                        px: 1, py: 1, borderRadius: 2,
                        '&:hover': { bgcolor: '#252736' },
                      }}>
                        <Avatar sx={{
                          width: 28, height: 28,
                          bgcolor: `${color}20`, color,
                          fontSize: 11, fontWeight: 700, flexShrink: 0,
                        }}>
                          {(m.member_name || '?')[0].toUpperCase()}
                        </Avatar>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="body2" fontWeight={600} noWrap>
                            {m.member_name}
                          </Typography>
                          <UtilizationBar
                            pct={m.utilization_pct}
                            days={m.total_days}
                            capacity={m.capacity_days}
                            height={4}
                            compact
                          />
                        </Box>
                        <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                          <Typography variant="caption"
                            sx={{ color: '#FF6B6B', fontWeight: 700, display: 'block' }}>
                            {m.utilization_pct}%
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {m.project_count} projects
                          </Typography>
                        </Box>
                      </Box>
                    )
                  })}
                </Box>
              </CardContent>
            </Card>
          )}

          {/* Org quick stats */}
          <Card sx={{ bgcolor: '#1e2029', border: '1px solid #2a2d3e' }}>
            <CardContent sx={{ p: 0 }}>
              <Box sx={{ px: 2.5, py: 2, borderBottom: '1px solid #2a2d3e' }}>
                <Typography variant="body1" fontWeight={700}>Organization</Typography>
              </Box>
              <Box sx={{ p: 1.5 }}>
                {[
                  { label: 'Teams',        value: stats?.total_teams,        color: '#6BCB77', path: '/teams',        icon: Groups  },
                  { label: 'Members',      value: stats?.total_members,      color: '#4ECDC4', path: '/members',      icon: Person  },
                  { label: 'Achievements', value: stats?.total_achievements, color: '#FFD166', path: '/achievements', icon: EmojiEvents },
                ].map(item => (
                  <Box key={item.label} onClick={() => navigate(item.path)} sx={{
                    display: 'flex', alignItems: 'center', gap: 1.5,
                    px: 1, py: 0.8, borderRadius: 2, cursor: 'pointer',
                    '&:hover': { bgcolor: '#252736' },
                  }}>
                    <Box sx={{ width: 30, height: 30, borderRadius: 1.5,
                      bgcolor: '#252736', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <item.icon sx={{ fontSize: 16, color: item.color }} />
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
                      {item.label}
                    </Typography>
                    <Typography variant="body2" fontWeight={700} sx={{ color: item.color }}>
                      {item.value ?? '—'}
                    </Typography>
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
