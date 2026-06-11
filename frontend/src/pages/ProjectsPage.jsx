import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Typography, Button, TextField, MenuItem,
  Card, CardContent, Chip, CircularProgress, Alert,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Grid, Tooltip, IconButton, Avatar, LinearProgress,
  ToggleButtonGroup, ToggleButton, AvatarGroup,
} from '@mui/material'
import {
  Add, Edit, Delete, ViewKanban, TableRows,
  CalendarToday, Person, Download,
} from '@mui/icons-material'
import {
  getProjects, createProject, updateProject,
  deleteProject, getTeams, getMembers, getPipeline,
} from '../services/api'
import { useAuth } from '../context/AuthContext'
import ConfirmDialog from '../components/ConfirmDialog'
import EmptyState from '../components/EmptyState'
import { formatDate } from '../utils/time'
import { useSort }   from '../hooks/useSort'
import SortHeader    from '../components/SortHeader'
import { usePagination } from '../hooks/usePagination'
import Pagination        from '../components/Pagination'

const STATUS_CONFIG = {
  backlog: { label: 'Backlog', color: '#8b8fa8', bg: 'rgba(139,143,168,0.12)' },
  planning: { label: 'Planning', color: '#74B9FF', bg: 'rgba(116,185,255,0.12)' },
  in_progress: { label: 'In Progress', color: '#FFD166', bg: 'rgba(255,209,102,0.12)' },
  review: { label: 'Review', color: '#A29BFE', bg: 'rgba(162,155,254,0.12)' },
  completed: { label: 'Completed', color: '#6BCB77', bg: 'rgba(107,203,119,0.12)' },
  on_hold: { label: 'On Hold', color: '#FF9F43', bg: 'rgba(255,159,67,0.12)' },
  cancelled: { label: 'Cancelled', color: '#FF6B6B', bg: 'rgba(255,107,107,0.12)' },
}

const PRIORITY_CONFIG = {
  low: { label: 'Low', color: '#8b8fa8', icon: '▽' },
  medium: { label: 'Medium', color: '#FFD166', icon: '△' },
  high: { label: 'High', color: '#FF9F43', icon: '▲' },
  critical: { label: 'Critical', color: '#FF6B6B', icon: '⬆' },
}

const AVATAR_COLORS = ['#FF6B6B', '#FFD166', '#6BCB77', '#4ECDC4', '#A29BFE', '#74B9FF', '#FF9F43']
const getColor = name => AVATAR_COLORS[(name?.charCodeAt(0) || 0) % AVATAR_COLORS.length]

const EMPTY_FORM = {
  name: '', description: '', team_id: '', status: 'backlog',
  priority: 'medium', owner_id: '', owner_name: '',
  start_date: '', due_date: '', progress: 0, tags: '', members: [],
}

// ── CSV Export ────────────────────────────────────────────────────────────────
function exportProjectsCSV(projects) {
  const headers = [
    'Name', 'Status', 'Priority', 'Owner',
    'Start Date', 'Due Date', 'Progress %',
    'Total Budget', 'Spent Budget', 'Budget %',
    'Team Members', 'Deliverables Done',
  ]
  const rows = projects.map(p => {
    const budgetPct = p.total_budget > 0
      ? Math.round((p.spent_budget / p.total_budget) * 100) : 0
    const deliverables = p.deliverables || []
    const doneDels     = deliverables.filter(d => d.status === 'done').length
    return [
      p.name         || '',
      p.status       || '',
      p.priority     || '',
      p.owner_name   || '',
      p.start_date   || '',
      p.due_date     || '',
      p.progress     || 0,
      p.total_budget || 0,
      p.spent_budget || 0,
      budgetPct,
      (p.members || []).length,
      `${doneDels}/${deliverables.length}`,
    ]
  })
  const csv = [headers, ...rows]
    .map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `projects_${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function PipelineCard({ project, onEdit, onDelete, canWrite, canDelete: canDel }) {
  const navigate = useNavigate()
  const status = STATUS_CONFIG[project.status] || STATUS_CONFIG.backlog
  const priority = PRIORITY_CONFIG[project.priority] || PRIORITY_CONFIG.medium
  const isOverdue = project.due_date
    && new Date(project.due_date) < new Date()
    && !['completed', 'cancelled'].includes(project.status)

  return (
    <Card
      onClick={() => navigate(`/projects/${project.id}`)}
      sx={{
        bgcolor: '#1e2029', border: '1px solid #2a2d3e',
        borderRadius: 3, mb: 1.5, cursor: 'pointer',
        transition: 'all 0.2s cubic-bezier(0.34,1.56,0.64,1)',
        '&:hover': {
          border: `1px solid ${status.color}60`,
          transform: 'translateY(-2px)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
        },
      }}
    >
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="body2" fontWeight={700} sx={{
            flex: 1, mr: 1, overflow: 'hidden',
            textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {project.name}
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5 }} onClick={e => e.stopPropagation()}>
            {canWrite && (
              <IconButton size="small" onClick={() => onEdit(project)}
                sx={{ color: '#8b8fa8', p: 0.3, '&:hover': { color: '#FFD166' } }}>
                <Edit sx={{ fontSize: 14 }} />
              </IconButton>
            )}
            {canDel && (
              <IconButton size="small" onClick={() => onDelete(project)}
                sx={{ color: '#8b8fa8', p: 0.3, '&:hover': { color: '#FF6B6B' } }}>
                <Delete sx={{ fontSize: 14 }} />
              </IconButton>
            )}
          </Box>
        </Box>

        {project.description && (
          <Typography variant="caption" color="text.secondary"
            sx={{ display: 'block', mb: 1, overflow: 'hidden',
              textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {project.description}
          </Typography>
        )}

        {project.progress > 0 && (
          <Box sx={{ mb: 1.5 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.3 }}>
              <Typography variant="caption" color="text.secondary">Progress</Typography>
              <Typography variant="caption" sx={{ color: status.color, fontWeight: 700 }}>
                {project.progress}%
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate" value={project.progress}
              sx={{
                height: 4, borderRadius: 2,
                bgcolor: '#2a2d3e',
                '& .MuiLinearProgress-bar': {
                  bgcolor: status.color,
                  borderRadius: 2,
                },
              }}
            />
          </Box>
        )}

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
            <Chip
              label={`${priority.icon} ${priority.label}`}
              size="small"
              sx={{
                bgcolor: `${priority.color}15`, color: priority.color,
                border: `1px solid ${priority.color}30`,
                fontSize: '0.6rem', height: 18, fontWeight: 700,
              }}
            />
            {project.due_date && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
                <CalendarToday sx={{ fontSize: 10, color: isOverdue ? '#FF6B6B' : '#8b8fa8' }} />
                <Typography variant="caption"
                  sx={{ color: isOverdue ? '#FF6B6B' : '#8b8fa8', fontSize: '0.65rem' }}>
                  {formatDate(project.due_date)}
                </Typography>
              </Box>
            )}
          </Box>

          {project.members?.length > 0 && (
            <AvatarGroup max={3} sx={{ '& .MuiAvatar-root': { width: 20, height: 20, fontSize: 9, border: '1px solid #1e2029' } }}>
              {project.members.map((m, i) => (
                <Tooltip key={i} title={`${m.member_name} (${m.role})`}>
                  <Avatar sx={{ bgcolor: getColor(m.member_name), color: '#13141a', fontWeight: 700 }}>
                    {(m.member_name || '?')[0].toUpperCase()}
                  </Avatar>
                </Tooltip>
              ))}
            </AvatarGroup>
          )}
        </Box>

        {project.owner_name && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
            <Person sx={{ fontSize: 12, color: '#8b8fa8' }} />
            <Typography variant="caption" color="text.secondary" fontSize="0.65rem">
              {project.owner_name}
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  )
}

function KanbanColumn({ statusKey, projects, onEdit, onDelete, canWrite, canDelete: canDel }) {
  const config = STATUS_CONFIG[statusKey]
  return (
    <Box sx={{
      minWidth: { xs: 260, md: 220, lg: 260 },
      maxWidth: 300, flex: '0 0 auto',
    }}>
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 1,
        mb: 2, px: 1,
      }}>
        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: config.color }} />
        <Typography variant="caption" fontWeight={700}
          sx={{ color: config.color, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {config.label}
        </Typography>
        <Chip label={projects.length} size="small"
          sx={{ bgcolor: config.bg, color: config.color,
            border: `1px solid ${config.color}30`,
            fontSize: '0.65rem', height: 18, fontWeight: 700, ml: 'auto' }} />
      </Box>

      <Box sx={{
        minHeight: 100,
        p: 1,
        bgcolor: '#16171f',
        borderRadius: 3,
        border: '1px solid #2a2d3e',
      }}>
        {projects.length === 0 ? (
          <Typography variant="caption" color="text.secondary"
            sx={{ display: 'block', textAlign: 'center', py: 3, opacity: 0.5 }}>
            No projects
          </Typography>
        ) : projects.map(p => (
          <PipelineCard
            key={p.id || p._id}
            project={p}
            onEdit={onEdit}
            onDelete={onDelete}
            canWrite={canWrite}
            canDelete={canDel}
          />
        ))}
      </Box>
    </Box>
  )
}

export default function ProjectsPage() {
  const { canWrite, canDelete } = useAuth()
  const navigate = useNavigate()

  const [projects, setProjects] = useState([])
  const [pipeline, setPipeline] = useState(null)
  const [teams, setTeams] = useState([])
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [view, setView] = useState('kanban')
  const [teamFilter, setTeamFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formErr, setFormErr] = useState({})
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(null)

  useEffect(() => {
    getTeams().then(setTeams).catch(() => {})
    getMembers().then(setMembers).catch(() => {})
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = {}
      if (teamFilter) params.team_id = teamFilter
      if (statusFilter) params.status = statusFilter
      const [p, pl] = await Promise.all([
        getProjects(params),
        getPipeline(),
      ])
      setProjects(p)
      setPipeline(pl)
    } catch {
      setError('Failed to load projects')
    } finally {
      setLoading(false)
    }
  }, [teamFilter, statusFilter])

  useEffect(() => { load() }, [load])

  const openCreate = () => {
    setEditing(null)
    setForm({ ...EMPTY_FORM, team_id: teamFilter || '' })
    setFormErr({})
    setOpen(true)
  }

  const openEdit = project => {
    setEditing(project)
    setForm({
      name: project.name || '',
      description: project.description || '',
      team_id: project.team_id || '',
      status: project.status || 'backlog',
      priority: project.priority || 'medium',
      owner_id: project.owner_id || '',
      owner_name: project.owner_name || '',
      start_date: project.start_date || '',
      due_date: project.due_date || '',
      progress: project.progress || 0,
      tags: (project.tags || []).join(', '),
      members: project.members || [],
    })
    setFormErr({})
    setOpen(true)
  }

  const handleSave = async () => {
    const errs = {}
    if (!form.name.trim()) errs.name = 'Name is required'
    if (!form.team_id) errs.team_id = 'Team is required'
    if (Object.keys(errs).length) {
      setFormErr(errs)
      return
    }

    setSaving(true)
    try {
      const payload = {
        ...form,
        tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        progress: parseInt(form.progress, 10) || 0,
      }
      if (editing) {
        await updateProject(editing.id, payload)
      } else {
        await createProject(payload)
      }
      setOpen(false)
      load()
    } catch (err) {
      setFormErr({ _api: err.response?.data?.error || 'Save failed' })
    } finally {
      setSaving(false)
    }
  }

  const f = key => ({
    value: form[key],
    onChange: e => setForm(p => ({ ...p, [key]: e.target.value })),
    error: !!formErr[key],
    helperText: formErr[key],
  })

  const grouped = Object.keys(STATUS_CONFIG).reduce((acc, s) => {
    acc[s] = projects.filter(p => p.status === s)
    return acc
  }, {})

  const { sorted: sortedProjects, sortBy, sortField, sortDir } = useSort(projects, 'name', 'asc')

  const pagination = usePagination(sortedProjects, 10)

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Projects & Pipeline</Typography>
          <Typography variant="body2" color="text.secondary">
            {pipeline ? `${pipeline.total} total · ${pipeline.overdue} overdue` : 'Track project status and team assignments'}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
          <ToggleButtonGroup value={view} exclusive onChange={(_, v) => v && setView(v)} size="small"
            sx={{ '& .MuiToggleButton-root': { border: '1px solid #2a2d3e', color: '#8b8fa8', borderRadius: 2, px: 1.5,
              '&.Mui-selected': { bgcolor: 'rgba(107,203,119,0.15)', color: '#6BCB77', borderColor: 'rgba(107,203,119,0.3)' } } }}>
            <ToggleButton value="kanban"><ViewKanban sx={{ fontSize: 18 }} /></ToggleButton>
            <ToggleButton value="list"><TableRows sx={{ fontSize: 18 }} /></ToggleButton>
          </ToggleButtonGroup>
          <Button
            variant="outlined" size="small"
            startIcon={<Download sx={{ fontSize: 16 }} />}
            onClick={() => exportProjectsCSV(projects)}
            sx={{
              color: '#8b8fa8', borderColor: '#2a2d3e',
              borderRadius: 2,
              '&:hover': { borderColor: '#6BCB77', color: '#6BCB77' },
            }}
          >
            Export CSV
          </Button>
          {canWrite && (
            <Button variant="contained" startIcon={<Add />} onClick={openCreate}
              sx={{ bgcolor: '#6BCB77', color: '#13141a', '&:hover': { bgcolor: '#5ab868' } }}>
              New Project
            </Button>
          )}
        </Box>
      </Box>

      {pipeline && (
        <Box sx={{ display: 'flex', gap: 1, mb: 3, flexWrap: 'wrap' }}>
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
            const count = pipeline.statuses[key]?.count || 0
            if (count === 0) return null
            return (
              <Chip key={key} label={`${cfg.label}: ${count}`} size="small"
                onClick={() => setStatusFilter(statusFilter === key ? '' : key)}
                sx={{
                  bgcolor: statusFilter === key ? cfg.bg : 'transparent',
                  color: cfg.color,
                  border: `1px solid ${cfg.color}40`,
                  fontWeight: 600, cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  '&:hover': { bgcolor: cfg.bg },
                }}
              />
            )
          })}
        </Box>
      )}

      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <TextField select label="Team" size="small" sx={{ minWidth: 180 }}
          value={teamFilter} onChange={e => setTeamFilter(e.target.value)}>
          <MenuItem value="">All teams</MenuItem>
          {teams.map(t => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
        </TextField>
        <TextField select label="Status" size="small" sx={{ minWidth: 160 }}
          value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <MenuItem value="">All statuses</MenuItem>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
            <MenuItem key={k} value={k}>{v.label}</MenuItem>
          ))}
        </TextField>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
          <CircularProgress sx={{ color: '#6BCB77' }} />
        </Box>
      ) : projects.length === 0 ? (
        <EmptyState
          icon="🚀"
          title="No projects yet"
          subtitle="Create your first project to start tracking work across teams"
          actionLabel="Create First Project"
          onAction={openCreate}
          canAct={canWrite}
        />
      ) : view === 'kanban' ? (
        <Box sx={{
          display: 'flex', gap: 2, overflowX: 'auto',
          pb: 2, px: 0.5,
          '&::-webkit-scrollbar': { height: 6 },
          '&::-webkit-scrollbar-thumb': { bgcolor: '#2a2d3e', borderRadius: 3 },
        }}>
          {Object.keys(STATUS_CONFIG).map(statusKey => (
            <KanbanColumn
              key={statusKey}
              statusKey={statusKey}
              projects={grouped[statusKey] || []}
              onEdit={openEdit}
              onDelete={setDeleting}
              canWrite={canWrite}
              canDelete={canDelete}
            />
          ))}
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {pagination.paginated.map(p => {
            const status = STATUS_CONFIG[p.status] || STATUS_CONFIG.backlog
            const priority = PRIORITY_CONFIG[p.priority] || PRIORITY_CONFIG.medium
            const isOverdue = p.due_date
              && new Date(p.due_date) < new Date()
              && !['completed', 'cancelled'].includes(p.status)

            return (
              <Card key={p.id} sx={{
                bgcolor: '#1e2029', border: '1px solid #2a2d3e',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                '&:hover': { border: `1px solid ${status.color}50`, transform: 'translateX(4px)' },
              }} onClick={() => navigate(`/projects/${p.id}`)}>
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                    <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: status.color, flexShrink: 0 }} />

                    <Typography variant="body2" fontWeight={700} sx={{ flex: 1, minWidth: 150 }}>
                      {p.name}
                    </Typography>

                    <Chip label={status.label} size="small"
                      sx={{ bgcolor: status.bg, color: status.color,
                        border: `1px solid ${status.color}30`, fontSize: '0.7rem', fontWeight: 600 }} />

                    <Chip label={`${priority.icon} ${priority.label}`} size="small"
                      sx={{ bgcolor: `${priority.color}15`, color: priority.color,
                        border: `1px solid ${priority.color}30`, fontSize: '0.65rem' }} />

                    <Box sx={{ width: 80, display: { xs: 'none', md: 'block' } }}>
                      <LinearProgress variant="determinate" value={p.progress || 0}
                        sx={{ height: 4, borderRadius: 2, bgcolor: '#2a2d3e',
                          '& .MuiLinearProgress-bar': { bgcolor: status.color, borderRadius: 2 } }} />
                    </Box>
                    <Typography variant="caption" sx={{ color: status.color, fontWeight: 700, minWidth: 32 }}>
                      {p.progress || 0}%
                    </Typography>

                    {p.owner_name && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Avatar sx={{ width: 22, height: 22, bgcolor: `${getColor(p.owner_name)}20`,
                          color: getColor(p.owner_name), fontSize: 10, fontWeight: 700 }}>
                          {p.owner_name[0].toUpperCase()}
                        </Avatar>
                        <Typography variant="caption" color="text.secondary">{p.owner_name}</Typography>
                      </Box>
                    )}

                    {p.due_date && (
                      <Typography variant="caption"
                        sx={{ color: isOverdue ? '#FF6B6B' : '#8b8fa8', fontSize: '0.7rem' }}>
                        {isOverdue ? '⚠ ' : ''}{formatDate(p.due_date)}
                      </Typography>
                    )}

                    {p.members?.length > 0 && (
                      <AvatarGroup max={4} sx={{ '& .MuiAvatar-root': { width: 22, height: 22, fontSize: 10, border: '1px solid #1e2029' } }}>
                        {p.members.map((m, i) => (
                          <Tooltip key={i} title={m.member_name}>
                            <Avatar sx={{ bgcolor: getColor(m.member_name), color: '#13141a', fontWeight: 700 }}>
                              {(m.member_name || '?')[0].toUpperCase()}
                            </Avatar>
                          </Tooltip>
                        ))}
                      </AvatarGroup>
                    )}

                    <Box onClick={e => e.stopPropagation()}>
                      {canWrite && (
                        <IconButton size="small" onClick={() => openEdit(p)}
                          sx={{ color: '#8b8fa8', '&:hover': { color: '#FFD166' } }}>
                          <Edit sx={{ fontSize: 16 }} />
                        </IconButton>
                      )}
                      {canDelete && (
                        <IconButton size="small" onClick={() => setDeleting(p)}
                          sx={{ color: '#8b8fa8', '&:hover': { color: '#FF6B6B' } }}>
                          <Delete sx={{ fontSize: 16 }} />
                        </IconButton>
                      )}
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            )
          })}
          </Box>
          <Box sx={{ bgcolor: '#1e2029', border: '1px solid #2a2d3e',
            borderTop: 'none', borderRadius: '0 0 8px 8px' }}>
            <Pagination {...pagination} pageSizeOptions={[10, 20, 50]} />
          </Box>
        </Box>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Edit Project' : 'New Project'}</DialogTitle>
        <DialogContent>
          {formErr._api && <Alert severity="error" sx={{ mb: 1 }}>{formErr._api}</Alert>}
          <Grid container spacing={1} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <TextField label="Project Name" fullWidth margin="dense" required {...f('name')} />
            </Grid>
            <Grid item xs={12}>
              <TextField label="Description" fullWidth margin="dense" multiline rows={2} {...f('description')} />
            </Grid>
            <Grid item xs={12}>
              <TextField select label="Team" fullWidth margin="dense" required {...f('team_id')}>
                <MenuItem value="">Select team</MenuItem>
                {teams.map(t => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={6}>
              <TextField select label="Status" fullWidth margin="dense" {...f('status')}>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                  <MenuItem key={k} value={k}>{v.label}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={6}>
              <TextField select label="Priority" fullWidth margin="dense" {...f('priority')}>
                {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
                  <MenuItem key={k} value={k}>{v.icon} {v.label}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField select label="Project Owner" fullWidth margin="dense"
                value={form.owner_id}
                onChange={e => {
                  const member = members.find(m => m.id === e.target.value)
                  setForm(p => ({ ...p, owner_id: e.target.value, owner_name: member?.name || '' }))
                }}>
                <MenuItem value="">No owner assigned</MenuItem>
                {members.map(m => <MenuItem key={m.id} value={m.id}>{m.name}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={6}>
              <TextField label="Start Date" type="date" fullWidth margin="dense"
                InputLabelProps={{ shrink: true }} {...f('start_date')} />
            </Grid>
            <Grid item xs={6}>
              <TextField label="Due Date" type="date" fullWidth margin="dense"
                InputLabelProps={{ shrink: true }} {...f('due_date')} />
            </Grid>
            <Grid item xs={12}>
              <TextField label="Progress (%)" type="number" fullWidth margin="dense"
                inputProps={{ min: 0, max: 100 }} {...f('progress')} />
            </Grid>
            <Grid item xs={12}>
              <TextField label="Tags (comma separated)" fullWidth margin="dense"
                placeholder="frontend, api, urgent" {...f('tags')} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOpen(false)} sx={{ color: '#8b8fa8' }}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}
            sx={{ bgcolor: '#6BCB77', color: '#13141a', '&:hover': { bgcolor: '#5ab868' } }}>
            {saving ? <CircularProgress size={18} sx={{ color: '#13141a' }} /> : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        title="Delete Project"
        message={`Delete "${deleting?.name}"? This cannot be undone.`}
        onConfirm={async () => { await deleteProject(deleting.id); setDeleting(null); load() }}
        onCancel={() => setDeleting(null)}
      />
    </Box>
  )
}
