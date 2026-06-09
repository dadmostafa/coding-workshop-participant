import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Typography, Button, TextField, InputAdornment,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, IconButton, Chip, CircularProgress, Alert, Dialog,
  DialogTitle, DialogContent, DialogActions, Grid, Tooltip, Avatar,
} from '@mui/material'
import { Add, Search, Edit, Delete, ArrowForwardIos } from '@mui/icons-material'
import { getTeams, createTeam, updateTeam, deleteTeam } from '../services/api'
import { useAuth } from '../context/AuthContext'
import ConfirmDialog from '../components/ConfirmDialog'

const TEAM_COLORS = ['#FF6B6B','#FFD166','#6BCB77','#4ECDC4','#A29BFE','#74B9FF','#FF9F43','#FD79A8']
const getColor = name => TEAM_COLORS[(name?.charCodeAt(0) || 0) % TEAM_COLORS.length]

const EMPTY = { name: '', description: '', location: '', department: '', team_leader: '', leader_location: '', org_leader: '' }

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

  const openCreate = () => { setEditing(null); setForm(EMPTY); setFormErr({}); setOpen(true) }
  const openEdit   = t  => { setEditing(t); setForm({ name: t.name||'', description: t.description||'', location: t.location||'', department: t.department||'', team_leader: t.team_leader||'', leader_location: t.leader_location||'', org_leader: t.org_leader||'' }); setFormErr({}); setOpen(true) }

  const handleSave = async () => {
    if (!form.name.trim()) { setFormErr({ name: 'Team name is required' }); return }
    setSaving(true)
    try {
      editing ? await updateTeam(editing.id, form) : await createTeam(form)
      setOpen(false); load()
    } catch (err) {
      setFormErr({ _api: err.response?.data?.error || 'Save failed' })
    } finally { setSaving(false) }
  }

  const f = key => ({ value: form[key], onChange: e => setForm(p => ({ ...p, [key]: e.target.value })), error: !!formErr[key], helperText: formErr[key] })

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Teams</Typography>
          <Typography variant="body2" color="text.secondary">{teams.length} teams total</Typography>
        </Box>
        {canWrite && (
          <Button variant="contained" startIcon={<Add />} onClick={openCreate}
            sx={{ bgcolor: '#6BCB77', color: '#13141a', '&:hover': { bgcolor: '#5ab868' } }}>
            New Team
          </Button>
        )}
      </Box>

      <TextField
        placeholder="Search teams…" value={search}
        onChange={e => setSearch(e.target.value)}
        size="small" sx={{ mb: 3, width: 300 }}
        InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ color: '#8b8fa8' }} /></InputAdornment> }}
      />

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TableContainer component={Paper} sx={{ bgcolor: '#1e2029', border: '1px solid #2a2d3e' }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Team</TableCell>
              <TableCell>Department</TableCell>
              <TableCell>Location</TableCell>
              <TableCell>Leader</TableCell>
              <TableCell>Org Leader</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                <CircularProgress size={28} sx={{ color: '#6BCB77' }} />
              </TableCell></TableRow>
            ) : teams.length === 0 ? (
              <TableRow><TableCell colSpan={6} align="center" sx={{ py: 6, color: '#8b8fa8' }}>
                No teams yet — create your first one
              </TableCell></TableRow>
            ) : teams.map(t => (
              <TableRow key={t.id}>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Avatar sx={{ width: 32, height: 32, bgcolor: `${getColor(t.name)}20`, color: getColor(t.name), fontSize: 13, fontWeight: 700, border: `1px solid ${getColor(t.name)}40` }}>
                      {t.name[0].toUpperCase()}
                    </Avatar>
                    <Box>
                      <Typography variant="body2" fontWeight={600}>{t.name}</Typography>
                      {t.description && <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 200, display: 'block' }}>{t.description}</Typography>}
                    </Box>
                  </Box>
                </TableCell>
                <TableCell><Typography variant="body2" color="text.secondary">{t.department || '—'}</Typography></TableCell>
                <TableCell><Typography variant="body2" color="text.secondary">{t.location || '—'}</Typography></TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Typography variant="body2" color="text.secondary">{t.team_leader || '—'}</Typography>
                    {t.leader_location && t.location && t.leader_location !== t.location && (
                      <Chip label="remote" size="small" sx={{ bgcolor: 'rgba(255,159,67,0.15)', color: '#FF9F43', border: '1px solid rgba(255,159,67,0.3)', fontSize: '0.65rem', height: 18 }} />
                    )}
                  </Box>
                </TableCell>
                <TableCell><Typography variant="body2" color="text.secondary">{t.org_leader || '—'}</Typography></TableCell>
                <TableCell align="right">
                  <Tooltip title="View"><IconButton size="small" onClick={() => navigate(`/teams/${t.id}`)} sx={{ color: '#8b8fa8', '&:hover': { color: '#6BCB77' } }}><ArrowForwardIos sx={{ fontSize: 14 }} /></IconButton></Tooltip>
                  {canWrite && <Tooltip title="Edit"><IconButton size="small" onClick={() => openEdit(t)} sx={{ color: '#8b8fa8', '&:hover': { color: '#FFD166' } }}><Edit sx={{ fontSize: 16 }} /></IconButton></Tooltip>}
                  {canDelete && <Tooltip title="Delete"><IconButton size="small" onClick={() => setDeleting(t)} sx={{ color: '#8b8fa8', '&:hover': { color: '#FF6B6B' } }}><Delete sx={{ fontSize: 16 }} /></IconButton></Tooltip>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ color: 'text.primary' }}>{editing ? 'Edit Team' : 'New Team'}</DialogTitle>
        <DialogContent>
          {formErr._api && <Alert severity="error" sx={{ mb: 1 }}>{formErr._api}</Alert>}
          <Grid container spacing={1} sx={{ mt: 0.5 }}>
            <Grid item xs={12}><TextField label="Team Name" fullWidth margin="dense" required {...f('name')} /></Grid>
            <Grid item xs={12}><TextField label="Description" fullWidth margin="dense" {...f('description')} /></Grid>
            <Grid item xs={6}><TextField label="Team Location" fullWidth margin="dense" {...f('location')} /></Grid>
            <Grid item xs={6}><TextField label="Department" fullWidth margin="dense" {...f('department')} /></Grid>
            <Grid item xs={6}><TextField label="Team Leader" fullWidth margin="dense" {...f('team_leader')} /></Grid>
            <Grid item xs={6}><TextField label="Leader Location" fullWidth margin="dense" {...f('leader_location')} /></Grid>
            <Grid item xs={12}><TextField label="Org Leader" fullWidth margin="dense" {...f('org_leader')} /></Grid>
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

      <ConfirmDialog open={!!deleting} title="Delete Team" message={`Delete "${deleting?.name}"?`}
        onConfirm={async () => { await deleteTeam(deleting.id); setDeleting(null); load() }}
        onCancel={() => setDeleting(null)} />
    </Box>
  )
}
