import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import {
  Box, Typography, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, IconButton,
  Chip, CircularProgress, Alert, Dialog, DialogTitle,
  DialogContent, DialogActions, Grid, TextField, MenuItem, Tooltip,
} from '@mui/material'
import { Add, Edit, Delete } from '@mui/icons-material'
import ConfirmDialog from '../components/ConfirmDialog'

const BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3001') + '/api/team-service'
const token = () => localStorage.getItem('acme_token')
const api = path => axios.get(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token()}` } }).then(r => r.data)
const apiPost = (path, data) => axios.post(`${BASE}${path}`, data, { headers: { Authorization: `Bearer ${token()}` } }).then(r => r.data)
const apiPut  = (path, data) => axios.put(`${BASE}${path}`, data, { headers: { Authorization: `Bearer ${token()}` } }).then(r => r.data)
const apiDel  = path => axios.delete(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token()}` } })

const ROLE_COLOR = { admin: 'error', manager: 'warning', contributor: 'info', viewer: 'default' }
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
    setLoading(true)
    setError('')
    try { setUsers(await api('/users')) }
    catch { setError('Failed to load users') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const openCreate = () => {
    setEditing(null); setForm(EMPTY); setFormErr({}); setOpen(true)
  }
  const openEdit = u => {
    setEditing(u)
    setForm({ username: u.username, password: '', role: u.role, full_name: u.full_name || '', email: u.email || '' })
    setFormErr({})
    setOpen(true)
  }

  const validate = () => {
    const e = {}
    if (!form.username.trim()) e.username = 'Username is required'
    if (!editing && !form.password) e.password = 'Password is required for new users'
    if (!form.role) e.role = 'Role is required'
    return e
  }

  const handleSave = async () => {
    const e = validate()
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
        <Typography variant="h5" fontWeight={700}>User Management</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={openCreate}>Add User</Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TableContainer component={Paper} elevation={2}>
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: 'grey.50' }}>
              <TableCell><strong>Username</strong></TableCell>
              <TableCell><strong>Full Name</strong></TableCell>
              <TableCell><strong>Email</strong></TableCell>
              <TableCell><strong>Role</strong></TableCell>
              <TableCell align="right"><strong>Actions</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} align="center"><CircularProgress size={24} /></TableCell></TableRow>
            ) : users.map(u => (
              <TableRow key={u.id} hover>
                <TableCell><Typography fontWeight={600}>{u.username}</Typography></TableCell>
                <TableCell>{u.full_name || '—'}</TableCell>
                <TableCell>{u.email || '—'}</TableCell>
                <TableCell>
                  <Chip size="small" label={u.role} color={ROLE_COLOR[u.role] || 'default'} />
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="Edit">
                    <IconButton size="small" onClick={() => openEdit(u)}><Edit fontSize="small" /></IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton size="small" color="error" onClick={() => setDeleting(u)}>
                      <Delete fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{editing ? 'Edit User' : 'New User'}</DialogTitle>
        <DialogContent>
          {formErr._api && <Alert severity="error" sx={{ mb: 1 }}>{formErr._api}</Alert>}
          <Grid container spacing={1}>
            <Grid item xs={12}>
              <TextField label="Username" fullWidth margin="dense" required
                disabled={!!editing} {...f('username')} />
            </Grid>
            <Grid item xs={12}>
              <TextField label={editing ? 'New Password (leave blank to keep)' : 'Password'}
                type="password" fullWidth margin="dense" required={!editing} {...f('password')} />
            </Grid>
            <Grid item xs={12}>
              <TextField select label="Role" fullWidth margin="dense" required {...f('role')}>
                {['admin','manager','contributor','viewer'].map(r =>
                  <MenuItem key={r} value={r}>{r}</MenuItem>
                )}
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField label="Full Name" fullWidth margin="dense" {...f('full_name')} />
            </Grid>
            <Grid item xs={12}>
              <TextField label="Email" fullWidth margin="dense" {...f('email')} />
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
        title="Delete User"
        message={`Delete user "${deleting?.username}"?`}
        onConfirm={async () => { await apiDel(`/users/${deleting.id}`); setDeleting(null); load() }}
        onCancel={() => setDeleting(null)}
      />
    </Box>
  )
}
