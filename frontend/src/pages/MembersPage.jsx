import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Box, Typography, Button, TextField, InputAdornment,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, IconButton, Chip, CircularProgress, Alert, Dialog,
  DialogTitle, DialogContent, DialogActions, Grid, Tooltip,
  MenuItem, FormControlLabel, Checkbox, Avatar,
} from '@mui/material'
import { Add, Edit, Delete, Search } from '@mui/icons-material'
import { getMembers, createMember, updateMember, deleteMember, getTeams } from '../services/api'
import { useAuth } from '../context/AuthContext'
import ConfirmDialog from '../components/ConfirmDialog'

const EMPTY = { name: '', email: '', role: '', location: '', team_id: '', employment_type: 'direct', is_team_leader: false, start_date: '' }

const AVATAR_COLORS = ['#FF6B6B','#FFD166','#6BCB77','#4ECDC4','#A29BFE','#74B9FF','#FF9F43','#FD79A8']
const getColor = name => AVATAR_COLORS[(name?.charCodeAt(0) || 0) % AVATAR_COLORS.length]

export default function MembersPage() {
  const { canWrite, canDelete } = useAuth()
  const [searchParams] = useSearchParams()
  const [members,    setMembers]    = useState([])
  const [teams,      setTeams]      = useState([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState('')
  const [search,     setSearch]     = useState('')
  const [teamFilter, setTeamFilter] = useState(searchParams.get('team_id') || '')
  const [open,     setOpen]     = useState(false)
  const [editing,  setEditing]  = useState(null)
  const [form,     setForm]     = useState(EMPTY)
  const [formErr,  setFormErr]  = useState({})
  const [saving,   setSaving]   = useState(false)
  const [deleting, setDeleting] = useState(null)

  useEffect(() => { getTeams().then(setTeams).catch(() => {}) }, [])

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const params = {}
      if (teamFilter) params.team_id = teamFilter
      if (search)     params.search  = search
      setMembers(await getMembers(params))
    } catch { setError('Failed to load members') }
    finally { setLoading(false) }
  }, [teamFilter, search])

  useEffect(() => { load() }, [load])

  const teamName = id => teams.find(t => t.id === id)?.name || '—'

  const openCreate = () => { setEditing(null); setForm({ ...EMPTY, team_id: teamFilter || '' }); setFormErr({}); setOpen(true) }
  const openEdit   = m  => { setEditing(m); setForm({ name: m.name||'', email: m.email||'', role: m.role||'', location: m.location||'', team_id: m.team_id||'', employment_type: m.employment_type||'direct', is_team_leader: m.is_team_leader||false, start_date: m.start_date||'' }); setFormErr({}); setOpen(true) }

  const handleSave = async () => {
    const e = {}
    if (!form.name.trim()) e.name = 'Name is required'
    if (!form.team_id)     e.team_id = 'Team is required'
    if (Object.keys(e).length) { setFormErr(e); return }
    setSaving(true)
    try {
      editing ? await updateMember(editing.id, form) : await createMember(form)
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
          <Typography variant="h5" fontWeight={700}>Members</Typography>
          <Typography variant="body2" color="text.secondary">{members.length} members total</Typography>
        </Box>
        {canWrite && (
          <Button variant="contained" startIcon={<Add />} onClick={openCreate}
            sx={{ bgcolor: '#6BCB77', color: '#13141a', '&:hover': { bgcolor: '#5ab868' } }}>
            Add Member
          </Button>
        )}
      </Box>

      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <TextField placeholder="Search members…" value={search} onChange={e => setSearch(e.target.value)} size="small" sx={{ width: 260 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ color: '#8b8fa8' }} /></InputAdornment> }} />
        <TextField select label="Team" size="small" sx={{ minWidth: 200 }} value={teamFilter} onChange={e => setTeamFilter(e.target.value)}>
          <MenuItem value="">All teams</MenuItem>
          {teams.map(t => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
        </TextField>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TableContainer component={Paper} sx={{ bgcolor: '#1e2029', border: '1px solid #2a2d3e' }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Member</TableCell>
              <TableCell>Team</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Location</TableCell>
              <TableCell>Type</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} align="center" sx={{ py: 6 }}><CircularProgress size={28} sx={{ color: '#6BCB77' }} /></TableCell></TableRow>
            ) : members.length === 0 ? (
              <TableRow><TableCell colSpan={6} align="center" sx={{ py: 6, color: '#8b8fa8' }}>No members found</TableCell></TableRow>
            ) : members.map(m => (
              <TableRow key={m.id}>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Avatar sx={{ width: 32, height: 32, bgcolor: `${getColor(m.name)}20`, color: getColor(m.name), fontSize: 13, fontWeight: 700, border: `1px solid ${getColor(m.name)}40` }}>
                      {m.name[0].toUpperCase()}
                    </Avatar>
                    <Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Typography variant="body2" fontWeight={600}>{m.name}</Typography>
                        {m.is_team_leader && <Chip label="Leader" size="small" sx={{ bgcolor: 'rgba(107,203,119,0.15)', color: '#6BCB77', border: '1px solid rgba(107,203,119,0.3)', fontSize: '0.65rem', height: 18 }} />}
                      </Box>
                      {m.email && <Typography variant="caption" color="text.secondary">{m.email}</Typography>}
                    </Box>
                  </Box>
                </TableCell>
                <TableCell><Typography variant="body2" color="text.secondary">{teamName(m.team_id)}</Typography></TableCell>
                <TableCell><Typography variant="body2" color="text.secondary">{m.role || '—'}</Typography></TableCell>
                <TableCell><Typography variant="body2" color="text.secondary">{m.location || '—'}</Typography></TableCell>
                <TableCell>
                  <Chip label={m.employment_type || 'direct'} size="small"
                    sx={m.employment_type === 'non-direct'
                      ? { bgcolor: 'rgba(255,159,67,0.15)', color: '#FF9F43', border: '1px solid rgba(255,159,67,0.3)', fontSize: '0.7rem' }
                      : { bgcolor: 'rgba(107,203,119,0.15)', color: '#6BCB77', border: '1px solid rgba(107,203,119,0.3)', fontSize: '0.7rem' }} />
                </TableCell>
                <TableCell align="right">
                  {canWrite && <Tooltip title="Edit"><IconButton size="small" onClick={() => openEdit(m)} sx={{ color: '#8b8fa8', '&:hover': { color: '#FFD166' } }}><Edit sx={{ fontSize: 16 }} /></IconButton></Tooltip>}
                  {canDelete && <Tooltip title="Delete"><IconButton size="small" onClick={() => setDeleting(m)} sx={{ color: '#8b8fa8', '&:hover': { color: '#FF6B6B' } }}><Delete sx={{ fontSize: 16 }} /></IconButton></Tooltip>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Edit Member' : 'Add Member'}</DialogTitle>
        <DialogContent>
          {formErr._api && <Alert severity="error" sx={{ mb: 1 }}>{formErr._api}</Alert>}
          <Grid container spacing={1} sx={{ mt: 0.5 }}>
            <Grid item xs={12}><TextField label="Full Name" fullWidth margin="dense" required {...f('name')} /></Grid>
            <Grid item xs={12}><TextField select label="Team" fullWidth margin="dense" required {...f('team_id')}>
              <MenuItem value="">Select team</MenuItem>
              {teams.map(t => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
            </TextField></Grid>
            <Grid item xs={6}><TextField label="Email" fullWidth margin="dense" {...f('email')} /></Grid>
            <Grid item xs={6}><TextField label="Job Title" fullWidth margin="dense" {...f('role')} /></Grid>
            <Grid item xs={6}><TextField label="Location" fullWidth margin="dense" {...f('location')} /></Grid>
            <Grid item xs={6}><TextField select label="Employment Type" fullWidth margin="dense" {...f('employment_type')}>
              <MenuItem value="direct">Direct</MenuItem>
              <MenuItem value="non-direct">Non-direct</MenuItem>
            </TextField></Grid>
            <Grid item xs={6}><TextField label="Start Date" type="date" fullWidth margin="dense" InputLabelProps={{ shrink: true }} {...f('start_date')} /></Grid>
            <Grid item xs={6} sx={{ display: 'flex', alignItems: 'center' }}>
              <FormControlLabel control={<Checkbox checked={form.is_team_leader} onChange={e => setForm(p => ({ ...p, is_team_leader: e.target.checked }))} sx={{ color: '#6BCB77', '&.Mui-checked': { color: '#6BCB77' } }} />} label="Team Leader" />
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

      <ConfirmDialog open={!!deleting} title="Remove Member" message={`Remove "${deleting?.name}"?`}
        onConfirm={async () => { 
          try {
            const result = await deleteMember(deleting.id)
            if (result?.data?.alert) {
              setError(`⚠️ ${result.data.alert.message}`)
            }
            setDeleting(null)
            load()
          } catch (err) {
            setError('Failed to delete member: ' + (err.response?.data?.error || err.message))
          }
        }}
        onCancel={() => setDeleting(null)} />
    </Box>
  )
}
