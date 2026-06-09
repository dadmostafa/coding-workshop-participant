import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Typography, Button, TextField, InputAdornment,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, IconButton, Chip, CircularProgress, Alert, Dialog,
  DialogTitle, DialogContent, DialogActions, Grid, Tooltip,
} from '@mui/material'
import {
  Add, Search, Edit, Delete, Visibility, Groups,
} from '@mui/icons-material'
import { getTeams, createTeam, updateTeam, deleteTeam } from '../services/api'
import { useAuth } from '../context/AuthContext'
import ConfirmDialog from '../components/ConfirmDialog'

const EMPTY = {
  name: '', description: '', location: '', department: '',
  team_leader: '', leader_location: '', org_leader: '',
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
    setLoading(true)
    setError('')
    try {
      const data = await getTeams(search ? { search } : {})
      setTeams(data)
    } catch {
      setError('Failed to load teams')
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => { load() }, [load])

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY)
    setFormErr({})
    setOpen(true)
  }

  const openEdit = team => {
    setEditing(team)
    setForm({
      name: team.name || '', description: team.description || '',
      location: team.location || '', department: team.department || '',
      team_leader: team.team_leader || '', leader_location: team.leader_location || '',
      org_leader: team.org_leader || '',
    })
    setFormErr({})
    setOpen(true)
  }

  const validate = () => {
    const e = {}
    if (!form.name.trim()) e.name = 'Team name is required'
    return e
  }

  const handleSave = async () => {
    const e = validate()
    if (Object.keys(e).length) { setFormErr(e); return }
    setSaving(true)
    try {
      if (editing) {
        await updateTeam(editing.id, form)
      } else {
        await createTeam(form)
      }
      setOpen(false)
      load()
    } catch (err) {
      setFormErr({ _api: err.response?.data?.error || 'Save failed' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    try {
      await deleteTeam(deleting.id)
      setDeleting(null)
      load()
    } catch {
      setError('Delete failed')
      setDeleting(null)
    }
  }

  const field = (key, label, required) => (
    <TextField
      label={label}
      fullWidth
      margin="dense"
      value={form[key]}
      onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
      error={!!formErr[key]}
      helperText={formErr[key]}
      required={required}
    />
  )

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>Teams</Typography>
        {canWrite && (
          <Button variant="contained" startIcon={<Add />} onClick={openCreate}>
            New Team
          </Button>
        )}
      </Box>

      <TextField
        placeholder="Search teams…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        size="small"
        sx={{ mb: 2, width: 300 }}
        InputProps={{ startAdornment: <InputAdornment position="start"><Search /></InputAdornment> }}
      />

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TableContainer component={Paper} elevation={2}>
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: 'grey.50' }}>
              <TableCell><strong>Team Name</strong></TableCell>
              <TableCell><strong>Department</strong></TableCell>
              <TableCell><strong>Location</strong></TableCell>
              <TableCell><strong>Team Leader</strong></TableCell>
              <TableCell><strong>Org Leader</strong></TableCell>
              <TableCell align="right"><strong>Actions</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} align="center"><CircularProgress size={24} /></TableCell></TableRow>
            ) : teams.length === 0 ? (
              <TableRow><TableCell colSpan={6} align="center" sx={{ color: 'text.secondary', py: 4 }}>
                <Groups sx={{ fontSize: 48, opacity: 0.2 }} /><br />No teams found
              </TableCell></TableRow>
            ) : teams.map(t => (
              <TableRow key={t.id} hover>
                <TableCell>
                  <Typography fontWeight={600}>{t.name}</Typography>
                  {t.description && (
                    <Typography variant="caption" color="text.secondary">{t.description}</Typography>
                  )}
                </TableCell>
                <TableCell>{t.department || '—'}</TableCell>
                <TableCell>{t.location || '—'}</TableCell>
                <TableCell>
                  {t.team_leader || '—'}
                  {t.leader_location && t.location && t.leader_location !== t.location && (
                    <Chip label="remote" size="small" color="warning" sx={{ ml: 1 }} />
                  )}
                </TableCell>
                <TableCell>{t.org_leader || '—'}</TableCell>
                <TableCell align="right">
                  <Tooltip title="View details">
                    <IconButton size="small" onClick={() => navigate(`/teams/${t.id}`)}>
                      <Visibility fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  {canWrite && (
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => openEdit(t)}>
                        <Edit fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                  {canDelete && (
                    <Tooltip title="Delete">
                      <IconButton size="small" color="error" onClick={() => setDeleting(t)}>
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

      {/* Create / Edit dialog */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Edit Team' : 'New Team'}</DialogTitle>
        <DialogContent>
          {formErr._api && <Alert severity="error" sx={{ mb: 1 }}>{formErr._api}</Alert>}
          <Grid container spacing={1}>
            <Grid item xs={12}>{field('name', 'Team Name', true)}</Grid>
            <Grid item xs={12}>{field('description', 'Description')}</Grid>
            <Grid item xs={6}>{field('location', 'Team Location')}</Grid>
            <Grid item xs={6}>{field('department', 'Department')}</Grid>
            <Grid item xs={6}>{field('team_leader', 'Team Leader')}</Grid>
            <Grid item xs={6}>{field('leader_location', 'Leader Location')}</Grid>
            <Grid item xs={12}>{field('org_leader', 'Org Leader')}</Grid>
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
        title="Delete Team"
        message={`Are you sure you want to delete "${deleting?.name}"? This cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />
    </Box>
  )
}
