import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Typography, Button, TextField, InputAdornment,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, IconButton, Chip, CircularProgress, Alert, Dialog,
  DialogTitle, DialogContent, DialogActions, Grid, Tooltip, Avatar,
} from '@mui/material'
import {
  Add, Search, Edit, Delete, ArrowForwardIos,
  CheckCircle, Warning, Error,
} from '@mui/icons-material'
import { getTeams, createTeam, updateTeam, deleteTeam } from '../services/api'
import { useAuth } from '../context/AuthContext'
import ConfirmDialog from '../components/ConfirmDialog'
import { toastSuccess, toastError } from '../utils/toast'

const TEAM_COLORS = ['#FF6B6B','#FFD166','#6BCB77','#4ECDC4','#A29BFE','#74B9FF','#FF9F43','#FD79A8']
const getColor    = name => TEAM_COLORS[(name?.charCodeAt(0) || 0) % TEAM_COLORS.length]

const EMPTY = {
  name: '', description: '', location: '',
  department: '', team_leader: '', leader_location: '', org_leader: '',
}

// ── Health Badge — tooltip only, no inline expansion ─────────────────────────
function HealthBadge({ health }) {
  if (!health) return null

  const config = {
    healthy:  { icon: <CheckCircle sx={{ fontSize: 13 }} />, color: '#6BCB77', label: 'Healthy'  },
    warning:  { icon: <Warning     sx={{ fontSize: 13 }} />, color: '#FFD166', label: 'Warning'  },
    critical: { icon: <Error       sx={{ fontSize: 13 }} />, color: '#FF6B6B', label: 'Critical' },
  }
  const cfg = config[health.status] || config.healthy

  const issues = [
    ...(health.errors   || []).map(e => `❌ ${e.message}`),
    ...(health.warnings || []).map(w => `⚠️ ${w.message}`),
  ]

  const tooltipContent = issues.length > 0
    ? issues.join('\n')
    : 'Team is healthy'

  const issueCount = issues.length

  return (
    <Tooltip
      title={
        <Box sx={{ whiteSpace: 'pre-line', fontSize: '0.75rem', p: 0.5 }}>
          {tooltipContent}
        </Box>
      }
      arrow
      placement="left"
    >
      <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.8, cursor: 'help' }}>
        <Chip
          icon={cfg.icon}
          label={issueCount > 0 ? `${issueCount} issue${issueCount > 1 ? 's' : ''}` : cfg.label}
          size="small"
          sx={{
            bgcolor: `${cfg.color}15`,
            color:   cfg.color,
            border:  `1px solid ${cfg.color}30`,
            fontSize: '0.68rem', fontWeight: 600, height: 22,
            '& .MuiChip-icon': { color: cfg.color, fontSize: 13 },
          }}
        />
      </Box>
    </Tooltip>
  )
}

export default function TeamsPage() {
  const { canWrite, canDelete } = useAuth()
  const navigate = useNavigate()

  const [teams,    setTeams]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')
  const [search,   setSearch]   = useState('')
  const [open,     setOpen]     = useState(false)
  const [editing,  setEditing]  = useState(null)
  const [form,     setForm]     = useState(EMPTY)
  const [formErr,  setFormErr]  = useState({})
  const [saving,   setSaving]   = useState(false)
  const [deleting, setDeleting] = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { setTeams(await getTeams(search ? { search } : {})) }
    catch { setError('Failed to load teams') }
    finally { setLoading(false) }
  }, [search])

  useEffect(() => { load() }, [load])

  const openCreate = () => {
    setEditing(null); setForm(EMPTY); setFormErr({}); setOpen(true)
  }
  const openEdit = t => {
    setEditing(t)
    setForm({
      name:            t.name            || '',
      description:     t.description     || '',
      location:        t.location        || '',
      department:      t.department      || '',
      team_leader:     t.team_leader     || '',
      leader_location: t.leader_location || '',
      org_leader:      t.org_leader      || '',
    })
    setFormErr({}); setOpen(true)
  }

  const handleSave = async () => {
    const e = {}
    if (!form.name.trim())        e.name        = 'Team name is required'
    if (!form.team_leader.trim()) e.team_leader = 'Team leader is required'
    if (!form.location.trim())    e.location    = 'Location is required'
    if (!form.department.trim())  e.department  = 'Department is required'
    if (Object.keys(e).length) { setFormErr(e); return }
    setSaving(true)
    try {
      if (editing) {
        await updateTeam(editing.id, form)
        toastSuccess(`"${form.name}" updated`)
      } else {
        await createTeam(form)
        toastSuccess(`"${form.name}" team created`)
      }
      setOpen(false); load()
    } catch (err) {
      setFormErr({ _api: err.response?.data?.error || 'Save failed' })
      toastError(err.response?.data?.error || 'Failed to save team')
    } finally { setSaving(false) }
  }

  const f = key => ({
    value:      form[key],
    onChange:   e => setForm(p => ({ ...p, [key]: e.target.value })),
    error:      !!formErr[key],
    helperText: formErr[key],
  })

  const healthCounts = teams.reduce((acc, t) => {
    const s = t.health?.status || 'healthy'
    acc[s]  = (acc[s] || 0) + 1
    return acc
  }, {})

  return (
    <Box>
      {/* Header */}
      <Box sx={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'flex-start', mb: 3,
      }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Teams</Typography>
          <Box sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              {teams.length} teams
            </Typography>
            {healthCounts.critical > 0 && (
              <Chip label={`${healthCounts.critical} critical`} size="small"
                sx={{ bgcolor: 'rgba(255,107,107,0.12)', color: '#FF6B6B',
                  border: '1px solid rgba(255,107,107,0.25)', fontSize: '0.7rem', height: 20 }} />
            )}
            {healthCounts.warning > 0 && (
              <Chip label={`${healthCounts.warning} warnings`} size="small"
                sx={{ bgcolor: 'rgba(255,209,102,0.12)', color: '#FFD166',
                  border: '1px solid rgba(255,209,102,0.25)', fontSize: '0.7rem', height: 20 }} />
            )}
            {healthCounts.healthy > 0 && (
              <Chip label={`${healthCounts.healthy} healthy`} size="small"
                sx={{ bgcolor: 'rgba(107,203,119,0.12)', color: '#6BCB77',
                  border: '1px solid rgba(107,203,119,0.25)', fontSize: '0.7rem', height: 20 }} />
            )}
          </Box>
        </Box>
        {canWrite && (
          <Button variant="contained" startIcon={<Add />} onClick={openCreate}
            sx={{ bgcolor: '#6BCB77', color: '#13141a', fontWeight: 700,
              '&:hover': { bgcolor: '#5ab868' } }}>
            New Team
          </Button>
        )}
      </Box>

      {/* Search */}
      <TextField
        placeholder="Search teams…" value={search}
        onChange={e => setSearch(e.target.value)}
        size="small" sx={{ mb: 3, width: 300 }}
        InputProps={{ startAdornment:
          <InputAdornment position="start">
            <Search sx={{ color: '#8b8fa8', fontSize: 18 }} />
          </InputAdornment>
        }}
      />

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TableContainer component={Paper}
        sx={{ bgcolor: '#1e2029', border: '1px solid #2a2d3e', borderRadius: 2 }}>
        <Table sx={{ tableLayout: 'fixed' }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: '22%' }}>Team</TableCell>
              <TableCell sx={{ width: '13%' }}>Department</TableCell>
              <TableCell sx={{ width: '12%' }}>Location</TableCell>
              <TableCell sx={{ width: '16%' }}>Leader</TableCell>
              <TableCell sx={{ width: '8%'  }}>Members</TableCell>
              <TableCell sx={{ width: '16%' }}>Org Leader</TableCell>
              <TableCell sx={{ width: '8%'  }}>Health</TableCell>
              <TableCell sx={{ width: '5%'  }} align="right" />
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 6 }}>
                  <CircularProgress size={28} sx={{ color: '#6BCB77' }} />
                </TableCell>
              </TableRow>
            ) : teams.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center"
                  sx={{ py: 6, color: '#8b8fa8' }}>
                  No teams yet — create your first one
                </TableCell>
              </TableRow>
            ) : teams.map(t => (
              <TableRow key={t.id} sx={{ height: 56 }}>

                {/* Team name + avatar */}
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                    <Avatar sx={{
                      width: 30, height: 30, flexShrink: 0,
                      bgcolor: `${getColor(t.name)}20`,
                      color:   getColor(t.name),
                      fontSize: 12, fontWeight: 700,
                      border: `1px solid ${getColor(t.name)}40`,
                    }}>
                      {t.name[0].toUpperCase()}
                    </Avatar>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={600}
                        noWrap sx={{ maxWidth: 160 }}>
                        {t.name}
                      </Typography>
                      {t.description && (
                        <Typography variant="caption" color="text.secondary"
                          noWrap sx={{ maxWidth: 160, display: 'block' }}>
                          {t.description}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                </TableCell>

                {/* Department */}
                <TableCell>
                  <Typography variant="body2" color="text.secondary" noWrap>
                    {t.department || '—'}
                  </Typography>
                </TableCell>

                {/* Location */}
                <TableCell>
                  <Typography variant="body2" color="text.secondary" noWrap>
                    {t.location || '—'}
                  </Typography>
                </TableCell>

                {/* Leader */}
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                    {t.health?.has_leader ? (
                      <Typography variant="body2" color="text.secondary" noWrap
                        sx={{ maxWidth: 120 }}>
                        {t.team_leader || '—'}
                      </Typography>
                    ) : (
                      <Chip label="No leader" size="small"
                        sx={{ bgcolor: 'rgba(255,107,107,0.12)', color: '#FF6B6B',
                          border: '1px solid rgba(255,107,107,0.25)',
                          fontSize: '0.65rem', fontWeight: 600, height: 20 }} />
                    )}
                    {t.leader_location && t.location &&
                     t.leader_location.toLowerCase() !== t.location.toLowerCase() && (
                      <Chip label="remote" size="small"
                        sx={{ bgcolor: 'rgba(255,159,67,0.1)', color: '#FF9F43',
                          border: '1px solid rgba(255,159,67,0.25)',
                          fontSize: '0.6rem', height: 18 }} />
                    )}
                  </Box>
                </TableCell>

                {/* Members count */}
                <TableCell>
                  <Chip
                    label={t.health?.member_count ?? '—'}
                    size="small"
                    sx={{
                      bgcolor: (t.health?.member_count || 0) < 5
                        ? 'rgba(255,107,107,0.12)' : 'rgba(107,203,119,0.12)',
                      color: (t.health?.member_count || 0) < 5
                        ? '#FF6B6B' : '#6BCB77',
                      border: `1px solid ${(t.health?.member_count || 0) < 5
                        ? 'rgba(255,107,107,0.25)' : 'rgba(107,203,119,0.25)'}`,
                      fontWeight: 700, height: 22,
                    }}
                  />
                </TableCell>

                {/* Org leader */}
                <TableCell>
                  <Typography variant="body2" color="text.secondary" noWrap
                    sx={{ maxWidth: 130 }}>
                    {t.org_leader || '—'}
                  </Typography>
                </TableCell>

                {/* Health badge — tooltip only */}
                <TableCell>
                  <HealthBadge health={t.health} />
                </TableCell>

                {/* Actions */}
                <TableCell align="right" sx={{ pr: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.3 }}>
                    <Tooltip title="View">
                      <IconButton size="small"
                        onClick={() => navigate(`/teams/${t.id}`)}
                        sx={{ color: '#8b8fa8', '&:hover': { color: '#6BCB77' } }}>
                        <ArrowForwardIos sx={{ fontSize: 12 }} />
                      </IconButton>
                    </Tooltip>
                    {canWrite && (
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => openEdit(t)}
                          sx={{ color: '#8b8fa8', '&:hover': { color: '#FFD166' } }}>
                          <Edit sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Tooltip>
                    )}
                    {canDelete && (
                      <Tooltip title="Delete">
                        <IconButton size="small" onClick={() => setDeleting(t)}
                          sx={{ color: '#8b8fa8', '&:hover': { color: '#FF6B6B' } }}>
                          <Delete sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Create / Edit dialog */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ pb: 0.5 }}>
          {editing ? 'Edit Team' : 'New Team'}
        </DialogTitle>

        {!editing && (
          <Box sx={{ px: 3, py: 1 }}>
            <Alert severity="info" sx={{
              bgcolor: 'rgba(78,205,196,0.08)', color: '#4ECDC4',
              border: '1px solid rgba(78,205,196,0.2)', fontSize: '0.8rem',
              '& .MuiAlert-icon': { color: '#4ECDC4' },
            }}>
              Required: name, department, location, and leader.
              Teams need at least 5 members to be fully staffed.
            </Alert>
          </Box>
        )}

        <DialogContent>
          {formErr._api && (
            <Alert severity="error" sx={{ mb: 1.5 }}>{formErr._api}</Alert>
          )}
          <Grid container spacing={1.5} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <TextField label="Team Name" fullWidth required {...f('name')} />
            </Grid>
            <Grid item xs={12}>
              <TextField label="Description" fullWidth multiline rows={2}
                {...f('description')} />
            </Grid>
            <Grid item xs={6}>
              <TextField label="Department" fullWidth required
                {...f('department')}
                helperText={formErr.department || 'e.g. Technology, Product'} />
            </Grid>
            <Grid item xs={6}>
              <TextField label="Team Location" fullWidth required
                {...f('location')}
                helperText={formErr.location || 'e.g. New York, Remote'} />
            </Grid>
            <Grid item xs={6}>
              <TextField label="Team Leader" fullWidth required
                {...f('team_leader')}
                helperText={formErr.team_leader || 'Required for every team'} />
            </Grid>
            <Grid item xs={6}>
              <TextField label="Leader Location" fullWidth
                {...f('leader_location')}
                helperText="Where the leader is based" />
            </Grid>
            <Grid item xs={12}>
              <TextField label="Org Leader / Executive Sponsor" fullWidth
                {...f('org_leader')}
                helperText="Executive this team reports to" />
            </Grid>
          </Grid>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setOpen(false)} sx={{ color: '#8b8fa8' }}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}
            sx={{ bgcolor: '#6BCB77', color: '#13141a', fontWeight: 700,
              '&:hover': { bgcolor: '#5ab868' } }}>
            {saving
              ? <CircularProgress size={18} sx={{ color: '#13141a' }} />
              : editing ? 'Save Changes' : 'Create Team'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        title="Delete Team"
        message={`Delete "${deleting?.name}"? This will affect all members and projects on this team.`}
        onConfirm={async () => {
          try {
            await deleteTeam(deleting.id)
            toastSuccess(`"${deleting.name}" deleted`)
            setDeleting(null)
            load()
          } catch {
            toastError('Failed to delete team')
            setDeleting(null)
          }
        }}
        onCancel={() => setDeleting(null)}
      />
    </Box>
  )
}
