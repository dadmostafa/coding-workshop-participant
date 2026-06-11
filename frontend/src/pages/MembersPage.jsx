import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  Box, Typography, Button, TextField, InputAdornment,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, IconButton, Chip, CircularProgress, Alert, Dialog,
  DialogTitle, DialogContent, DialogActions, Grid, Tooltip,
  MenuItem, FormControlLabel, Checkbox, Avatar,
} from '@mui/material'
import {
  Add, Edit, Delete, Search, Download,
} from '@mui/icons-material'
import {
  getMembers, createMember, updateMember, deleteMember,
  getTeams, getProjects,
} from '../services/api'
import { useAuth }       from '../context/AuthContext'
import ConfirmDialog     from '../components/ConfirmDialog'
import EmptyState        from '../components/EmptyState'
import { useSort }      from '../hooks/useSort'
import SortHeader       from '../components/SortHeader'

const EMPTY = {
  name: '', email: '', role: '', location: '',
  team_id: '', employment_type: 'direct',
  is_team_leader: false, start_date: '',
}

const AVATAR_COLORS = ['#FF6B6B','#FFD166','#6BCB77','#4ECDC4','#A29BFE','#74B9FF','#FF9F43','#FD79A8']
const getColor = name => AVATAR_COLORS[(name?.charCodeAt(0) || 0) % AVATAR_COLORS.length]

// ── CSV Export ────────────────────────────────────────────────────────────────
function exportToCSV(members, memberProjects) {
  const headers = [
    'Name', 'Email', 'Role', 'Location', 'Employment Type',
    'Team Leader', 'Start Date', 'Active Projects', 'Project Names',
  ]

  const rows = members.map(m => {
    const projects = memberProjects[m.id] || []
    return [
      m.name                 || '',
      m.email                || '',
      m.role                 || '',
      m.location             || '',
      m.employment_type      || 'direct',
      m.is_team_leader ? 'Yes' : 'No',
      m.start_date           || '',
      projects.length,
      projects.map(p => p.name).join(' | '),
    ]
  })

  const csv = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href     = url
  link.download = `resources_${new Date().toISOString().split('T')[0]}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

export default function MembersPage() {
  const { canWrite, canDelete } = useAuth()
  const navigate     = useNavigate()
  const [searchParams] = useSearchParams()

  const [members,      setMembers]      = useState([])
  const [teams,        setTeams]        = useState([])
  const [memberProjects, setMemberProjects] = useState({})  // memberId → projects[]
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState('')
  const [search,       setSearch]       = useState('')
  const [teamFilter,   setTeamFilter]   = useState(searchParams.get('team_id') || '')
  const [typeFilter,   setTypeFilter]   = useState('')
  const [open,         setOpen]         = useState(false)
  const [editing,      setEditing]      = useState(null)
  const [form,         setForm]         = useState(EMPTY)
  const [formErr,      setFormErr]      = useState({})
  const [saving,       setSaving]       = useState(false)
  const [deleting,     setDeleting]     = useState(null)

  useEffect(() => {
    getTeams().then(setTeams).catch(() => {})
  }, [])

  // Build member → projects map
  useEffect(() => {
    getProjects().then(projects => {
      const map = {}
      projects.forEach(p => {
        if (!['completed','cancelled'].includes(p.status)) {
          (p.members || []).forEach(m => {
            if (!map[m.member_id]) map[m.member_id] = []
            map[m.member_id].push({ id: p.id, name: p.name, status: p.status, priority: p.priority })
          })
        }
      })
      setMemberProjects(map)
    }).catch(() => {})
  }, [])

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const params = {}
      if (teamFilter) params.team_id = teamFilter
      if (search)     params.search  = search
      setMembers(await getMembers(params))
    } catch { setError('Failed to load resources') }
    finally { setLoading(false) }
  }, [teamFilter, search])

  useEffect(() => { load() }, [load])

  const openCreate = () => {
    setEditing(null)
    setForm({ ...EMPTY, team_id: teamFilter || '' })
    setFormErr({})
    setOpen(true)
  }

  const openEdit = m => {
    setEditing(m)
    setForm({
      name:            m.name            || '',
      email:           m.email           || '',
      role:            m.role            || '',
      location:        m.location        || '',
      team_id:         m.team_id         || '',
      employment_type: m.employment_type || 'direct',
      is_team_leader:  m.is_team_leader  || false,
      start_date:      m.start_date      || '',
    })
    setFormErr({})
    setOpen(true)
  }

  const handleSave = async () => {
    const e = {}
    if (!form.name.trim()) e.name    = 'Name is required'
    if (!form.team_id)     e.team_id = 'Team is required'
    if (Object.keys(e).length) { setFormErr(e); return }
    setSaving(true)
    try {
      editing
        ? await updateMember(editing.id, form)
        : await createMember(form)
      setOpen(false); load()
    } catch (err) {
      setFormErr({ _api: err.response?.data?.error || 'Save failed' })
    } finally { setSaving(false) }
  }

  const f = key => ({
    value:      form[key],
    onChange:   e => setForm(p => ({ ...p, [key]: e.target.value })),
    error:      !!formErr[key],
    helperText: formErr[key],
  })

  // Filter by type client-side
  const filtered = typeFilter
    ? members.filter(m => m.employment_type === typeFilter)
    : members

  const { sorted: sortedMembers, sortBy, sortField, sortDir } = useSort(filtered, 'name', 'asc')

  const overAllocated = Object.entries(memberProjects)
    .filter(([, ps]) => ps.length >= 2)
    .map(([id]) => id)

  const STATUS_COLORS = {
    in_progress: '#FFD166',
    review:      '#A29BFE',
    planning:    '#74B9FF',
    backlog:     '#8b8fa8',
    on_hold:     '#FF9F43',
  }

  const PRIORITY_ICONS = {
    critical: '⬆',
    high:     '▲',
    medium:   '△',
    low:      '▽',
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Resources</Typography>
          <Box sx={{ display: 'flex', gap: 1, mt: 0.5, alignItems: 'center', flexWrap: 'wrap' }}>
            <Typography variant="body2" color="text.secondary">
              {filtered.length} people
            </Typography>
            {overAllocated.length > 0 && (
              <Chip
                label={`${overAllocated.length} over-allocated`}
                size="small"
                sx={{
                  bgcolor: 'rgba(255,107,107,0.12)', color: '#FF6B6B',
                  border: '1px solid rgba(255,107,107,0.25)',
                  fontSize: '0.7rem', height: 20,
                }}
              />
            )}
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined" size="small"
            startIcon={<Download sx={{ fontSize: 16 }} />}
            onClick={() => exportToCSV(filtered, memberProjects)}
            sx={{
              color: '#8b8fa8', borderColor: '#2a2d3e',
              borderRadius: 2, fontSize: '0.8rem',
              '&:hover': { borderColor: '#6BCB77', color: '#6BCB77' },
            }}
          >
            Export CSV
          </Button>
          {canWrite && (
            <Button variant="contained" startIcon={<Add />} onClick={openCreate}
              sx={{ bgcolor: '#6BCB77', color: '#13141a', fontWeight: 700,
                '&:hover': { bgcolor: '#5ab868' } }}>
              Add Resource
            </Button>
          )}
        </Box>
      </Box>

      {/* Filters */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <TextField
          placeholder="Search resources…" value={search}
          onChange={e => setSearch(e.target.value)}
          size="small" sx={{ width: 240 }}
          InputProps={{ startAdornment:
            <InputAdornment position="start">
              <Search sx={{ color: '#8b8fa8', fontSize: 18 }} />
            </InputAdornment>
          }}
        />
        <TextField select label="Team" size="small" sx={{ minWidth: 180 }}
          value={teamFilter} onChange={e => setTeamFilter(e.target.value)}>
          <MenuItem value="">All teams</MenuItem>
          {teams.map(t => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
        </TextField>
        <TextField select label="Type" size="small" sx={{ minWidth: 150 }}
          value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <MenuItem value="">All types</MenuItem>
          <MenuItem value="direct">Employee</MenuItem>
          <MenuItem value="non-direct">Contractor</MenuItem>
        </TextField>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TableContainer component={Paper}
        sx={{ bgcolor: '#1e2029', border: '1px solid #2a2d3e', borderRadius: 2 }}>
        <Table sx={{ tableLayout: 'fixed' }}>
          <TableHead>
            <TableRow>
              <SortHeader label="Resource"        field="name"             sortField={sortField} sortDir={sortDir} onSort={sortBy} sx={{ width: '22%' }} />
              <SortHeader label="Role"            field="role"             sortField={sortField} sortDir={sortDir} onSort={sortBy} sx={{ width: '12%' }} />
              <SortHeader label="Location"        field="location"         sortField={sortField} sortDir={sortDir} onSort={sortBy} sx={{ width: '11%' }} />
              <SortHeader label="Type"            field="employment_type"  sortField={sortField} sortDir={sortDir} onSort={sortBy} sx={{ width: '10%' }} />
              <TableCell sx={{ width: '35%' }}>Active Projects</TableCell>
              <TableCell sx={{ width: '10%' }} align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                  <CircularProgress size={28} sx={{ color: '#6BCB77' }} />
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} sx={{ border: 'none', p: 0 }}>
                  <EmptyState
                    icon="👤"
                    title="No resources found"
                    subtitle="Add your first team member to get started"
                    actionLabel="Add Resource"
                    onAction={openCreate}
                    canAct={canWrite}
                  />
                </TableCell>
              </TableRow>
            ) : sortedMembers.map(m => {
              const color        = getColor(m.name)
              const projects     = memberProjects[m.id] || []
              const isOverAlloc  = projects.length >= 2
              const isContractor = m.employment_type === 'non-direct'

              return (
                <TableRow key={m.id} sx={{ height: 60 }}>

                  {/* Resource */}
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                      <Avatar sx={{
                        width: 32, height: 32, flexShrink: 0,
                        bgcolor: `${color}20`, color,
                        fontSize: 13, fontWeight: 700,
                        border: `1px solid ${color}40`,
                      }}>
                        {m.name[0].toUpperCase()}
                      </Avatar>
                      <Box sx={{ minWidth: 0 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                          <Typography variant="body2" fontWeight={600} noWrap sx={{ maxWidth: 130 }}>
                            {m.name}
                          </Typography>
                          {m.is_team_leader && (
                            <Chip label="Lead" size="small" sx={{
                              bgcolor: 'rgba(107,203,119,0.12)', color: '#6BCB77',
                              border: '1px solid rgba(107,203,119,0.25)',
                              fontSize: '0.58rem', height: 16, fontWeight: 700,
                            }} />
                          )}
                          {isOverAlloc && (
                            <Tooltip title="Allocated to 2+ active projects">
                              <Chip label="Over-allocated" size="small" sx={{
                                bgcolor: 'rgba(255,107,107,0.12)', color: '#FF6B6B',
                                border: '1px solid rgba(255,107,107,0.25)',
                                fontSize: '0.58rem', height: 16, fontWeight: 700,
                              }} />
                            </Tooltip>
                          )}
                        </Box>
                        {m.email && (
                          <Typography variant="caption" color="text.secondary" noWrap
                            sx={{ maxWidth: 150, display: 'block' }}>
                            {m.email}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </TableCell>

                  {/* Role */}
                  <TableCell>
                    <Typography variant="body2" color="text.secondary" noWrap
                      sx={{ maxWidth: 110 }}>
                      {m.role || '—'}
                    </Typography>
                  </TableCell>

                  {/* Location */}
                  <TableCell>
                    <Typography variant="body2" color="text.secondary" noWrap>
                      {m.location || '—'}
                    </Typography>
                  </TableCell>

                  {/* Type */}
                  <TableCell>
                    <Chip
                      label={isContractor ? 'Contractor' : 'Employee'}
                      size="small"
                      sx={{
                        bgcolor: isContractor
                          ? 'rgba(255,159,67,0.12)' : 'rgba(107,203,119,0.12)',
                        color: isContractor ? '#FF9F43' : '#6BCB77',
                        border: `1px solid ${isContractor
                          ? 'rgba(255,159,67,0.25)' : 'rgba(107,203,119,0.25)'}`,
                        fontSize: '0.68rem', fontWeight: 600,
                      }}
                    />
                  </TableCell>

                  {/* Active Projects — badges */}
                  <TableCell>
                    {projects.length === 0 ? (
                      <Typography variant="caption" color="text.secondary">
                        Not assigned
                      </Typography>
                    ) : (
                      <Box sx={{ display: 'flex', gap: 0.6, flexWrap: 'wrap' }}>
                        {projects.map(p => {
                          const statusColor   = STATUS_COLORS[p.status]   || '#8b8fa8'
                          const priorityIcon  = PRIORITY_ICONS[p.priority] || '△'
                          return (
                            <Tooltip key={p.id} title={`${p.name} — ${p.status.replace('_',' ')} · ${p.priority} priority`}>
                              <Chip
                                label={
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
                                    <Box sx={{ width: 5, height: 5, borderRadius: '50%',
                                      bgcolor: statusColor, flexShrink: 0 }} />
                                    <Typography noWrap sx={{
                                      fontSize: '0.65rem', maxWidth: 90,
                                      overflow: 'hidden', textOverflow: 'ellipsis',
                                    }}>
                                      {p.name}
                                    </Typography>
                                    <Typography sx={{ fontSize: '0.6rem', color: PRIORITY_ICONS[p.priority] === '⬆' ? '#FF6B6B' : '#FFD166' }}>
                                      {priorityIcon}
                                    </Typography>
                                  </Box>
                                }
                                size="small"
                                onClick={() => navigate(`/projects/${p.id}`)}
                                sx={{
                                  bgcolor: `${statusColor}10`,
                                  border:  `1px solid ${statusColor}30`,
                                  color:   statusColor,
                                  height:  22, cursor: 'pointer',
                                  '& .MuiChip-label': { px: 0.8 },
                                  '&:hover': { bgcolor: `${statusColor}20` },
                                  transition: 'all 0.15s ease',
                                }}
                              />
                            </Tooltip>
                          )
                        })}
                      </Box>
                    )}
                  </TableCell>

                  {/* Actions */}
                  <TableCell align="right">
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.3 }}>
                      {canWrite && (
                        <Tooltip title="Edit">
                          <IconButton size="small" onClick={() => openEdit(m)}
                            sx={{ color: '#8b8fa8', '&:hover': { color: '#FFD166' } }}>
                            <Edit sx={{ fontSize: 15 }} />
                          </IconButton>
                        </Tooltip>
                      )}
                      {canDelete && (
                        <Tooltip title="Remove">
                          <IconButton size="small" onClick={() => setDeleting(m)}
                            sx={{ color: '#8b8fa8', '&:hover': { color: '#FF6B6B' } }}>
                            <Delete sx={{ fontSize: 15 }} />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Create / Edit Dialog */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Edit Resource' : 'Add Resource'}</DialogTitle>
        <DialogContent>
          {formErr._api && <Alert severity="error" sx={{ mb: 1.5 }}>{formErr._api}</Alert>}
          <Grid container spacing={1.5} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <TextField label="Full Name" fullWidth required {...f('name')} />
            </Grid>
            <Grid item xs={12}>
              <TextField select label="Team" fullWidth required {...f('team_id')}>
                <MenuItem value="">Select team</MenuItem>
                {teams.map(t => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={6}>
              <TextField label="Email" fullWidth {...f('email')} />
            </Grid>
            <Grid item xs={6}>
              <TextField label="Job Title / Role" fullWidth {...f('role')} />
            </Grid>
            <Grid item xs={6}>
              <TextField label="Location" fullWidth {...f('location')} />
            </Grid>
            <Grid item xs={6}>
              <TextField select label="Employment Type" fullWidth {...f('employment_type')}>
                <MenuItem value="direct">Employee</MenuItem>
                <MenuItem value="non-direct">Contractor</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={6}>
              <TextField label="Start Date" type="date" fullWidth
                InputLabelProps={{ shrink: true }} {...f('start_date')} />
            </Grid>
            <Grid item xs={6} sx={{ display: 'flex', alignItems: 'center' }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={form.is_team_leader}
                    onChange={e => setForm(p => ({ ...p, is_team_leader: e.target.checked }))}
                    sx={{ color: '#6BCB77', '&.Mui-checked': { color: '#6BCB77' } }}
                  />
                }
                label="Team Leader"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOpen(false)} sx={{ color: '#8b8fa8' }}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}
            sx={{ bgcolor: '#6BCB77', color: '#13141a', fontWeight: 700,
              '&:hover': { bgcolor: '#5ab868' } }}>
            {saving ? <CircularProgress size={18} sx={{ color: '#13141a' }} /> : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        title="Remove Resource"
        message={`Remove "${deleting?.name}" from the system? This will also remove them from any projects they are assigned to.`}
        onConfirm={async () => { await deleteMember(deleting.id); setDeleting(null); load() }}
        onCancel={() => setDeleting(null)}
      />
    </Box>
  )
}
