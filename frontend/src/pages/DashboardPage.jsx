import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Grid, Box, Typography, CircularProgress, Alert,
  Card, CardContent, Button, Chip, LinearProgress,
  Avatar, AvatarGroup, Tooltip, ClickAwayListener,
  InputBase, IconButton, Paper, Divider,
} from '@mui/material'
import {
  Groups, Person, EmojiEvents, LocationOff,
  WorkOff, TrendingUp, AccountTree, Add,
  FolderOpen, ArrowForward, Rocket, Timeline,
  Search, Close,
} from '@mui/icons-material'
import axios from 'axios'
import { getStats, getPipeline, getProjects } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { formatDate } from '../utils/time'

const BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3001') + '/api/team-service'

const STATUS_CONFIG = {
  backlog: { label: 'Backlog', color: '#8b8fa8' },
  planning: { label: 'Planning', color: '#74B9FF' },
  in_progress: { label: 'In Progress', color: '#FFD166' },
  review: { label: 'Review', color: '#A29BFE' },
  completed: { label: 'Completed', color: '#6BCB77' },
  on_hold: { label: 'On Hold', color: '#FF9F43' },
  cancelled: { label: 'Cancelled', color: '#FF6B6B' },
}

const PRIORITY_CONFIG = {
  low: { color: '#8b8fa8', icon: '▽', label: 'Low' },
  medium: { color: '#FFD166', icon: '△', label: 'Medium' },
  high: { color: '#FF9F43', icon: '▲', label: 'High' },
  critical: { color: '#FF6B6B', icon: '⬆', label: 'Critical' },
}

const AVATAR_COLORS = ['#FF6B6B', '#FFD166', '#6BCB77', '#4ECDC4', '#A29BFE', '#74B9FF']
const getColor = (name) => AVATAR_COLORS[(name?.charCodeAt(0) || 0) % AVATAR_COLORS.length]

function StatCard({ label, value, icon: Icon, color, bg, subtitle, onClick }) {
  return (
    <Card onClick={onClick} sx={{
      bgcolor: '#1e2029', border: '1px solid #2a2d3e', height: '100%',
      cursor: onClick ? 'pointer' : 'default',
      transition: 'all 0.2s cubic-bezier(0.34,1.56,0.64,1)',
      '&:hover': onClick ? {
        border: `1px solid ${color}60`,
        transform: 'translateY(-3px)',
        boxShadow: '0 12px 32px rgba(0,0,0,0.3)',
      } : {},
    }}>
      <CardContent sx={{ p: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="caption" sx={{
              color: '#8b8fa8', textTransform: 'uppercase',
              letterSpacing: '0.08em', fontWeight: 600,
            }}>
              {label}
            </Typography>
            <Typography variant="h4" fontWeight={800}
              sx={{ color, mt: 0.5, lineHeight: 1, letterSpacing: '-0.02em' }}>
              {value ?? '—'}
            </Typography>
            {subtitle && (
              <Typography variant="caption" sx={{ color: '#8b8fa8', mt: 0.5, display: 'block' }}>
                {subtitle}
              </Typography>
            )}
          </Box>
          <Box sx={{ p: 1.2, borderRadius: 2.5, bgcolor: bg }}>
            <Icon sx={{ fontSize: 22, color }} />
          </Box>
        </Box>
      </CardContent>
    </Card>
  )
}

function QuickActionCard({ icon, label, description, color, onClick }) {
  return (
    <Card onClick={onClick} sx={{
      bgcolor: '#1e2029', border: '1px solid #2a2d3e',
      cursor: 'pointer', height: '100%',
      transition: 'all 0.2s cubic-bezier(0.34,1.56,0.64,1)',
      '&:hover': {
        border: `1px solid ${color}60`,
        transform: 'translateY(-3px)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
        bgcolor: `${color}08`,
      },
    }}>
      <CardContent sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Box sx={{ p: 1.5, borderRadius: 2.5, bgcolor: `${color}15`, flexShrink: 0 }}>
          {icon}
        </Box>
        <Box>
          <Typography variant="body2" fontWeight={700}>{label}</Typography>
          <Typography variant="caption" color="text.secondary">{description}</Typography>
        </Box>
        <ArrowForward sx={{ color: '#8b8fa8', fontSize: 16, ml: 'auto', flexShrink: 0 }} />
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const { user, getGreeting, canWrite } = useAuth()
  const navigate = useNavigate()

  const [stats, setStats] = useState(null)
  const [pipeline, setPipeline] = useState(null)
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([getStats(), getPipeline(), getProjects({ status: 'in_progress' })])
      .then(([s, p, pr]) => {
        setStats(s)
        setPipeline(p)
        setProjects(pr.slice(0, 6))
      })
      .catch(() => setError('Could not load dashboard'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
      <CircularProgress sx={{ color: '#6BCB77' }} />
    </Box>
  )

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <SearchBar />
      </Box>

      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" fontWeight={800} letterSpacing="-0.02em">
          {getGreeting()}
        </Typography>
        <Typography variant="body2" color="text.secondary" mt={0.5}>
          {user?.title && `${user.title} · `}
          {user?.department && `${user.department} · `}
          Here's your organization at a glance
        </Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Rocket sx={{ color: '#A29BFE', fontSize: 20 }} />
            <Typography variant="h6" fontWeight={700}>Active Projects</Typography>
            {pipeline && (
              <Chip label={`${pipeline.statuses?.in_progress?.count || 0} in progress`}
                size="small" sx={{
                  bgcolor: 'rgba(255,209,102,0.12)', color: '#FFD166',
                  border: '1px solid rgba(255,209,102,0.3)', fontWeight: 600,
                }} />
            )}
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {canWrite && (
              <Button size="small" startIcon={<Add />}
                onClick={() => navigate('/projects')}
                sx={{
                  bgcolor: '#A29BFE', color: '#13141a', fontWeight: 700,
                  '&:hover': { bgcolor: '#9188f0' },
                }}>
                New Project
              </Button>
            )}
            <Button size="small" endIcon={<ArrowForward />}
              onClick={() => navigate('/projects')}
              sx={{ color: '#8b8fa8', border: '1px solid #2a2d3e', borderRadius: 2,
                '&:hover': { color: '#fff', borderColor: '#fff' } }}>
              View All
            </Button>
          </Box>
        </Box>

        {projects.length === 0 ? (
          <Card sx={{ bgcolor: '#1e2029', border: '1px solid #2a2d3e' }}>
            <CardContent sx={{ textAlign: 'center', py: 6 }}>
              <Rocket sx={{ fontSize: 48, color: '#2a2d3e', mb: 1 }} />
              <Typography color="text.secondary" variant="body2" gutterBottom>
                No active projects
              </Typography>
              {canWrite && (
                <Button size="small" variant="contained" startIcon={<Add />}
                  onClick={() => navigate('/projects')}
                  sx={{ mt: 1, bgcolor: '#A29BFE', color: '#13141a' }}>
                  Create First Project
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <Grid container spacing={2}>
            {projects.map((p) => {
              const status = STATUS_CONFIG[p.status] || STATUS_CONFIG.backlog
              const priority = PRIORITY_CONFIG[p.priority] || PRIORITY_CONFIG.medium
              const isOverdue = p.due_date
                && new Date(p.due_date) < new Date()
                && !['completed', 'cancelled'].includes(p.status)

              return (
                <Grid item xs={12} sm={6} lg={4} key={p.id}>
                  <Card onClick={() => navigate(`/projects/${p.id}`)} sx={{
                    bgcolor: '#1e2029', border: '1px solid #2a2d3e',
                    cursor: 'pointer', height: '100%',
                    transition: 'all 0.2s cubic-bezier(0.34,1.56,0.64,1)',
                    '&:hover': {
                      border: `1px solid ${status.color}60`,
                      transform: 'translateY(-3px)',
                    },
                  }}>
                    <CardContent sx={{ p: 2.5 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Chip label={status.label} size="small" sx={{
                          bgcolor: `${status.color}15`, color: status.color,
                          border: `1px solid ${status.color}30`,
                          fontSize: '0.65rem', fontWeight: 600,
                        }} />
                        <Chip label={`${priority.icon} ${priority.label}`}
                          size="small" sx={{
                            bgcolor: `${priority.color}10`, color: priority.color,
                            border: `1px solid ${priority.color}25`,
                            fontSize: '0.6rem',
                          }} />
                      </Box>

                      <Typography variant="body1" fontWeight={700} mb={0.5}
                        sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.name}
                      </Typography>

                      {p.description && (
                        <Typography variant="caption" color="text.secondary"
                          sx={{ display: 'block', mb: 1.5,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.description}
                        </Typography>
                      )}

                      <Box sx={{ mb: 1.5 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                          <Typography variant="caption" color="text.secondary">Progress</Typography>
                          <Typography variant="caption" fontWeight={700} sx={{ color: status.color }}>
                            {p.progress || 0}%
                          </Typography>
                        </Box>
                        <LinearProgress variant="determinate" value={p.progress || 0}
                          sx={{ height: 5, borderRadius: 3, bgcolor: '#2a2d3e',
                            '& .MuiLinearProgress-bar': { bgcolor: status.color, borderRadius: 3 } }} />
                      </Box>

                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        {p.due_date ? (
                          <Typography variant="caption"
                            sx={{ color: isOverdue ? '#FF6B6B' : '#8b8fa8', fontSize: '0.7rem' }}>
                            {isOverdue ? '⚠ Due ' : 'Due '}{formatDate(p.due_date)}
                          </Typography>
                        ) : <Box />}

                        {p.members?.length > 0 && (
                          <AvatarGroup max={3} sx={{
                            '& .MuiAvatar-root': {
                              width: 20, height: 20, fontSize: 9,
                              border: '1px solid #1e2029',
                            },
                          }}>
                            {p.members.map((m, i) => (
                              <Tooltip key={i} title={m.member_name}>
                                <Avatar sx={{
                                  bgcolor: getColor(m.member_name),
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
      </Box>

      {pipeline && pipeline.total > 0 && (
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
            <FolderOpen sx={{ color: '#74B9FF', fontSize: 20 }} />
            <Typography variant="h6" fontWeight={700}>Pipeline Overview</Typography>
          </Box>
          <Grid container spacing={1.5}>
            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
              const count = pipeline.statuses?.[key]?.count || 0
              if (count === 0) return null
              return (
                <Grid item xs={6} sm={4} md={3} lg={2} key={key}>
                  <Card onClick={() => navigate(`/projects?status=${key}`)} sx={{
                    bgcolor: '#1e2029', border: '1px solid #2a2d3e',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    '&:hover': { border: `1px solid ${cfg.color}50`, transform: 'translateY(-2px)' },
                  }}>
                    <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: cfg.color }} />
                        <Typography variant="caption" sx={{
                          color: '#8b8fa8', fontWeight: 600,
                          textTransform: 'uppercase', letterSpacing: '0.06em',
                          fontSize: '0.65rem',
                        }}>
                          {cfg.label}
                        </Typography>
                      </Box>
                      <Typography variant="h5" fontWeight={800} sx={{ color: cfg.color }}>
                        {count}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              )
            })}
          </Grid>
        </Box>
      )}

      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <Box sx={{ flexGrow: 1, height: '1px', bgcolor: '#2a2d3e' }} />
          <Typography variant="caption" sx={{
            color: '#8b8fa8', textTransform: 'uppercase',
            letterSpacing: '0.08em', fontWeight: 600, px: 1,
          }}>
            Quick Actions
          </Typography>
          <Box sx={{ flexGrow: 1, height: '1px', bgcolor: '#2a2d3e' }} />
        </Box>
        <Grid container spacing={1.5}>
          {[
            { icon: <Groups sx={{ color: '#6BCB77', fontSize: 22 }} />, label: 'Manage Teams', description: 'View and edit team structure', color: '#6BCB77', path: '/teams' },
            { icon: <Person sx={{ color: '#4ECDC4', fontSize: 22 }} />, label: 'Team Members', description: 'Add or update member info', color: '#4ECDC4', path: '/members' },
            { icon: <EmojiEvents sx={{ color: '#FFD166', fontSize: 22 }} />, label: 'Achievements', description: 'Record monthly wins', color: '#FFD166', path: '/achievements' },
            { icon: <Timeline sx={{ color: '#FF9F43', fontSize: 22 }} />, label: 'Activity Feed', description: 'See recent actions', color: '#FF9F43', path: '/activity' },
          ].map((action) => (
            <Grid item xs={12} sm={6} md={3} key={action.path}>
              <QuickActionCard {...action} onClick={() => navigate(action.path)} />
            </Grid>
          ))}
        </Grid>
      </Box>

      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <Box sx={{ flexGrow: 1, height: '1px', bgcolor: '#2a2d3e' }} />
          <Typography variant="caption" sx={{
            color: '#8b8fa8', textTransform: 'uppercase',
            letterSpacing: '0.08em', fontWeight: 600, px: 1,
          }}>
            Organization Stats
          </Typography>
          <Box sx={{ flexGrow: 1, height: '1px', bgcolor: '#2a2d3e' }} />
        </Box>

        <Grid container spacing={2} mb={2}>
          <Grid item xs={6} sm={4} md={2}>
            <StatCard label="Teams" value={stats?.total_teams} icon={Groups} color="#6BCB77" bg="rgba(107,203,119,0.12)" onClick={() => navigate('/teams')} />
          </Grid>
          <Grid item xs={6} sm={4} md={2}>
            <StatCard label="Members" value={stats?.total_members} icon={Person} color="#4ECDC4" bg="rgba(78,205,196,0.12)" onClick={() => navigate('/members')} />
          </Grid>
          <Grid item xs={6} sm={4} md={2}>
            <StatCard label="Achievements" value={stats?.total_achievements} icon={EmojiEvents} color="#FFD166" bg="rgba(255,209,102,0.12)" onClick={() => navigate('/achievements')} />
          </Grid>
          <Grid item xs={6} sm={4} md={2}>
            <StatCard label="Total Projects" value={stats?.total_projects} icon={FolderOpen} color="#A29BFE" bg="rgba(162,155,254,0.12)" onClick={() => navigate('/projects')} />
          </Grid>
          <Grid item xs={6} sm={4} md={2}>
            <StatCard label="Active Projects" value={stats?.active_projects} icon={Rocket} color="#74B9FF" bg="rgba(116,185,255,0.12)" onClick={() => navigate('/projects')} />
          </Grid>
        </Grid>

        <Grid container spacing={2}>
          <Grid item xs={6} sm={6} md={3}>
            <StatCard label="Leader not co-located" value={stats?.leader_not_colocated} icon={LocationOff} color="#FF6B6B" bg="rgba(255,107,107,0.12)" subtitle="Leader ≠ team location" />
          </Grid>
          <Grid item xs={6} sm={6} md={3}>
            <StatCard label="Non-direct leader" value={stats?.leader_non_direct} icon={WorkOff} color="#FF9F43" bg="rgba(255,159,67,0.12)" subtitle="Leader is non-direct staff" />
          </Grid>
          <Grid item xs={6} sm={6} md={3}>
            <StatCard label="High non-direct ratio" value={stats?.high_nondirect_ratio} icon={TrendingUp} color="#A29BFE" bg="rgba(162,155,254,0.12)" subtitle=">20% non-direct staff" />
          </Grid>
          <Grid item xs={6} sm={6} md={3}>
            <StatCard label="Under org leader" value={stats?.has_org_leader} icon={AccountTree} color="#74B9FF" bg="rgba(116,185,255,0.12)" subtitle="Reporting to org leader" />
          </Grid>
        </Grid>
      </Box>
    </Box>
  )
}

function SearchBar() {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [results, setResults] = useState(null)
  const [open, setOpen] = useState(false)

  const search = useCallback(async (val) => {
    if (val.length < 2) { setResults(null); return }
    try {
      const token = localStorage.getItem('acme_token')
      const r = await axios.get(
        `${BASE}/search?q=${encodeURIComponent(val)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setResults(r.data)
    } catch {
      setResults(null)
    }
  }, [])

  const handleChange = (e) => {
    const val = e.target.value
    setQ(val)
    setOpen(true)
    const t = setTimeout(() => search(val), 300)
    return () => clearTimeout(t)
  }

  return (
    <ClickAwayListener onClickAway={() => setOpen(false)}>
      <Box sx={{ position: 'relative', maxWidth: 600 }}>
        <Paper sx={{
          display: 'flex', alignItems: 'center', gap: 1.5,
          px: 2.5, py: 1.4,
          bgcolor: '#1e2029',
          border: '1px solid',
          borderColor: open ? '#6BCB77' : '#2a2d3e',
          borderRadius: 4,
          boxShadow: open ? '0 0 0 3px rgba(107,203,119,0.1)' : 'none',
          transition: 'all 0.2s ease',
        }}>
          <Search sx={{ color: '#8b8fa8', fontSize: 22, flexShrink: 0 }} />
          <InputBase
            placeholder="Search everything - teams, projects, members, achievements..."
            value={q}
            onChange={handleChange}
            onFocus={() => q.length >= 2 && setOpen(true)}
            sx={{
              flexGrow: 1, fontSize: '0.95rem',
              '& input::placeholder': { color: '#8b8fa8', opacity: 1 },
            }}
          />
          {q && (
            <IconButton size="small"
              onClick={() => {
                setQ('')
                setResults(null)
                setOpen(false)
              }}
              sx={{ color: '#8b8fa8' }}>
              <Close sx={{ fontSize: 16 }} />
            </IconButton>
          )}
        </Paper>

        {open && results && results.total > 0 && (
          <Paper sx={{
            position: 'absolute', top: '110%', left: 0, right: 0,
            bgcolor: '#1e2029', border: '1px solid #2a2d3e',
            borderRadius: 3, zIndex: 9999,
            boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
            maxHeight: 400, overflow: 'auto',
          }}>
            {[
              { key: 'projects', label: 'Projects', color: '#A29BFE', navFn: (id) => navigate(`/projects/${id}`) },
              { key: 'teams', label: 'Teams', color: '#6BCB77', navFn: (id) => navigate(`/teams/${id}`) },
              { key: 'members', label: 'Members', color: '#4ECDC4', navFn: () => navigate('/members') },
              { key: 'achievements', label: 'Achievements', color: '#FFD166', navFn: () => navigate('/achievements') },
            ].map((section) => {
              const items = results[section.key] || []
              if (!items.length) return null
              return (
                <Box key={section.key}>
                  <Box sx={{ px: 2, pt: 1.5, pb: 0.5 }}>
                    <Typography variant="caption" sx={{
                      color: '#8b8fa8', fontWeight: 700,
                      textTransform: 'uppercase', letterSpacing: '0.08em',
                    }}>
                      {section.label}
                    </Typography>
                  </Box>
                  {items.map((item) => (
                    <Box key={item.id}
                      onClick={() => {
                        section.navFn(item.id)
                        setOpen(false)
                        setQ('')
                      }}
                      sx={{ display: 'flex', alignItems: 'center', gap: 1.5,
                        px: 2, py: 1, cursor: 'pointer',
                        '&:hover': { bgcolor: '#252736' } }}>
                      <Avatar sx={{
                        width: 28, height: 28,
                        bgcolor: `${section.color}20`, color: section.color,
                        fontSize: 12, fontWeight: 700,
                      }}>
                        {(item.name || item.title || '?')[0].toUpperCase()}
                      </Avatar>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" fontWeight={600}>
                          {item.name || item.title}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {item.department || item.role || item.status || ''}
                        </Typography>
                      </Box>
                      <Chip label={section.label} size="small" sx={{
                        bgcolor: `${section.color}12`, color: section.color,
                        border: `1px solid ${section.color}30`, fontSize: '0.6rem',
                      }} />
                    </Box>
                  ))}
                  <Divider sx={{ borderColor: '#2a2d3e' }} />
                </Box>
              )
            })}
          </Paper>
        )}
      </Box>
    </ClickAwayListener>
  )
}
