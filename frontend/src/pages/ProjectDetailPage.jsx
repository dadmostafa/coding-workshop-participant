import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Box, Typography, Button, Grid, Card, CardContent,
  Chip, CircularProgress, Alert, Divider, IconButton,
  Tooltip, Avatar, LinearProgress,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem,
} from '@mui/material'
import {
  ArrowBack, Delete, Add, Person, Edit,
} from '@mui/icons-material'
import {
  getProject, updateProject, getMembers,
  addProjectMember, removeProjectMember,
} from '../services/api'
import { useAuth } from '../context/AuthContext'
import ConfirmDialog from '../components/ConfirmDialog'
import { formatDate } from '../utils/time'

const STATUS_CONFIG = {
  backlog: { label: 'Backlog', color: '#8b8fa8' },
  planning: { label: 'Planning', color: '#74B9FF' },
  in_progress: { label: 'In Progress', color: '#FFD166' },
  review: { label: 'Review', color: '#A29BFE' },
  completed: { label: 'Completed', color: '#6BCB77' },
  on_hold: { label: 'On Hold', color: '#FF9F43' },
  cancelled: { label: 'Cancelled', color: '#FF6B6B' },
}

const PRIORITY_CONFIG = {
  low: { label: 'Low', color: '#8b8fa8' },
  medium: { label: 'Medium', color: '#FFD166' },
  high: { label: 'High', color: '#FF9F43' },
  critical: { label: 'Critical', color: '#FF6B6B' },
}

const AVATAR_COLORS = ['#FF6B6B', '#FFD166', '#6BCB77', '#4ECDC4', '#A29BFE', '#74B9FF']
const getColor = name => AVATAR_COLORS[(name?.charCodeAt(0) || 0) % AVATAR_COLORS.length]

export default function ProjectDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { canWrite } = useAuth()

  const [project, setProject] = useState(null)
  const [allMembers, setAllMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [addMemberOpen, setAddMemberOpen] = useState(false)
  const [selectedMember, setSelectedMember] = useState('')
  const [memberRole, setMemberRole] = useState('member')
  const [addingMember, setAddingMember] = useState(false)
  const [removingMember, setRemovingMember] = useState(null)
  const [progressEdit, setProgressEdit] = useState(false)
  const [newProgress, setNewProgress] = useState(0)

  const load = async () => {
    setLoading(true)
    try {
      const [p, m] = await Promise.all([
        getProject(id),
        getMembers(),
      ])
      setProject(p)
      setAllMembers(m)
      setNewProgress(p.progress || 0)
    } catch {
      setError('Failed to load project')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  const handleAddMember = async () => {
    if (!selectedMember) return
    setAddingMember(true)
    try {
      await addProjectMember(id, { member_id: selectedMember, role: memberRole })
      setAddMemberOpen(false)
      setSelectedMember('')
      setMemberRole('member')
      load()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add member')
    } finally {
      setAddingMember(false)
    }
  }

  const handleUpdateProgress = async () => {
    await updateProject(id, { progress: newProgress })
    setProgressEdit(false)
    load()
  }

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress sx={{ color: '#6BCB77' }} /></Box>
  if (error) return <Alert severity="error">{error}</Alert>
  if (!project) return <Alert severity="warning">Project not found</Alert>

  const status = STATUS_CONFIG[project.status] || STATUS_CONFIG.backlog
  const priority = PRIORITY_CONFIG[project.priority] || PRIORITY_CONFIG.medium
  const isOverdue = project.due_date
    && new Date(project.due_date) < new Date()
    && !['completed', 'cancelled'].includes(project.status)

  const availableMembers = allMembers.filter(m =>
    !project.members?.find(pm => pm.member_id === m.id)
  )

  return (
    <Box>
      <Button startIcon={<ArrowBack />} onClick={() => navigate('/projects')}
        sx={{ color: '#8b8fa8', mb: 2, '&:hover': { color: 'text.primary' } }}>
        Back to Projects
      </Button>

      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
            <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: status.color }} />
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
                border: `1px solid ${priority.color}30` }} />
            {project.tags?.map(tag => (
              <Chip key={tag} label={tag} size="small"
                sx={{ bgcolor: 'rgba(139,143,168,0.1)', color: '#8b8fa8',
                  border: '1px solid rgba(139,143,168,0.2)', fontSize: '0.7rem' }} />
            ))}
          </Box>
        </Box>
        {canWrite && (
          <Button startIcon={<Edit />} onClick={() => navigate('/projects')}
            sx={{ color: '#8b8fa8', border: '1px solid #2a2d3e', borderRadius: 2 }}>
            Edit
          </Button>
        )}
      </Box>

      <Grid container spacing={1.5} mb={3}>
        {project.owner_name && (
          <Grid item xs={6} sm={4} md={2}>
            <Card sx={{ bgcolor: '#16171f', border: '1px solid #2a2d3e' }}>
              <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Typography variant="caption" sx={{ color: '#8b8fa8', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, display: 'block' }}>Owner</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mt: 0.5 }}>
                  <Avatar sx={{ width: 20, height: 20, bgcolor: `${getColor(project.owner_name)}20`, color: getColor(project.owner_name), fontSize: 10, fontWeight: 700 }}>
                    {project.owner_name[0].toUpperCase()}
                  </Avatar>
                  <Typography variant="body2" fontWeight={600}>{project.owner_name}</Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        )}
        {project.start_date && (
          <Grid item xs={6} sm={4} md={2}>
            <Card sx={{ bgcolor: '#16171f', border: '1px solid #2a2d3e' }}>
              <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Typography variant="caption" sx={{ color: '#8b8fa8', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, display: 'block' }}>Start Date</Typography>
                <Typography variant="body2" fontWeight={600} mt={0.3}>{formatDate(project.start_date)}</Typography>
              </CardContent>
            </Card>
          </Grid>
        )}
        {project.due_date && (
          <Grid item xs={6} sm={4} md={2}>
            <Card sx={{ bgcolor: '#16171f', border: `1px solid ${isOverdue ? 'rgba(255,107,107,0.3)' : '#2a2d3e'}` }}>
              <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Typography variant="caption" sx={{ color: '#8b8fa8', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, display: 'block' }}>Due Date</Typography>
                <Typography variant="body2" fontWeight={600} sx={{ color: isOverdue ? '#FF6B6B' : 'text.primary' }} mt={0.3}>
                  {isOverdue ? '⚠ ' : ''}{formatDate(project.due_date)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        )}
        <Grid item xs={6} sm={4} md={2}>
          <Card sx={{ bgcolor: '#16171f', border: '1px solid #2a2d3e' }}>
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Typography variant="caption" sx={{ color: '#8b8fa8', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, display: 'block' }}>Created</Typography>
              <Typography variant="body2" fontWeight={600} mt={0.3}>{formatDate(project.created_at)}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card sx={{ bgcolor: '#1e2029', border: '1px solid #2a2d3e', mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
            <Typography variant="body2" fontWeight={700}>Progress</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {progressEdit ? (
                <>
                  <TextField type="number" size="small" value={newProgress}
                    onChange={e => setNewProgress(Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0)))}
                    inputProps={{ min: 0, max: 100 }}
                    sx={{ width: 80, '& input': { py: 0.5 } }} />
                  <Button size="small" onClick={handleUpdateProgress}
                    sx={{ bgcolor: '#6BCB77', color: '#13141a', minWidth: 0, px: 1.5 }}>Save</Button>
                  <Button size="small" onClick={() => setProgressEdit(false)}
                    sx={{ color: '#8b8fa8' }}>Cancel</Button>
                </>
              ) : (
                <>
                  <Typography variant="h6" fontWeight={800} sx={{ color: status.color }}>
                    {project.progress || 0}%
                  </Typography>
                  {canWrite && (
                    <IconButton size="small" onClick={() => setProgressEdit(true)}
                      sx={{ color: '#8b8fa8', '&:hover': { color: '#FFD166' } }}>
                      <Edit sx={{ fontSize: 14 }} />
                    </IconButton>
                  )}
                </>
              )}
            </Box>
          </Box>
          <LinearProgress variant="determinate" value={project.progress || 0}
            sx={{ height: 8, borderRadius: 4, bgcolor: '#2a2d3e',
              '& .MuiLinearProgress-bar': { bgcolor: status.color, borderRadius: 4 } }} />
        </CardContent>
      </Card>

      <Divider sx={{ borderColor: '#2a2d3e', mb: 3 }} />

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Person sx={{ color: '#4ECDC4', fontSize: 20 }} />
          <Typography variant="h6" fontWeight={600}>Team Members</Typography>
          <Chip label={project.members?.length || 0} size="small"
            sx={{ bgcolor: 'rgba(78,205,196,0.15)', color: '#4ECDC4',
              border: '1px solid rgba(78,205,196,0.3)', fontWeight: 700 }} />
        </Box>
        {canWrite && (
          <Button size="small" startIcon={<Add />}
            onClick={() => setAddMemberOpen(true)}
            sx={{ color: '#4ECDC4', border: '1px solid rgba(78,205,196,0.3)', borderRadius: 2,
              '&:hover': { bgcolor: 'rgba(78,205,196,0.1)' } }}>
            Add Member
          </Button>
        )}
      </Box>

      {!project.members?.length ? (
        <Box sx={{ textAlign: 'center', py: 4, color: '#8b8fa8' }}>
          <Typography variant="body2">No members assigned yet</Typography>
        </Box>
      ) : (
        <Grid container spacing={1.5} mb={3}>
          {project.members.map((m, i) => {
            const color = getColor(m.member_name)
            const isOwner = m.member_id === project.owner_id
            return (
              <Grid item xs={12} sm={6} md={4} key={i}>
                <Card sx={{ bgcolor: '#16171f', border: `1px solid ${isOwner ? color + '40' : '#2a2d3e'}`,
                  transition: 'all 0.2s ease', '&:hover': { border: `1px solid ${color}60` } }}>
                  <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Avatar sx={{ width: 36, height: 36, bgcolor: `${color}20`, color, fontSize: 14, fontWeight: 700, border: `1px solid ${color}40` }}>
                          {(m.member_name || '?')[0].toUpperCase()}
                        </Avatar>
                        <Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Typography variant="body2" fontWeight={700}>{m.member_name}</Typography>
                            {isOwner && <Chip label="Owner" size="small"
                              sx={{ bgcolor: `${color}20`, color, border: `1px solid ${color}40`,
                                fontSize: '0.6rem', height: 16, fontWeight: 700 }} />}
                          </Box>
                          <Chip label={m.role} size="small"
                            sx={{ bgcolor: 'rgba(139,143,168,0.1)', color: '#8b8fa8',
                              border: '1px solid rgba(139,143,168,0.2)', fontSize: '0.65rem', height: 18 }} />
                        </Box>
                      </Box>
                      {canWrite && (
                        <Tooltip title="Remove from project">
                          <IconButton size="small"
                            onClick={() => setRemovingMember(m)}
                            sx={{ color: '#8b8fa8', '&:hover': { color: '#FF6B6B' } }}>
                            <Delete sx={{ fontSize: 14 }} />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>
                    {m.added_at && (
                      <Typography variant="caption" color="text.secondary"
                        sx={{ display: 'block', mt: 0.5, pl: 0.5 }}>
                        Added {formatDate(m.added_at)} by {m.added_by}
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            )
          })}
        </Grid>
      )}

      <Dialog open={addMemberOpen} onClose={() => setAddMemberOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Add Member to Project</DialogTitle>
        <DialogContent>
          <TextField select label="Select Member" fullWidth margin="normal"
            value={selectedMember} onChange={e => setSelectedMember(e.target.value)}>
            <MenuItem value="">Choose a member</MenuItem>
            {availableMembers.map(m => (
              <MenuItem key={m.id} value={m.id}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Avatar sx={{ width: 24, height: 24, bgcolor: `${getColor(m.name)}20`,
                    color: getColor(m.name), fontSize: 10, fontWeight: 700 }}>
                    {m.name[0].toUpperCase()}
                  </Avatar>
                  {m.name} - {m.role}
                </Box>
              </MenuItem>
            ))}
          </TextField>
          <TextField select label="Project Role" fullWidth margin="normal"
            value={memberRole} onChange={e => setMemberRole(e.target.value)}>
            <MenuItem value="member">Member</MenuItem>
            <MenuItem value="lead">Lead</MenuItem>
            <MenuItem value="reviewer">Reviewer</MenuItem>
            <MenuItem value="stakeholder">Stakeholder</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setAddMemberOpen(false)} sx={{ color: '#8b8fa8' }}>Cancel</Button>
          <Button variant="contained" onClick={handleAddMember}
            disabled={!selectedMember || addingMember}
            sx={{ bgcolor: '#4ECDC4', color: '#13141a', '&:hover': { bgcolor: '#3dbdb5' } }}>
            {addingMember ? <CircularProgress size={18} /> : 'Add'}
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
