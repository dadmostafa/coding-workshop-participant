import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Box, Typography, Button, TextField, InputAdornment,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, IconButton, Chip, CircularProgress, Alert, Dialog,
  DialogTitle, DialogContent, DialogActions, Grid, Tooltip,
  MenuItem, FormControlLabel, Checkbox,
} from '@mui/material'
import { Add, Search, Edit, Delete } from '@mui/icons-material'
import {
  getMembers, createMember, updateMember, deleteMember, getTeams,
} from '../services/api'
import { useAuth } from '../context/AuthContext'
import ConfirmDialog from '../components/ConfirmDialog'

const EMPTY = {
  name: '', email: '', role: '', location: '', team_id: '',
  employment_type: 'direct', is_team_leader: false, start_date: '',
}

export default function MembersPage() {
  const { canWrite, canDelete } = useAuth()
  const [searchParams] = useSearchParams()

  const [members,  setMembers]  = useState([])
  const [teams,    setTeams]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')
  const [search,   setSearch]   = useState('')
  const [teamFilter, setTeamFilter] = useState(searchParams.get('team_id') || '')
  const [open,     setOpen]     = useState(false)
  const [editing,  setEditing]  = useState(null)
  const [form,     setForm]     = useState(EMPTY)
  const [formErr,  setFormErr]  = useState({})
  const [saving,   setSaving]   = useState(false)
  const [deleting, setDeleting] = useState(null)

  useEffect(() => {
    getTeams().then(setTeams).catch(() => {})
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = {}
      if (teamFilter) params.team_id = teamFilter
      if (search)     params.search  = search
      setMembers(await getMembers(params))
    } catch {
      setError('Failed to load members')
    } finally {
      setLoading(false)
    }
  }, [teamFilter, search])

  useEffect(() => { load() }, [load])

  const teamName = id => teams.find(t => t.id === id)?.name || id

  const openCreate = () => {
    setEditing(null)
    setForm({ ...EMPTY, team_id: teamFilter || '' })
    setFormErr({})
    setOpen(true)
  }

  const openEdit = m => {
    setEditing(m)
    setForm({
      name: m.name || '', email: m.email || '', role: m.role || '',
      location: m.location || '', team_id: m.team_id || '',
      employment_type: m.employment_type || 'direct',
      is_team_leader: m.is_team_leader || false,
      start_date: m.start_date || '',
    })
    setFormErr({})
    setOpen(true)
  }

  const validate = () => {
    const e = {}
    if (!form.name.trim())    e.name    = 'Name is required'
    if (!form.team_id)        e.team_id = 'Team is required'
    return e
  }

  const handleSave = async () => {
    const e = validate()
    if (Object.keys(e).length) { setFormErr(e); return }
    setSaving(true)
    try {
      editing ? await updateMember(editing.id, form) : await createMember(form)
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

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>Members</Typography>
        {canWrite && (
          <Button variant="contained" startIcon={<Add />} onClick={openCreate}>Add Member</Button>
        )}
      </Box>

      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <TextField
          placeholder="Search members…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          size="small"
          sx={{ width: 260 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><Search /></InputAdornment> }}
        />
        <TextField
          select label="Filter by team" size="small" sx={{ minWidth: 200 }}
          value={teamFilter}
          onChange={e => setTeamFilter(e.target.value)}
        >
          <MenuItem value="">All teams</MenuItem>
          {teams.map(t => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
        </TextField>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TableContainer component={Paper} elevation={2}>
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: 'grey.50' }}>
              <TableCell><strong>Name</strong></TableCell>
              <TableCell><strong>Team</strong></TableCell>
              <TableCell><strong>Role</strong></TableCell>
              <TableCell><strong>Location</strong></TableCell>
              <TableCell><strong>Type</strong></TableCell>
              <TableCell align="right"><strong>Actions</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} align="center"><CircularProgress size={24} /></TableCell></TableRow>
            ) : members.length === 0 ? (
              <TableRow><TableCell colSpan={6} align="center" sx={{ color: 'text.secondary', py: 4 }}>
                No members found
              </TableCell></TableRow>
            ) : members.map(m => (
              <TableRow key={m.id} hover>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography fontWeight={600}>{m.name}</Typography>
                    {m.is_team_leader && <Chip size="small" label="Leader" color="primary" />}
                  </Box>
                  {m.email && <Typography variant="caption" color="text.secondary">{m.email}</Typography>}
                </TableCell>
                <TableCell>{teamName(m.team_id)}</TableCell>
                <TableCell>{m.role || '—'}</TableCell>
                <TableCell>{m.location || '—'}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={m.employment_type || 'direct'}
                    color={m.employment_type === 'non-direct' ? 'warning' : 'success'}
                    variant="outlined"
                  />
                </TableCell>
                <TableCell align="right">
                  {canWrite && (
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => openEdit(m)}><Edit fontSize="small" /></IconButton>
                    </Tooltip>
                  )}
                  {canDelete && (
                    <Tooltip title="Delete">
                      <IconButton size="small" color="error" onClick={() => setDeleting(m)}>
                        <Delete fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Dialog */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Edit Member' : 'Add Member'}</DialogTitle>
        <DialogContent>
          {formErr._api && <Alert severity="error" sx={{ mb: 1 }}>{formErr._api}</Alert>}
          <Grid container spacing={1}>
            <Grid item xs={12}>
              <TextField label="Full Name" fullWidth margin="dense" required {...f('name')} />
            </Grid>
            <Grid item xs={12}>
              <TextField select label="Team" fullWidth margin="dense" required {...f('team_id')}>
                <MenuItem value="">Select a team</MenuItem>
                {teams.map(t => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={6}>
              <TextField label="Email" fullWidth margin="dense" {...f('email')} />
            </Grid>
            <Grid item xs={6}>
              <TextField label="Job Role / Title" fullWidth margin="dense" {...f('role')} />
            </Grid>
            <Grid item xs={6}>
              <TextField label="Location" fullWidth margin="dense" {...f('location')} />
            </Grid>
            <Grid item xs={6}>
              <TextField select label="Employment Type" fullWidth margin="dense" {...f('employment_type')}>
                <MenuItem value="direct">Direct</MenuItem>
                <MenuItem value="non-direct">Non-direct</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={6}>
              <TextField label="Start Date" type="date" fullWidth margin="dense"
                InputLabelProps={{ shrink: true }} {...f('start_date')} />
            </Grid>
            <Grid item xs={6} sx={{ display: 'flex', alignItems: 'center' }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={form.is_team_leader}
                    onChange={e => setForm(p => ({ ...p, is_team_leader: e.target.checked }))}
                  />
                }
                label="Team Leader"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? <CircularProgress size={20} color="inherit" /> : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        title="Remove Member"
        message={`Remove "${deleting?.name}"?`}
        onConfirm={async () => { await deleteMember(deleting.id); setDeleting(null); load() }}
        onCancel={() => setDeleting(null)}
      />
    </Box>
  )
}
