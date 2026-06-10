import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Box, Typography, Button, Grid, Card, CardContent,
  Chip, CircularProgress, Alert, Divider, IconButton,
  Tooltip, Avatar, LinearProgress, AvatarGroup,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, Checkbox, List, ListItem,
  ListItemText, ListItemIcon, InputAdornment,
} from '@mui/material'
import {
  ArrowBack, Delete, Add, Person, Edit,
  CheckCircle, RadioButtonUnchecked, PendingOutlined,
  AttachMoney, TrendingUp,
} from '@mui/icons-material'
import {
  getProject, updateProject, getMembers,
  addProjectMember, removeProjectMember,
  addProjectDeliverable, updateProjectDeliverable, deleteProjectDeliverable,
} from '../services/api'
import { useAuth }       from '../context/AuthContext'
import ConfirmDialog     from '../components/ConfirmDialog'
import { formatDate, formatDateTime } from '../utils/time'


const STATUS_CONFIG = {
  backlog:     { label: 'Backlog',     color: '#8b8fa8' },
  planning:    { label: 'Planning',    color: '#74B9FF' },
  in_progress: { label: 'In Progress', color: '#FFD166' },
  review:      { label: 'Review',      color: '#A29BFE' },
  completed:   { label: 'Completed',   color: '#6BCB77' },
  on_hold:     { label: 'On Hold',     color: '#FF9F43' },
  cancelled:   { label: 'Cancelled',   color: '#FF6B6B' },
}

const PRIORITY_CONFIG = {
  low:      { label: 'Low',      color: '#8b8fa8' },
  medium:   { label: 'Medium',   color: '#FFD166' },
  high:     { label: 'High',     color: '#FF9F43' },
  critical: { label: 'Critical', color: '#FF6B6B' },
}

const AVATAR_COLORS = ['#FF6B6B','#FFD166','#6BCB77','#4ECDC4','#A29BFE','#74B9FF']
const getColor = name => AVATAR_COLORS[(name?.charCodeAt(0) || 0) % AVATAR_COLORS.length]

// Format currency
const fmt = (amount, currency = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount || 0)

// ── Deliverable Item ──────────────────────────────────────────────────────────
function DeliverableItem({ item, onStatusChange, onDelete, canWrite }) {
  const statusIcon = {
    done:        <CheckCircle sx={{ color: '#6BCB77', fontSize: 20 }} />,
    in_progress: <PendingOutlined sx={{ color: '#FFD166', fontSize: 20 }} />,
    pending:     <RadioButtonUnchecked sx={{ color: '#8b8fa8', fontSize: 20 }} />,
  }

  const nextStatus = {
    pending:     'in_progress',
    in_progress: 'done',
    done:        'pending',
  }

  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: 1.5,
      py: 1.2, px: 1.5,
      borderRadius: 2,
      transition: 'background 0.15s ease',
      '&:hover': { bgcolor: '#252736' },
    }}>
      {/* Status toggle */}
      <Tooltip title={`Mark as ${nextStatus[item.status]?.replace('_', ' ')}`}>
        <IconButton size="small" onClick={() => onStatusChange(item.id, nextStatus[item.status])}
          disabled={!canWrite} sx={{ p: 0.2 }}>
          {statusIcon[item.status]}
        </IconButton>
      </Tooltip>

      {/* Title */}
      <Typography variant="body2" sx={{
        flex: 1,
        textDecoration: item.status === 'done' ? 'line-through' : 'none',
        color: item.status === 'done' ? 'text.secondary' : 'text.primary',
        fontWeight: item.status === 'done' ? 400 : 500,
      }}>
        {item.title}
      </Typography>

      {/* Status chip */}
      <Chip
        label={item.status.replace('_', ' ')}
        size="small"
        sx={{
          bgcolor: item.status === 'done'        ? 'rgba(107,203,119,0.12)' :
                   item.status === 'in_progress' ? 'rgba(255,209,102,0.12)' :
                   'rgba(139,143,168,0.1)',
          color:   item.status === 'done'        ? '#6BCB77' :
                   item.status === 'in_progress' ? '#FFD166'  : '#8b8fa8',
          border: 'none',
          fontSize: '0.65rem', fontWeight: 600, height: 20,
          textTransform: 'capitalize',
        }}
      />

      {/* Done by */}
      {item.done_by && (
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
          {item.done_by}
        </Typography>
      )}

      {/* Delete */}
      {canWrite && (
        <IconButton size="small" onClick={() => onDelete(item.id)}
          sx={{ color: '#8b8fa8', p: 0.2, opacity: 0, '.parent:hover &': { opacity: 1 },
            '&:hover': { color: '#FF6B6B' } }}>
          <Delete sx={{ fontSize: 14 }} />
        </IconButton>
      )}
    </Box>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ProjectDetailPage() {
  const { id }   = useParams()
  const navigate = useNavigate()
  const { canWrite, canDelete } = useAuth()

  const [project,       setProject]       = useState(null)
  const [allMembers,    setAllMembers]    = useState([])
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState('')
  const [saving,        setSaving]        = useState(false)

  // Member dialog
  const [addMemberOpen,   setAddMemberOpen]   = useState(false)
  const [selectedMember,  setSelectedMember]  = useState('')
  const [memberRole,      setMemberRole]      = useState('member')
  const [memberDailyRate, setMemberDailyRate] = useState('')
  const [memberDays,      setMemberDays]      = useState('')
  const [addingMember,    setAddingMember]    = useState(false)
  const [removingMember,  setRemovingMember]  = useState(null)

  // Deliverable input
  const [newDeliverable, setNewDeliverable] = useState('')
  const [addingItem,     setAddingItem]     = useState(false)

  // Budget edit
  const [budgetEdit,      setBudgetEdit]    = useState(false)
  const [newBudget,       setNewBudget]     = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const [p, m] = await Promise.all([getProject(id), getMembers()])
      setProject(p)
      setAllMembers(m)
      setNewBudget(p.total_budget || 0)
    } catch { setError('Failed to load project') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [id])

  // ── Deliverable actions ───────────────────────────────────────────────────

  const handleAddDeliverable = async () => {
    if (!newDeliverable.trim()) return
    setAddingItem(true)
    try {
      const result = await addProjectDeliverable(id, { title: newDeliverable.trim() })
      setNewDeliverable('')
      setProject(p => ({
        ...p,
        deliverables: [...(p.deliverables || []), result.item],
        progress:     result.progress,
      }))
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add deliverable')
    } finally { setAddingItem(false) }
  }

  const handleDeliverableStatus = async (itemId, newStatus) => {
    try {
      const result = await updateProjectDeliverable(id, itemId, { status: newStatus })
      setProject(p => ({
        ...p,
        deliverables: result.deliverables,
        progress:     result.progress,
      }))
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update')
    }
  }

  const handleDeleteDeliverable = async (itemId) => {
    try {
      const result = await deleteProjectDeliverable(id, itemId)
      setProject(p => ({
        ...p,
        deliverables: result.deliverables,
        progress:     result.progress,
      }))
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete')
    }
  }

  // ── Budget update ─────────────────────────────────────────────────────────

  const handleBudgetSave = async () => {
    await updateProject(id, { total_budget: parseFloat(newBudget) || 0 })
    setBudgetEdit(false)
    load()
  }

  // ── Member actions ────────────────────────────────────────────────────────

  const handleAddMember = async () => {
    if (!selectedMember) return
    setAddingMember(true)
    try {
      await addProjectMember(id, {
        member_id:      selectedMember,
        role:           memberRole,
        daily_rate:     parseFloat(memberDailyRate) || 0,
        days_allocated: parseFloat(memberDays) || 0,
      })
      setAddMemberOpen(false)
      setSelectedMember(''); setMemberRole('member')
      setMemberDailyRate(''); setMemberDays('')
      load()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add member')
    } finally { setAddingMember(false) }
  }

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
      <CircularProgress sx={{ color: '#6BCB77' }} />
    </Box>
  )
  if (error)   return <Alert severity="error">{error}</Alert>
  if (!project) return <Alert severity="warning">Project not found</Alert>

  const status   = STATUS_CONFIG[project.status]    || STATUS_CONFIG.backlog
  const priority = PRIORITY_CONFIG[project.priority] || PRIORITY_CONFIG.medium
  const isOverdue = project.due_date &&
    new Date(project.due_date) < new Date() &&
    !['completed','cancelled'].includes(project.status)

  const availableMembers = allMembers.filter(m =>
    !project.members?.find(pm => pm.member_id === m.id)
  )

  const spentBudget   = project.spent_budget   || 0
  const totalBudget   = project.total_budget   || 0
  const budgetPct     = totalBudget > 0 ? Math.min(100, Math.round((spentBudget / totalBudget) * 100)) : 0
  const budgetColor   = budgetPct > 90 ? '#FF6B6B' : budgetPct > 70 ? '#FF9F43' : '#6BCB77'

  const deliverables  = project.deliverables || []
  const doneCount     = deliverables.filter(d => d.status === 'done').length
  const inProgCount   = deliverables.filter(d => d.status === 'in_progress').length
  const pendingCount  = deliverables.filter(d => d.status === 'pending').length

  return (
    <Box>
      <Button startIcon={<ArrowBack />} onClick={() => navigate('/projects')}
        sx={{ color: '#8b8fa8', mb: 2, '&:hover': { color: 'text.primary' } }}>
        Back to Projects
      </Button>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: status.color }} />
            <Typography variant="h5" fontWeight={700}>{project.name}</Typography>
          </Box>
          {project.description && (
            <Typography color="text.secondary" variant="body2">{project.description}</Typography>
          )}
          <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
            <Chip label={status.label} size="small"
              sx={{ bgcolor: `${status.color}15`, color: status.color,
                border: `1px solid ${status.color}30`, fontWeight: 600 }} />
            <Chip label={priority.label} size="small"
              sx={{ bgcolor: `${priority.color}15`, color: priority.color,
                border: `1px solid ${priority.color}30`, fontWeight: 600 }} />
            {project.tags?.map(tag => (
              <Chip key={tag} label={tag} size="small"
                sx={{ bgcolor: '#252736', color: '#8b8fa8', border: '1px solid #2a2d3e' }} />
            ))}
          </Box>
        </Box>
      </Box>

      {/* ── Info row ───────────────────────────────────────────────────── */}
      <Grid container spacing={1.5} mb={3}>
        {project.owner_name && (
          <Grid item xs={6} sm={4} md={2}>
            <Card sx={{ bgcolor: '#16171f', border: '1px solid #2a2d3e' }}>
              <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Typography variant="caption" color="text.secondary"
                  sx={{ textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, fontSize: '0.65rem', display: 'block' }}>
                  Owner
                </Typography>
                <Typography variant="body2" fontWeight={600} mt={0.3}>{project.owner_name}</Typography>
              </CardContent>
            </Card>
          </Grid>
        )}
        {project.start_date && (
          <Grid item xs={6} sm={4} md={2}>
            <Card sx={{ bgcolor: '#16171f', border: '1px solid #2a2d3e' }}>
              <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Typography variant="caption" color="text.secondary"
                  sx={{ textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, fontSize: '0.65rem', display: 'block' }}>
                  Start
                </Typography>
                <Typography variant="body2" fontWeight={600} mt={0.3}>{formatDate(project.start_date)}</Typography>
              </CardContent>
            </Card>
          </Grid>
        )}
        {project.due_date && (
          <Grid item xs={6} sm={4} md={2}>
            <Card sx={{ bgcolor: '#16171f', border: `1px solid ${isOverdue ? 'rgba(255,107,107,0.3)' : '#2a2d3e'}` }}>
              <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Typography variant="caption" color="text.secondary"
                  sx={{ textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, fontSize: '0.65rem', display: 'block' }}>
                  Due Date
                </Typography>
                <Typography variant="body2" fontWeight={600}
                  sx={{ color: isOverdue ? '#FF6B6B' : 'text.primary', mt: 0.3 }}>
                  {isOverdue ? '⚠ ' : ''}{formatDate(project.due_date)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>

      <Grid container spacing={3}>
        {/* ── Left column ──────────────────────────────────────────────── */}
        <Grid item xs={12} md={7}>

          {/* Progress + Deliverables */}
          <Card sx={{ bgcolor: '#1e2029', border: '1px solid #2a2d3e', mb: 2.5 }}>
            <CardContent>
              {/* Progress bar */}
              <Box sx={{ mb: 2.5 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="body2" fontWeight={700}>Progress</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    {deliverables.length > 0 && (
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Chip label={`${doneCount} done`} size="small"
                          sx={{ bgcolor: 'rgba(107,203,119,0.12)', color: '#6BCB77',
                            border: '1px solid rgba(107,203,119,0.25)', fontSize: '0.65rem', height: 20 }} />
                        {inProgCount > 0 && (
                          <Chip label={`${inProgCount} in progress`} size="small"
                            sx={{ bgcolor: 'rgba(255,209,102,0.12)', color: '#FFD166',
                              border: '1px solid rgba(255,209,102,0.25)', fontSize: '0.65rem', height: 20 }} />
                        )}
                        {pendingCount > 0 && (
                          <Chip label={`${pendingCount} pending`} size="small"
                            sx={{ bgcolor: 'rgba(139,143,168,0.1)', color: '#8b8fa8',
                              border: '1px solid rgba(139,143,168,0.2)', fontSize: '0.65rem', height: 20 }} />
                        )}
                      </Box>
                    )}
                    <Typography variant="h6" fontWeight={800} sx={{ color: status.color }}>
                      {project.progress || 0}%
                    </Typography>
                  </Box>
                </Box>
                <LinearProgress variant="determinate" value={project.progress || 0}
                  sx={{ height: 8, borderRadius: 4, bgcolor: '#252736',
                    '& .MuiLinearProgress-bar': { bgcolor: status.color, borderRadius: 4,
                      transition: 'width 0.4s ease' } }} />
                {deliverables.length > 0 && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                    {doneCount} of {deliverables.length} deliverables completed
                  </Typography>
                )}
              </Box>

              <Divider sx={{ borderColor: '#2a2d3e', mb: 2 }} />

              {/* Deliverables checklist */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                <Typography variant="body2" fontWeight={700}>Deliverables</Typography>
                <Typography variant="caption" color="text.secondary">
                  Click to cycle status
                </Typography>
              </Box>

              {deliverables.length === 0 ? (
                <Typography variant="body2" color="text.secondary"
                  sx={{ textAlign: 'center', py: 3 }}>
                  No deliverables yet — add one below
                </Typography>
              ) : (
                <Box sx={{ mb: 1.5 }}>
                  {deliverables.map(item => (
                    <DeliverableItem
                      key={item.id}
                      item={item}
                      onStatusChange={handleDeliverableStatus}
                      onDelete={handleDeleteDeliverable}
                      canWrite={canWrite}
                    />
                  ))}
                </Box>
              )}

              {/* Add deliverable input */}
              {canWrite && (
                <Box sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
                  <TextField
                    placeholder="Add a deliverable…"
                    value={newDeliverable}
                    onChange={e => setNewDeliverable(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddDeliverable()}
                    size="small" fullWidth
                    sx={{ '& .MuiOutlinedInput-root': { bgcolor: '#16171f' } }}
                  />
                  <Button variant="contained" onClick={handleAddDeliverable}
                    disabled={!newDeliverable.trim() || addingItem}
                    sx={{ bgcolor: '#6BCB77', color: '#13141a', px: 2, flexShrink: 0,
                      '&:hover': { bgcolor: '#5ab868' } }}>
                    {addingItem ? <CircularProgress size={16} sx={{ color: '#13141a' }} /> : <Add />}
                  </Button>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* ── Right column ─────────────────────────────────────────────── */}
        <Grid item xs={12} md={5}>

          {/* Budget card */}
          <Card sx={{ bgcolor: '#1e2029', border: '1px solid #2a2d3e', mb: 2.5 }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AttachMoney sx={{ color: '#6BCB77', fontSize: 20 }} />
                  <Typography variant="body2" fontWeight={700}>Budget</Typography>
                </Box>
                {canWrite && !budgetEdit && (
                  <IconButton size="small" onClick={() => setBudgetEdit(true)}
                    sx={{ color: '#8b8fa8', '&:hover': { color: '#FFD166' } }}>
                    <Edit sx={{ fontSize: 15 }} />
                  </IconButton>
                )}
              </Box>

              {budgetEdit ? (
                <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                  <TextField size="small" type="number" fullWidth
                    label="Total Budget (USD)"
                    value={newBudget}
                    onChange={e => setNewBudget(e.target.value)}
                    InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
                  />
                  <Button variant="contained" onClick={handleBudgetSave}
                    sx={{ bgcolor: '#6BCB77', color: '#13141a', flexShrink: 0 }}>
                    Save
                  </Button>
                  <Button onClick={() => setBudgetEdit(false)} sx={{ color: '#8b8fa8', flexShrink: 0 }}>
                    Cancel
                  </Button>
                </Box>
              ) : (
                <Box sx={{ mb: 2 }}>
                  {/* Budget numbers */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Box>
                      <Typography variant="caption" color="text.secondary" display="block">Spent</Typography>
                      <Typography variant="h6" fontWeight={700} sx={{ color: budgetColor }}>
                        {fmt(spentBudget, project.currency)}
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography variant="caption" color="text.secondary" display="block">Budget</Typography>
                      <Typography variant="h6" fontWeight={700} color="text.primary">
                        {totalBudget > 0 ? fmt(totalBudget, project.currency) : 'Not set'}
                      </Typography>
                    </Box>
                  </Box>

                  {totalBudget > 0 && (
                    <>
                      <LinearProgress variant="determinate" value={budgetPct}
                        sx={{ height: 6, borderRadius: 3, bgcolor: '#252736',
                          '& .MuiLinearProgress-bar': { bgcolor: budgetColor, borderRadius: 3 } }} />
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                        <Typography variant="caption" sx={{ color: budgetColor, fontWeight: 700 }}>
                          {budgetPct}% used
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {fmt(totalBudget - spentBudget, project.currency)} remaining
                        </Typography>
                      </Box>
                    </>
                  )}
                </Box>
              )}

              {/* Budget breakdown by member type */}
              {project.members?.length > 0 && (
                <>
                  <Divider sx={{ borderColor: '#2a2d3e', mb: 1.5 }} />
                  <Typography variant="caption" color="text.secondary"
                    sx={{ textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, display: 'block', mb: 1 }}>
                    Cost Breakdown
                  </Typography>
                  {(() => {
                    const employees   = project.members.filter(m => m.member_type === 'direct')
                    const contractors = project.members.filter(m => m.member_type === 'non-direct')
                    const empCost     = employees.reduce((s, m)   => s + (m.cost || 0), 0)
                    const conCost     = contractors.reduce((s, m) => s + (m.cost || 0), 0)
                    return (
                      <Box sx={{ display: 'flex', gap: 1.5 }}>
                        <Box sx={{ flex: 1, p: 1.5, bgcolor: '#16171f', borderRadius: 2, border: '1px solid #2a2d3e' }}>
                          <Typography variant="caption" color="text.secondary" display="block">Employees</Typography>
                          <Typography variant="body2" fontWeight={700} sx={{ color: '#6BCB77' }}>
                            {fmt(empCost)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {employees.length} people
                          </Typography>
                        </Box>
                        <Box sx={{ flex: 1, p: 1.5, bgcolor: '#16171f', borderRadius: 2, border: '1px solid #2a2d3e' }}>
                          <Typography variant="caption" color="text.secondary" display="block">Contractors</Typography>
                          <Typography variant="body2" fontWeight={700} sx={{ color: '#FF9F43' }}>
                            {fmt(conCost)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {contractors.length} people
                          </Typography>
                        </Box>
                      </Box>
                    )
                  })()}
                </>
              )}
            </CardContent>
          </Card>

          {/* Team Members */}
          <Card sx={{ bgcolor: '#1e2029', border: '1px solid #2a2d3e' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Person sx={{ color: '#4ECDC4', fontSize: 18 }} />
                  <Typography variant="body2" fontWeight={700}>Team</Typography>
                  <Chip label={project.members?.length || 0} size="small"
                    sx={{ bgcolor: 'rgba(78,205,196,0.12)', color: '#4ECDC4',
                      border: '1px solid rgba(78,205,196,0.25)', fontWeight: 700, height: 20 }} />
                </Box>
                {canWrite && (
                  <Button size="small" startIcon={<Add sx={{ fontSize: 14 }} />}
                    onClick={() => setAddMemberOpen(true)}
                    sx={{ color: '#4ECDC4', border: '1px solid rgba(78,205,196,0.3)',
                      borderRadius: 2, fontSize: '0.75rem', py: 0.4,
                      '&:hover': { bgcolor: 'rgba(78,205,196,0.08)' } }}>
                    Add
                  </Button>
                )}
              </Box>

              {!project.members?.length ? (
                <Typography variant="body2" color="text.secondary"
                  sx={{ textAlign: 'center', py: 3 }}>
                  No members assigned
                </Typography>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {project.members.map((m, i) => {
                    const color   = getColor(m.member_name)
                    const isOwner = m.member_id === project.owner_id
                    return (
                      <Box key={i} sx={{
                        display: 'flex', alignItems: 'center', gap: 1.5,
                        p: 1.5, bgcolor: '#16171f', borderRadius: 2,
                        border: `1px solid ${isOwner ? color + '30' : '#2a2d3e'}`,
                      }}>
                        <Avatar sx={{ width: 32, height: 32, bgcolor: `${color}20`,
                          color, fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                          {(m.member_name || '?')[0].toUpperCase()}
                        </Avatar>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Typography variant="body2" fontWeight={600} noWrap>{m.member_name}</Typography>
                            {isOwner && <Chip label="Owner" size="small"
                              sx={{ bgcolor: `${color}15`, color, border: `1px solid ${color}30`,
                                fontSize: '0.6rem', height: 16, fontWeight: 700 }} />}
                          </Box>
                          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                            <Chip label={m.role} size="small"
                              sx={{ bgcolor: '#252736', color: '#8b8fa8',
                                border: '1px solid #2a2d3e', fontSize: '0.6rem', height: 18 }} />
                            <Chip
                              label={m.member_type === 'non-direct' ? 'Contractor' : 'Employee'}
                              size="small"
                              sx={{
                                bgcolor: m.member_type === 'non-direct'
                                  ? 'rgba(255,159,67,0.1)' : 'rgba(107,203,119,0.1)',
                                color: m.member_type === 'non-direct' ? '#FF9F43' : '#6BCB77',
                                border: `1px solid ${m.member_type === 'non-direct' ? 'rgba(255,159,67,0.25)' : 'rgba(107,203,119,0.25)'}`,
                                fontSize: '0.6rem', height: 18,
                              }}
                            />
                          </Box>
                        </Box>
                        <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                          {m.cost > 0 && (
                            <Typography variant="body2" fontWeight={700} sx={{ color: '#FFD166' }}>
                              {fmt(m.cost)}
                            </Typography>
                          )}
                          {m.days_allocated > 0 && (
                            <Typography variant="caption" color="text.secondary">
                              {m.days_allocated}d @ ${m.daily_rate}/d
                            </Typography>
                          )}
                        </Box>
                        {canWrite && (
                          <Tooltip title="Remove">
                            <IconButton size="small" onClick={() => setRemovingMember(m)}
                              sx={{ color: '#8b8fa8', '&:hover': { color: '#FF6B6B' } }}>
                              <Delete sx={{ fontSize: 14 }} />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    )
                  })}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Add Member Dialog */}
      <Dialog open={addMemberOpen} onClose={() => setAddMemberOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Add Member to Project</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2, bgcolor: 'rgba(78,205,196,0.08)', color: '#4ECDC4',
            border: '1px solid rgba(78,205,196,0.2)', fontSize: '0.8rem' }}>
            Daily rate × days allocated = cost added to project budget
          </Alert>
          <TextField select label="Member" fullWidth margin="dense"
            value={selectedMember} onChange={e => setSelectedMember(e.target.value)}>
            <MenuItem value="">Choose a member</MenuItem>
            {availableMembers.map(m => (
              <MenuItem key={m.id} value={m.id}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Avatar sx={{ width: 22, height: 22, bgcolor: `${getColor(m.name)}20`,
                    color: getColor(m.name), fontSize: 10, fontWeight: 700 }}>
                    {m.name[0].toUpperCase()}
                  </Avatar>
                  {m.name}
                  <Chip label={m.employment_type === 'non-direct' ? 'Contractor' : 'Employee'}
                    size="small" sx={{
                      ml: 'auto',
                      bgcolor: m.employment_type === 'non-direct'
                        ? 'rgba(255,159,67,0.1)' : 'rgba(107,203,119,0.1)',
                      color: m.employment_type === 'non-direct' ? '#FF9F43' : '#6BCB77',
                      fontSize: '0.6rem',
                    }} />
                </Box>
              </MenuItem>
            ))}
          </TextField>
          <TextField select label="Project Role" fullWidth margin="dense"
            value={memberRole} onChange={e => setMemberRole(e.target.value)}>
            <MenuItem value="member">Member</MenuItem>
            <MenuItem value="lead">Lead</MenuItem>
            <MenuItem value="reviewer">Reviewer</MenuItem>
            <MenuItem value="stakeholder">Stakeholder</MenuItem>
          </TextField>
          <Grid container spacing={1} sx={{ mt: 0.5 }}>
            <Grid item xs={6}>
              <TextField label="Daily Rate ($)" type="number" fullWidth size="small"
                value={memberDailyRate} onChange={e => setMemberDailyRate(e.target.value)}
                InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
                helperText="Per day rate" />
            </Grid>
            <Grid item xs={6}>
              <TextField label="Days Allocated" type="number" fullWidth size="small"
                value={memberDays} onChange={e => setMemberDays(e.target.value)}
                helperText="Estimated days" />
            </Grid>
          </Grid>
          {memberDailyRate && memberDays && (
            <Box sx={{ mt: 1.5, p: 1.5, bgcolor: '#16171f', borderRadius: 2, border: '1px solid #2a2d3e' }}>
              <Typography variant="body2" fontWeight={700}>
                Estimated cost: {fmt(parseFloat(memberDailyRate) * parseFloat(memberDays))}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setAddMemberOpen(false)} sx={{ color: '#8b8fa8' }}>Cancel</Button>
          <Button variant="contained" onClick={handleAddMember}
            disabled={!selectedMember || addingMember}
            sx={{ bgcolor: '#4ECDC4', color: '#13141a', fontWeight: 700,
              '&:hover': { bgcolor: '#3dbdb5' } }}>
            {addingMember ? <CircularProgress size={18} /> : 'Add Member'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={!!removingMember}
        title="Remove Member"
        message={`Remove ${removingMember?.member_name} from this project?`}
        onConfirm={async () => {
          await removeProjectMember(id, removingMember.member_id)
          setRemovingMember(null)
          load()
        }}
        onCancel={() => setRemovingMember(null)}
      />
    </Box>
  )
}
