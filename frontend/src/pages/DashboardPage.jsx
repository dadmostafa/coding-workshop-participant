import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import {
  Grid, Box, Typography, CircularProgress, Alert,
  Card, CardContent, Button, Chip, LinearProgress,
  Avatar, AvatarGroup, Tooltip, Divider,
  InputBase, Paper, List, ListItem, ListItemText,
  ClickAwayListener, IconButton,
} from '@mui/material'
import {
  Groups, Person, EmojiEvents, LocationOff,
  WorkOff, TrendingUp, AccountTree, Add,
  Work, ArrowForward, Rocket,
  Search, Close, Timeline,
} from '@mui/icons-material'
import { getStats, getPipeline, getProjects } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { formatDate } from '../utils/time'

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

// ── Clean Stat Card ───────────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, color, subtitle, onClick }) {
  return (
    <Card onClick={onClick} sx={{
      bgcolor: '#1e2029',
      border: '1px solid #2a2d3e',
      height: '100%',
      cursor: onClick ? 'pointer' : 'default',
      transition: 'all 0.18s ease',
      '&:hover': onClick ? {
        borderColor: `${color}50`,
        transform: 'translateY(-2px)',
      } : {},
    }}>
      <CardContent sx={{
        p: 2.5,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 1,
        '&:last-child': { pb: 2.5 },
      }}>
        {/* Icon centered in a neutral circle */}
        <Box sx={{
          width: 36, height: 36,
          borderRadius: 2,
          bgcolor: '#252736',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Icon sx={{ fontSize: 18, color }} />
        </Box>

        {/* Value */}
        <Typography variant="h4" fontWeight={700}
          sx={{ color, lineHeight: 1, letterSpacing: '-0.02em' }}>
          {value ?? '—'}
        </Typography>

        {/* Label */}
        <Box>
          <Typography variant="body2" fontWeight={600} color="text.primary">
            {label}
          </Typography>
          {subtitle && (
            <Typography variant="caption" color="text.secondary">
              {subtitle}
            </Typography>
          )}
        </Box>
      </CardContent>
    </Card>
  )
}

// ── Clean Quick Action Card ───────────────────────────────────────────────────
function ActionCard({ icon: Icon, color, label, description, onClick }) {
  return (
    <Card onClick={onClick} sx={{
      bgcolor: '#1e2029',
      border: '1px solid #2a2d3e',
      cursor: 'pointer',
      transition: 'all 0.18s ease',
      '&:hover': {
        borderColor: `${color}50`,
        transform: 'translateY(-2px)',
      },
    }}>
      <CardContent sx={{
        p: 2,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        '&:last-child': { pb: 2 },
      }}>
        {/* Icon */}
        <Box sx={{
          width: 40, height: 40,
          borderRadius: 2,
          bgcolor: '#252736',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Icon sx={{ fontSize: 20, color }} />
        </Box>

        {/* Text */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" fontWeight={700}>
            {label}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            {description}
          </Typography>
        </Box>

        {/* Arrow */}
        <ArrowForward sx={{ fontSize: 16, color: '#8b8fa8', flexShrink: 0 }} />
      </CardContent>
    </Card>
  )
}

// ── Section Header ────────────────────────────────────────────────────────────
function SectionHeader({ title, action }) {
  return (
    <Box sx={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      mb: 2,
    }}>
      <Typography variant="body1" fontWeight={700} color="text.primary">
        {title}
      </Typography>
      {action}
    </Box>
  )
}

// ── Divider Label ─────────────────────────────────────────────────────────────
function DividerLabel({ label }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, my: 3 }}>
      <Box sx={{ flex: 1, height: 1, bgcolor: '#2a2d3e' }} />
      <Typography variant="caption" sx={{
        color: '#8b8fa8',
        fontWeight: 600,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        fontSize: '0.7rem',
      }}>
        {label}
      </Typography>
      <Box sx={{ flex: 1, height: 1, bgcolor: '#2a2d3e' }} />
    </Box>
  )
}

// ── Inline Search ─────────────────────────────────────────────────────────────
function DashboardSearch() {
  const navigate  = useNavigate()
  const [q,       setQ]       = useState('')
  const [results, setResults] = useState(null)
  const [open,    setOpen]    = useState(false)

  const search = useCallback(async (val) => {
    if (val.length < 2) { setResults(null); return }
    try {
      const token = localStorage.getItem('acme_token')
      const r = await axios.get(
        `${BASE}/search?q=${encodeURIComponent(val)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setResults(r.data)
    } catch { setResults(null) }
  }, [])

  const handleChange = (e) => {
    const val = e.target.value
    setQ(val)
    setOpen(true)
    clearTimeout(window._searchTimer)
    window._searchTimer = setTimeout(() => search(val), 300)
  }

  const go = (path) => {
    setOpen(false)
    setQ('')
    setResults(null)
    navigate(path)
  }

  const SECTIONS = [
    { key: 'projects',     label: 'Projects',     color: '#A29BFE', nav: id => go(`/projects/${id}`) },
    { key: 'teams',        label: 'Teams',        color: '#6BCB77', nav: id => go(`/teams/${id}`)    },
    { key: 'members',      label: 'Members',      color: '#4ECDC4', nav: ()  => go('/members')       },
    { key: 'achievements', label: 'Achievements', color: '#FFD166', nav: ()  => go('/achievements')  },
  ]

  return (
    <ClickAwayListener onClickAway={() => setOpen(false)}>
      <Box sx={{ position: 'relative', maxWidth: 560, mb: 4 }}>
        <Paper sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 2.5, py: 1.2,
          bgcolor: '#1e2029',
          border: '1px solid',
          borderColor: open && q ? '#6BCB77' : '#2a2d3e',
          borderRadius: 3,
          transition: 'border-color 0.2s ease',
          boxShadow: 'none',
        }}>
          <Search sx={{ color: '#8b8fa8', fontSize: 18, flexShrink: 0 }} />
          <InputBase
            placeholder="Search teams, projects, members…"
            value={q}
            onChange={handleChange}
            onFocus={() => q.length >= 2 && setOpen(true)}
            sx={{
              flex: 1,
              fontSize: '0.875rem',
              color: 'text.primary',
              '& input::placeholder': { color: '#8b8fa8', opacity: 1 },
            }}
          />
          {q && (
            <IconButton size="small"
              onClick={() => { setQ(''); setResults(null); setOpen(false) }}
              sx={{ color: '#8b8fa8', p: 0.3 }}>
              <Close sx={{ fontSize: 14 }} />
            </IconButton>
          )}
        </Paper>

        {/* Results */}
        {open && results && results.total > 0 && (
          <Paper sx={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0, right: 0,
            bgcolor: '#1e2029',
            border: '1px solid #2a2d3e',
            borderRadius: 2,
            zIndex: 9999,
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            maxHeight: 360,
            overflow: 'auto',
          }}>
            {SECTIONS.map(section => {
              const items = results[section.key] || []
              if (!items.length) return null
              return (
                <Box key={section.key}>
                  <Typography variant="caption" sx={{
                    display: 'block',
                    px: 2, pt: 1.5, pb: 0.5,
                    color: '#8b8fa8',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    fontSize: '0.65rem',
                  }}>
                    {section.label}
                  </Typography>
                  {items.map(item => (
                    <Box key={item.id}
                      onClick={() => section.nav(item.id)}
                      sx={{
                        display: 'flex', alignItems: 'center', gap: 1.5,
                        px: 2, py: 1, cursor: 'pointer',
                        '&:hover': { bgcolor: '#252736' },
                      }}>
                      <Avatar sx={{
                        width: 26, height: 26,
                        bgcolor: `${section.color}20`,
                        color: section.color,
                        fontSize: 11, fontWeight: 700,
                      }}>
                        {(item.name || item.title || '?')[0].toUpperCase()}
                      </Avatar>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={600} noWrap>
                          {item.name || item.title}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" noWrap>
                          {item.department || item.role || item.status || ''}
                        </Typography>
                      </Box>
                      <Chip label={section.label} size="small" sx={{
                        bgcolor: `${section.color}12`,
                        color: section.color,
                        border: `1px solid ${section.color}25`,
                        fontSize: '0.6rem', height: 18,
                      }} />
                    </Box>
                  ))}
                  <Divider sx={{ borderColor: '#2a2d3e' }} />
                </Box>
              )
            })}
            <Box sx={{ px: 2, py: 1 }}>
              <Typography variant="caption" color="text.secondary">
                {results.total} result{results.total !== 1 ? 's' : ''} for "{q}"
              </Typography>
            </Box>
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

  const [stats,    setStats]    = useState(null)
  const [pipeline, setPipeline] = useState(null)
  const [projects, setProjects] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')

  useEffect(() => {
    Promise.all([
      getStats(),
      getPipeline(),
      getProjects({ status: 'in_progress' }),
    ])
      .then(([s, p, pr]) => {
        setStats(s)
        setPipeline(p)
        setProjects(pr.slice(0, 6))
      })
      .catch(() => setError('Could not load dashboard'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <Box sx={{
      display: 'flex', justifyContent: 'center',
      alignItems: 'center', height: '60vh',
    }}>
      <CircularProgress sx={{ color: '#6BCB77' }} />
    </Box>
  )

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>

      {/* Search */}
      <DashboardSearch />

      {/* Greeting */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" fontWeight={700} letterSpacing="-0.01em">
          {getGreeting()}
        </Typography>
        <Typography variant="body2" color="text.secondary" mt={0.5}>
          {[user?.title, user?.department].filter(Boolean).join(' · ') || 'Welcome back'}
        </Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {/* ── Active Projects ─────────────────────────────────────────────── */}
      <SectionHeader
        title="Active Projects"
        action={
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            {pipeline?.statuses?.in_progress?.count > 0 && (
              <Chip
                label={`${pipeline.statuses.in_progress.count} in progress`}
                size="small"
                sx={{
                  bgcolor: 'rgba(255,209,102,0.1)',
                  color: '#FFD166',
                  border: '1px solid rgba(255,209,102,0.2)',
                  fontWeight: 600,
                  fontSize: '0.75rem',
                }}
              />
            )}
            {canWrite && (
              <Button size="small" startIcon={<Add sx={{ fontSize: 16 }} />}
                onClick={() => navigate('/projects')}
                sx={{
                  bgcolor: '#6BCB77', color: '#13141a',
                  fontWeight: 700, fontSize: '0.8rem',
                  px: 1.5, py: 0.6,
                  '&:hover': { bgcolor: '#5ab868' },
                }}>
                New
              </Button>
            )}
            <Button size="small" endIcon={<ArrowForward sx={{ fontSize: 14 }} />}
              onClick={() => navigate('/projects')}
              sx={{
                color: '#8b8fa8', fontSize: '0.8rem',
                border: '1px solid #2a2d3e', borderRadius: 2,
                px: 1.5, py: 0.6,
                '&:hover': { color: 'text.primary', borderColor: '#8b8fa8' },
              }}>
              All
            </Button>
          </Box>
        }
      />

      {projects.length === 0 ? (
        <Card sx={{
          bgcolor: '#1e2029', border: '1px dashed #2a2d3e',
          mb: 4,
        }}>
          <CardContent sx={{
            py: 5,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 1.5,
          }}>
            <Rocket sx={{ fontSize: 40, color: '#2a2d3e' }} />
            <Typography variant="body2" color="text.secondary">
              No active projects
            </Typography>
            {canWrite && (
              <Button size="small" startIcon={<Add />}
                onClick={() => navigate('/projects')}
                sx={{
                  bgcolor: '#6BCB77', color: '#13141a',
                  fontWeight: 700, mt: 0.5,
                  '&:hover': { bgcolor: '#5ab868' },
                }}>
                Create First Project
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={2} sx={{ mb: 4 }}>
          {projects.map(p => {
            const status   = STATUS_CONFIG[p.status]    || STATUS_CONFIG.backlog
            const priority = PRIORITY_CONFIG[p.priority] || PRIORITY_CONFIG.medium
            const isOverdue = p.due_date &&
              new Date(p.due_date) < new Date() &&
              !['completed', 'cancelled'].includes(p.status)

            return (
              <Grid item xs={12} sm={6} md={4} key={p.id}>
                <Card onClick={() => navigate(`/projects/${p.id}`)} sx={{
                  bgcolor: '#1e2029',
                  border: '1px solid #2a2d3e',
                  cursor: 'pointer',
                  height: '100%',
                  transition: 'all 0.18s ease',
                  '&:hover': {
                    borderColor: `${status.color}50`,
                    transform: 'translateY(-2px)',
                  },
                }}>
                  <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                    {/* Status + Priority */}
                    <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
                      <Chip label={status.label} size="small" sx={{
                        bgcolor: `${status.color}15`,
                        color: status.color,
                        border: `1px solid ${status.color}25`,
                        fontSize: '0.65rem', fontWeight: 600,
                      }} />
                      <Chip
                        label={`${priority.icon} ${PRIORITY_CONFIG[p.priority]?.label || 'Medium'}`}
                        size="small" sx={{
                          bgcolor: '#252736',
                          color: priority.color,
                          border: '1px solid #2a2d3e',
                          fontSize: '0.6rem',
                        }}
                      />
                    </Box>

                    {/* Name */}
                    <Typography variant="body1" fontWeight={700} mb={0.5} noWrap>
                      {p.name}
                    </Typography>

                    {p.description && (
                      <Typography variant="caption" color="text.secondary"
                        sx={{ display: 'block', mb: 1.5 }} noWrap>
                        {p.description}
                      </Typography>
                    )}

                    {/* Progress */}
                    <Box sx={{ mb: 1.5 }}>
                      <Box sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        mb: 0.5,
                      }}>
                        <Typography variant="caption" color="text.secondary">
                          Progress
                        </Typography>
                        <Typography variant="caption" fontWeight={700}
                          sx={{ color: status.color }}>
                          {p.progress || 0}%
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={p.progress || 0}
                        sx={{
                          height: 4, borderRadius: 2,
                          bgcolor: '#252736',
                          '& .MuiLinearProgress-bar': {
                            bgcolor: status.color, borderRadius: 2,
                          },
                        }}
                      />
                    </Box>

                    {/* Footer */}
                    <Box sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}>
                      <Typography variant="caption"
                        sx={{ color: isOverdue ? '#FF6B6B' : '#8b8fa8', fontSize: '0.7rem' }}>
                        {p.due_date
                          ? `${isOverdue ? '⚠ ' : ''}Due ${formatDate(p.due_date)}`
                          : p.owner_name || ''}
                      </Typography>

                      {p.members?.length > 0 && (
                        <AvatarGroup max={3} sx={{
                          '& .MuiAvatar-root': {
                            width: 20, height: 20,
                            fontSize: 9,
                            border: '1px solid #1e2029',
                          },
                        }}>
                          {p.members.map((m, i) => (
                            <Tooltip key={i} title={m.member_name}>
                              <Avatar sx={{
                                bgcolor: getAvatarColor(m.member_name),
                                color: '#13141a', fontWeight: 700,
                              }}>
                                {(m.member_name || '?')[0]}
                              </Avatar>
                            </Tooltip>
                          ))}
                        </AvatarGroup>
                      )}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            )
          })}
        </Grid>
      )}

      {/* ── Pipeline Status ──────────────────────────────────────────────── */}
      {pipeline && pipeline.total > 0 && (
        <>
          <SectionHeader title="Pipeline" />
          <Grid container spacing={1.5} sx={{ mb: 1 }}>
            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
              const count = pipeline.statuses?.[key]?.count || 0
              if (count === 0) return null
              return (
                <Grid item xs={6} sm={4} md={3} lg={2} key={key}>
                  <Card onClick={() => navigate(`/projects?status=${key}`)} sx={{
                    bgcolor: '#1e2029',
                    border: '1px solid #2a2d3e',
                    cursor: 'pointer',
                    transition: 'all 0.18s ease',
                    '&:hover': {
                      borderColor: `${cfg.color}50`,
                      transform: 'translateY(-2px)',
                    },
                  }}>
                    <CardContent sx={{
                      p: 2, '&:last-child': { pb: 2 },
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 0.5,
                    }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                        <Box sx={{
                          width: 7, height: 7,
                          borderRadius: '50%',
                          bgcolor: cfg.color,
                          flexShrink: 0,
                        }} />
                        <Typography variant="caption" sx={{
                          color: '#8b8fa8', fontWeight: 600,
                          fontSize: '0.7rem',
                        }}>
                          {cfg.label}
                        </Typography>
                      </Box>
                      <Typography variant="h5" fontWeight={800}
                        sx={{ color: cfg.color, lineHeight: 1 }}>
                        {count}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              )
            })}
          </Grid>
        </>
      )}

      {/* ── Quick Actions ────────────────────────────────────────────────── */}
      <DividerLabel label="Quick Actions" />

      <Grid container spacing={1.5} sx={{ mb: 1 }}>
        {[
          { icon: Groups,     color: '#6BCB77', label: 'Teams',        description: 'View and edit team structure',   path: '/teams'        },
          { icon: Person,     color: '#4ECDC4', label: 'Members',      description: 'Add or update member info',      path: '/members'      },
          { icon: EmojiEvents,color: '#FFD166', label: 'Achievements', description: 'Record monthly wins',            path: '/achievements' },
          { icon: Timeline,   color: '#FF9F43', label: 'Activity',     description: 'See recent actions',             path: '/activity'     },
        ].map(a => (
          <Grid item xs={12} sm={6} md={3} key={a.path}>
            <ActionCard {...a} onClick={() => navigate(a.path)} />
          </Grid>
        ))}
      </Grid>

      {/* ── Org Stats ───────────────────────────────────────────────────── */}
      <DividerLabel label="Organization Stats" />

      {/* Top counts */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        {[
          { label: 'Teams',           value: stats?.total_teams,        icon: Groups,      color: '#6BCB77', path: '/teams'        },
          { label: 'Members',         value: stats?.total_members,      icon: Person,      color: '#4ECDC4', path: '/members'      },
          { label: 'Achievements',    value: stats?.total_achievements, icon: EmojiEvents, color: '#FFD166', path: '/achievements' },
          { label: 'Total Projects',  value: stats?.total_projects,     icon: Work,        color: '#A29BFE', path: '/projects'     },
          { label: 'Active Projects', value: stats?.active_projects,    icon: Rocket,      color: '#74B9FF', path: '/projects'     },
        ].map(s => (
          <Grid item xs={6} sm={4} md={2} key={s.label}>
            <StatCard
              label={s.label}
              value={s.value}
              icon={s.icon}
              color={s.color}
              onClick={() => navigate(s.path)}
            />
          </Grid>
        ))}
      </Grid>

      {/* Insight stats */}
      <Grid container spacing={2}>
        {[
          { label: 'Leader not co-located', value: stats?.leader_not_colocated, icon: LocationOff, color: '#FF6B6B', subtitle: 'Leader ≠ team location'    },
          { label: 'Non-direct leader',     value: stats?.leader_non_direct,    icon: WorkOff,    color: '#FF9F43', subtitle: 'Leader is non-direct'       },
          { label: 'High non-direct ratio', value: stats?.high_nondirect_ratio, icon: TrendingUp, color: '#A29BFE', subtitle: '>20% non-direct staff'      },
          { label: 'Under org leader',      value: stats?.has_org_leader,       icon: AccountTree,color: '#74B9FF', subtitle: 'Reporting to org leader'    },
        ].map(s => (
          <Grid item xs={6} sm={6} md={3} key={s.label}>
            <StatCard
              label={s.label}
              value={s.value}
              icon={s.icon}
              color={s.color}
              subtitle={s.subtitle}
            />
          </Grid>
        ))}
      </Grid>

    </Box>
  )
}
