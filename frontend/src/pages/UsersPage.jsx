import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import {
  Box, Typography, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, IconButton,
  Chip, CircularProgress, Alert, Dialog, DialogTitle,
  DialogContent, DialogActions, Grid, TextField, MenuItem, Tooltip, Avatar,
} from '@mui/material'
import { Add, Edit, Delete } from '@mui/icons-material'
import ConfirmDialog from '../components/ConfirmDialog'

const BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3001') + '/api/team-service'
const token = () => localStorage.getItem('acme_token')
const hdrs = () => ({ Authorization: `Bearer ${token()}` })
const api     = path    => axios.get(`${BASE}${path}`, { headers: hdrs() }).then(r => r.data)
const apiPost = (p, d)  => axios.post(`${BASE}${p}`, d, { headers: hdrs() }).then(r => r.data)
const apiPut  = (p, d)  => axios.put(`${BASE}${p}`, d, { headers: hdrs() }).then(r => r.data)
const apiDel  = p       => axios.delete(`${BASE}${p}`, { headers: hdrs() })

const ROLE_STYLES = {
  admin:       { bg: 'rgba(255,107,107,0.15)', color: '#FF6B6B', border: 'rgba(255,107,107,0.3)' },
  manager:     { bg: 'rgba(255,209,102,0.15)', color: '#FFD166', border: 'rgba(255,209,102,0.3)' },
  contributor: { bg: 'rgba(107,203,119,0.15)', color: '#6BCB77', border: 'rgba(107,203,119,0.3)' },
  viewer:      { bg: 'rgba(78,205,196,0.15)',  color: '#4ECDC4', border: 'rgba(78,205,196,0.3)'  },
}

const EMPTY = { username: '', password: '', role: 'viewer', full_name: '', email: '' }

export default function UsersPage() {
  const [users,   setUsers]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [open,    setOpen]    = useState(false)
  const [editing, setEditing] = useState(null)
  const [form,    setForm]    = useState(EMPTY)
  const [formErr, setFormErr] = useState({})
  const [saving,  setSaving]  = useState(false)
  const [deleting, setDeleting] = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { setUsers(await api('/users')) }
    catch { setError('Failed to load users') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const openCreate = () => { setEditing(null); setForm(EMPTY); setFormErr({}); setOpen(true) }
  const openEdit   = u  => { setEditing(u); setForm({ username: u.username, password: '', role: u.role, full_name: u.full_name||'', email: u.email||'' }); setFormErr({}); setOpen(true) }

  const handleSave = async () => {
    const e = {}
    if (!form.username.trim()) e.username = 'Required'
    if (!editing && !form.password) e.password = 'Required for new users'
    if (Object.keys(e).length) { setFormErr(e); return }
    setSaving(true)
    try {
      if (editing) {
        const payload = { role: form.role, full_name: form.full_name, email: form.email }
        if (form.password) payload.password = form.password
        await apiPut(`/users/${editing.id}`, payload)
      } else {
        await apiPost('/users', form)
      }
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
          <Typography variant="h5" fontWeight={700}>User Management</Typography>
          <Typography variant="body2" color="text.secondary">{users.length} users</Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={openCreate}
          sx={{ bgcolor: '#A29BFE', color: '#13141a', '&:hover': { bgcolor: '#9188f0' } }}>
          Add User
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TableContainer component={Paper} sx={{ bgcolor: '#1e2029', border: '1px solid #2a2d3e' }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>User</TableCell><TableCell>Email</TableCell><TableCell>Role</TableCell><TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={4} align="center" sx={{ py: 6 }}><CircularProgress size={28} sx={{ color: '#A29BFE' }} /></TableCell></TableRow>
            ) : users.map(u => {
              const rs = ROLE_STYLES[u.role] || ROLE_STYLES.viewer
              return (
                <TableRow key={u.id}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Avatar sx={{ width: 32, height: 32, bgcolor: `${rs.color}20`, color: rs.color, fontSize: 13, fontWeight: 700, border: `1px solid ${rs.border}` }}>
                        {u.username[0].toUpperCase()}
                      </Avatar>
                      <Box>
                        <Typography variant="body2" fontWeight={600}>{u.username}</Typography>
                        {u.full_name && <Typography variant="caption" color="text.secondary">{u.full_name}</Typography>}
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell><Typography variant="body2" color="text.secondary">{u.email || '—'}</Typography></TableCell>
                  <TableCell>
                    <Chip label={u.role} size="small" sx={{ bgcolor: rs.bg, color: rs.color, border: `1px solid ${rs.border}`, fontWeight: 600, fontSize: '0.7rem' }} />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Edit"><IconButton size="small" onClick={() => openEdit(u)} sx={{ color: '#8b8fa8', '&:hover': { color: '#FFD166' } }}><Edit sx={{ fontSize: 16 }} /></IconButton></Tooltip>
                    <Tooltip title="Delete"><IconButton size="small" onClick={() => setDeleting(u)} sx={{ color: '#8b8fa8', '&:hover': { color: '#FF6B6B' } }}><Delete sx={{ fontSize: 16 }} /></IconButton></Tooltip>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{editing ? 'Edit User' : 'New User'}</DialogTitle>
        <DialogContent>
          {formErr._api && <Alert severity="error" sx={{ mb: 1 }}>{formErr._api}</Alert>}
          <Grid container spacing={1} sx={{ mt: 0.5 }}>
            <Grid item xs={12}><TextField label="Username" fullWidth margin="dense" required disabled={!!editing} {...f('username')} /></Grid>
            <Grid item xs={12}><TextField label={editing ? 'New Password (leave blank to keep)' : 'Password'} type="password" fullWidth margin="dense" required={!editing} {...f('password')} /></Grid>
            <Grid item xs={12}><TextField select label="Role" fullWidth margin="dense" required {...f('role')}>
              {['admin','manager','contributor','viewer'].map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
            </TextField></Grid>
            <Grid item xs={12}><TextField label="Full Name" fullWidth margin="dense" {...f('full_name')} /></Grid>
            <Grid item xs={12}><TextField label="Email" fullWidth margin="dense" {...f('email')} /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOpen(false)} sx={{ color: '#8b8fa8' }}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}
            sx={{ bgcolor: '#A29BFE', color: '#13141a', '&:hover': { bgcolor: '#9188f0' } }}>
            {saving ? <CircularProgress size={18} sx={{ color: '#13141a' }} /> : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog open={!!deleting} title="Delete User" message={`Delete "${deleting?.username}"?`}
        onConfirm={async () => { await apiDel(`/users/${deleting.id}`); setDeleting(null); load() }}
        onCancel={() => setDeleting(null)} />
    </Box>
  )
}
