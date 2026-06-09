import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Box, Typography, Button, TextField, InputAdornment,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, IconButton, Chip, CircularProgress, Alert, Dialog,
  DialogTitle, DialogContent, DialogActions, Grid, MenuItem, Tooltip,
} from '@mui/material'
import { Add, Search, Edit, Delete } from '@mui/icons-material'
import {
  getAchievements, createAchievement, updateAchievement, deleteAchievement, getTeams,
} from '../services/api'
import { useAuth } from '../context/AuthContext'
import ConfirmDialog from '../components/ConfirmDialog'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const YEARS  = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i)

const EMPTY = { title: '', description: '', team_id: '', month: '', year: '', impact: '' }

export default function AchievementsPage() {
  const { canWrite, canDelete } = useAuth()
  const [searchParams] = useSearchParams()

  const [achievs,    setAchievs]    = useState([])
  const [teams,      setTeams]      = useState([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState('')
  const [teamFilter, setTeamFilter] = useState(searchParams.get('team_id') || '')
  const [monthFilter, setMonthFilter] = useState('')
  const [yearFilter,  setYearFilter]  = useState('')
  const [open,    setOpen]    = useState(false)
  const [editing, setEditing] = useState(null)
  const [form,    setForm]    = useState(EMPTY)
  const [formErr, setFormErr] = useState({})
  const [saving,  setSaving]  = useState(false)
  const [deleting, setDeleting] = useState(null)

  useEffect(() => { getTeams().then(setTeams).catch(() => {}) }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = {}
      if (teamFilter)  params.team_id = teamFilter
      if (monthFilter) params.month   = monthFilter
      if (yearFilter)  params.year    = yearFilter
      setAchievs(await getAchievements(params))
    } catch {
      setError('Failed to load achievements')
    } finally {
      setLoading(false)
    }
  }, [teamFilter, monthFilter, yearFilter])

  useEffect(() => { load() }, [load])

  const teamName = id => teams.find(t => t.id === id)?.name || '—'

  const openCreate = () => {
    setEditing(null)
    setForm({ ...EMPTY, team_id: teamFilter || '', year: new Date().getFullYear().toString() })
    setFormErr({})
    setOpen(true)
  }

  const openEdit = a => {
    setEditing(a)
    setForm({
      title: a.title || '', description: a.description || '',
      team_id: a.team_id || '', month: String(a.month || ''),
      year: String(a.year || ''), impact: a.impact || '',
    })
    setFormErr({})
    setOpen(true)
  }

  const validate = () => {
    const e = {}
    if (!form.title.trim()) e.title   = 'Title is required'
    if (!form.team_id)      e.team_id = 'Team is required'
    if (!form.month)        e.month   = 'Month is required'
    if (!form.year)         e.year    = 'Year is required'
    return e
  }

  const handleSave = async () => {
    const e = validate()
    if (Object.keys(e).length) { setFormErr(e); return }
    setSaving(true)
    try {
      const payload = { ...form, month: parseInt(form.month), year: parseInt(form.year) }
      editing ? await updateAchievement(editing.id, payload) : await createAchievement(payload)
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
        <Typography variant="h5" fontWeight={700}>Achievements</Typography>
        {canWrite && (
          <Button variant="contained" startIcon={<Add />} onClick={openCreate}>
            Add Achievement
          </Button>
        )}
      </Box>

      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <TextField
          select label="Team" size="small" sx={{ minWidth: 200 }}
          value={teamFilter} onChange={e => setTeamFilter(e.target.value)}
        >
          <MenuItem value="">All teams</MenuItem>
          {teams.map(t => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
        </TextField>
        <TextField
          select label="Month" size="small" sx={{ minWidth: 120 }}
          value={monthFilter} onChange={e => setMonthFilter(e.target.value)}
        >
          <MenuItem value="">All months</MenuItem>
          {MONTHS.map((m, i) => <MenuItem key={i} value={i + 1}>{m}</MenuItem>)}
        </TextField>
        <TextField
          select label="Year" size="small" sx={{ minWidth: 100 }}
          value={yearFilter} onChange={e => setYearFilter(e.target.value)}
        >
          <MenuItem value="">All years</MenuItem>
          {YEARS.map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
        </TextField>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TableContainer component={Paper} elevation={2}>
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: 'grey.50' }}>
              <TableCell><strong>Title</strong></TableCell>
              <TableCell><strong>Team</strong></TableCell>
              <TableCell><strong>Period</strong></TableCell>
              <TableCell><strong>Impact</strong></TableCell>
              <TableCell align="right"><strong>Actions</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} align="center"><CircularProgress size={24} /></TableCell></TableRow>
            ) : achievs.length === 0 ? (
              <TableRow><TableCell colSpan={5} align="center" sx={{ color: 'text.secondary', py: 4 }}>
                No achievements found
              </TableCell></TableRow>
            ) : achievs.map(a => (
              <TableRow key={a.id} hover>
                <TableCell>
                  <Typography fontWeight={600}>{a.title}</Typography>
                  {a.description && (
                    <Typography variant="caption" color="text.secondary">{a.description}</Typography>
                  )}
                </TableCell>
                <TableCell>{teamName(a.team_id)}</TableCell>
                <TableCell>
                  <Chip size="small" label={`${MONTHS[(a.month || 1) - 1]} ${a.year}`} />
                </TableCell>
                <TableCell>{a.impact || '—'}</TableCell>
                <TableCell align="right">
                  {canWrite && (
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => openEdit(a)}><Edit fontSize="small" /></IconButton>
                    </Tooltip>
                  )}
                  {canDelete && (
                    <Tooltip title="Delete">
                      <IconButton size="small" color="error" onClick={() => setDeleting(a)}>
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
        <DialogTitle>{editing ? 'Edit Achievement' : 'Add Achievement'}</DialogTitle>
        <DialogContent>
          {formErr._api && <Alert severity="error" sx={{ mb: 1 }}>{formErr._api}</Alert>}
          <Grid container spacing={1}>
            <Grid item xs={12}>
              <TextField label="Title" fullWidth margin="dense" required {...f('title')} />
            </Grid>
            <Grid item xs={12}>
              <TextField select label="Team" fullWidth margin="dense" required {...f('team_id')}>
                <MenuItem value="">Select a team</MenuItem>
                {teams.map(t => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={6}>
              <TextField select label="Month" fullWidth margin="dense" required {...f('month')}>
                <MenuItem value="">Select month</MenuItem>
                {MONTHS.map((m, i) => <MenuItem key={i} value={i + 1}>{m}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={6}>
              <TextField select label="Year" fullWidth margin="dense" required {...f('year')}>
                <MenuItem value="">Select year</MenuItem>
                {YEARS.map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField label="Description" fullWidth margin="dense" multiline rows={2} {...f('description')} />
            </Grid>
            <Grid item xs={12}>
              <TextField label="Business Impact" fullWidth margin="dense" {...f('impact')} />
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
        title="Delete Achievement"
        message={`Delete "${deleting?.title}"?`}
        onConfirm={async () => { await deleteAchievement(deleting.id); setDeleting(null); load() }}
        onCancel={() => setDeleting(null)}
      />
    </Box>
  )
}
