import { useState, useEffect } from 'react'
import {
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Alert,
  AlertTitle,
  Container,
  Stack,
  Typography,
  CircularProgress,
} from '@mui/material'
import {
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  People as PeopleIcon,
} from '@mui/icons-material'
import { useAuth } from '../context/AuthContext'
import * as api from '../services/api'

export default function TeamsPage() {
  const { user, canWrite, canDelete } = useAuth()
  const [teams, setTeams] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [openDialog, setOpenDialog] = useState(false)
  const [openDeleteConfirm, setOpenDeleteConfirm] = useState(false)
  const [selectedTeam, setSelectedTeam] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    department: '',
    location: '',
    team_leader: '',
    leader_location: '',
    org_leader: '',
    description: '',
  })
  const [formErrors, setFormErrors] = useState({})

  // Load teams
  useEffect(() => {
    loadTeams()
  }, [])

  const loadTeams = async () => {
    try {
      setLoading(true)
      const data = await api.getTeams()
      setTeams(Array.isArray(data) ? data : [])
      setError('')
    } catch (err) {
      setError('Failed to load teams: ' + (err.response?.data?.error || err.message))
      setTeams([])
    } finally {
      setLoading(false)
    }
  }

  const validateForm = () => {
    const errors = {}
    if (!formData.name?.trim()) errors.name = 'Team name is required'
    if (!formData.department?.trim()) errors.department = 'Department is required'
    if (!formData.location?.trim()) errors.location = 'Location is required'
    if (!formData.team_leader?.trim()) errors.team_leader = 'Team leader is required'
    return errors
  }

  const openCreateDialog = () => {
    setSelectedTeam(null)
    setFormData({
      name: '',
      department: '',
      location: '',
      team_leader: '',
      leader_location: '',
      org_leader: '',
      description: '',
    })
    setFormErrors({})
    setOpenDialog(true)
  }

  const openEditDialog = team => {
    setSelectedTeam(team)
    setFormData(team)
    setFormErrors({})
    setOpenDialog(true)
  }

  const handleSave = async () => {
    const errors = validateForm()
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }

    try {
      if (selectedTeam) {
        await api.updateTeam(selectedTeam.id, formData)
      } else {
        await api.createTeam(formData)
      }
      setOpenDialog(false)
      loadTeams()
      setError('')
    } catch (err) {
      setError('Failed to save team: ' + (err.response?.data?.error || err.message))
    }
  }

  const handleDelete = async () => {
    try {
      await api.deleteTeam(selectedTeam.id)
      setOpenDeleteConfirm(false)
      loadTeams()
      setError('')
    } catch (err) {
      setError('Failed to delete team: ' + (err.response?.data?.error || err.message))
    }
  }

  const handleCloseDialog = () => {
    setOpenDialog(false)
    setSelectedTeam(null)
  }

  // Health badge component
  const HealthBadge = ({ team }) => {
    const health = team.health || {}
    const status = health.status || 'healthy'
    
    const getIcon = () => {
      if (status === 'critical') return <ErrorIcon sx={{ color: '#ff5252' }} />
      if (status === 'warning') return <WarningIcon sx={{ color: '#ffb74d' }} />
      return <CheckCircleIcon sx={{ color: '#66bb6a' }} />
    }

    const getColor = () => {
      if (status === 'critical') return 'error'
      if (status === 'warning') return 'warning'
      return 'success'
    }

    const issueCount = (health.errors?.length || 0) + (health.warnings?.length || 0)

    return (
      <Stack direction="row" spacing={1} alignItems="center">
        {getIcon()}
        <Stack spacing={0.5}>
          <Typography variant="caption" sx={{ fontWeight: 600 }}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Typography>
          {issueCount > 0 && (
            <Chip
              size="small"
              label={`${issueCount} issue${issueCount !== 1 ? 's' : ''}`}
              variant="outlined"
              color={getColor()}
            />
          )}
        </Stack>
      </Stack>
    )
  }

  // Health issues panel
  const HealthIssuesPanel = ({ team }) => {
    const health = team.health || {}
    const errors = health.errors || []
    const warnings = health.warnings || []

    if (errors.length === 0 && warnings.length === 0) return null

    return (
      <Box sx={{ mt: 2, p: 1.5, bgcolor: 'rgba(255, 0, 0, 0.05)', borderRadius: 1 }}>
        {errors.length > 0 && (
          <Stack spacing={1} sx={{ mb: errors.length && warnings.length ? 2 : 0 }}>
            {errors.map((err, i) => (
              <Alert severity="error" key={i} icon={<ErrorIcon />} sx={{ mb: 0.5 }}>
                <AlertTitle>{err.code}</AlertTitle>
                {err.message}
              </Alert>
            ))}
          </Stack>
        )}
        {warnings.length > 0 && (
          <Stack spacing={1}>
            {warnings.map((warn, i) => (
              <Alert severity="warning" key={i} icon={<WarningIcon />} sx={{ mb: 0.5 }}>
                <AlertTitle>{warn.code}</AlertTitle>
                {warn.message}
              </Alert>
            ))}
          </Stack>
        )}
      </Box>
    )
  }

  // Health summary stats
  const healthStats = teams.reduce(
    (acc, t) => {
      const status = t.health?.status || 'healthy'
      acc[status] = (acc[status] || 0) + 1
      return acc
    },
    { healthy: 0, warning: 0, critical: 0 }
  )

  return (
    <Container maxWidth="lg">
      <Stack spacing={3} sx={{ py: 3 }}>
        {/* Header */}
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack spacing={1}>
            <Typography variant="h4">Teams</Typography>
            <Stack direction="row" spacing={2}>
              <Stack direction="row" spacing={0.5} alignItems="center">
                <CheckCircleIcon sx={{ color: '#66bb6a', fontSize: '1.2rem' }} />
                <Typography variant="body2">{healthStats.healthy} Healthy</Typography>
              </Stack>
              <Stack direction="row" spacing={0.5} alignItems="center">
                <WarningIcon sx={{ color: '#ffb74d', fontSize: '1.2rem' }} />
                <Typography variant="body2">{healthStats.warning} Warning</Typography>
              </Stack>
              <Stack direction="row" spacing={0.5} alignItems="center">
                <ErrorIcon sx={{ color: '#ff5252', fontSize: '1.2rem' }} />
                <Typography variant="body2">{healthStats.critical} Critical</Typography>
              </Stack>
            </Stack>
          </Stack>
          {canWrite && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={openCreateDialog}
            >
              New Team
            </Button>
          )}
        </Stack>

        {/* Error alert */}
        {error && (
          <Alert severity="error" onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        {/* Loading */}
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {/* Teams table */}
        {!loading && teams.length > 0 && (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                  <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Department</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Location</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Members</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Health</TableCell>
                  <TableCell sx={{ fontWeight: 600, textAlign: 'right' }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {teams.map(team => {
                  const health = team.health || {}
                  const understaffed =
                    health.member_count !== undefined && health.member_count < 5
                  return (
                    <TableRow key={team.id}>
                      <TableCell>{team.name}</TableCell>
                      <TableCell>{team.department}</TableCell>
                      <TableCell>{team.location}</TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <PeopleIcon sx={{ fontSize: '1.2rem' }} />
                          <span>{health.member_count || 0}</span>
                          {understaffed && (
                            <Chip
                              size="small"
                              label="Understaffed"
                              color="warning"
                              variant="outlined"
                            />
                          )}
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <HealthBadge team={team} />
                        <HealthIssuesPanel team={team} />
                      </TableCell>
                      <TableCell sx={{ textAlign: 'right' }}>
                        <Stack direction="row" justifyContent="flex-end" spacing={1}>
                          {canWrite && (
                            <Button
                              size="small"
                              startIcon={<EditIcon />}
                              onClick={() => openEditDialog(team)}
                            >
                              Edit
                            </Button>
                          )}
                          {canDelete && (
                            <Button
                              size="small"
                              color="error"
                              startIcon={<DeleteIcon />}
                              onClick={() => {
                                setSelectedTeam(team)
                                setOpenDeleteConfirm(true)
                              }}
                            >
                              Delete
                            </Button>
                          )}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {!loading && teams.length === 0 && (
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 4 }}>
              <Typography color="textSecondary">No teams found</Typography>
            </CardContent>
          </Card>
        )}
      </Stack>

      {/* Create/Edit Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {selectedTeam ? 'Edit Team' : 'Create New Team'}
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2}>
            <TextField
              label="Team Name *"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              fullWidth
              error={!!formErrors.name}
              helperText={formErrors.name}
            />
            <TextField
              label="Department *"
              value={formData.department}
              onChange={e =>
                setFormData({ ...formData, department: e.target.value })
              }
              fullWidth
              error={!!formErrors.department}
              helperText={formErrors.department}
            />
            <TextField
              label="Location *"
              value={formData.location}
              onChange={e => setFormData({ ...formData, location: e.target.value })}
              fullWidth
              error={!!formErrors.location}
              helperText={formErrors.location}
            />
            <TextField
              label="Team Leader *"
              value={formData.team_leader}
              onChange={e =>
                setFormData({ ...formData, team_leader: e.target.value })
              }
              fullWidth
              error={!!formErrors.team_leader}
              helperText={formErrors.team_leader || 'Every team must have a designated leader'}
            />
            <TextField
              label="Leader Location"
              value={formData.leader_location}
              onChange={e =>
                setFormData({ ...formData, leader_location: e.target.value })
              }
              fullWidth
            />
            <TextField
              label="Org Leader"
              value={formData.org_leader}
              onChange={e => setFormData({ ...formData, org_leader: e.target.value })}
              fullWidth
            />
            <TextField
              label="Description"
              value={formData.description}
              onChange={e =>
                setFormData({ ...formData, description: e.target.value })
              }
              fullWidth
              multiline
              rows={3}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSave} variant="contained">
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={openDeleteConfirm} onClose={() => setOpenDeleteConfirm(false)}>
        <DialogTitle>Delete Team</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete "{selectedTeam?.name}"?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDeleteConfirm(false)}>Cancel</Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  )
}
