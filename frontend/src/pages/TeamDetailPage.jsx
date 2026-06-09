import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Box, Typography, Button, Grid, Card, CardContent,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Chip, CircularProgress, Alert, Divider, IconButton, Tooltip,
} from '@mui/material'
import { ArrowBack, Edit, Delete, Add } from '@mui/icons-material'
import { getTeam, getMembers, getAchievements, deleteMember, deleteAchievement } from '../services/api'
import { useAuth } from '../context/AuthContext'
import ConfirmDialog from '../components/ConfirmDialog'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export default function TeamDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { canDelete } = useAuth()

  const [team,     setTeam]     = useState(null)
  const [members,  setMembers]  = useState([])
  const [achievs,  setAchievs]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')
  const [delMember, setDelMember] = useState(null)
  const [delAch,    setDelAch]    = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const [t, m, a] = await Promise.all([
        getTeam(id),
        getMembers({ team_id: id }),
        getAchievements({ team_id: id }),
      ])
      setTeam(t)
      setMembers(m)
      setAchievs(a)
    } catch {
      setError('Failed to load team details')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>
  if (error)   return <Alert severity="error">{error}</Alert>
  if (!team)   return <Alert severity="warning">Team not found</Alert>

  const nonDirectCount = members.filter(m => m.employment_type === 'non-direct').length
  const nonDirectPct   = members.length ? Math.round((nonDirectCount / members.length) * 100) : 0

  return (
    <Box>
      <Button startIcon={<ArrowBack />} onClick={() => navigate('/teams')} sx={{ mb: 2 }}>
        Back to Teams
      </Button>

      <Typography variant="h5" fontWeight={700} mb={1}>{team.name}</Typography>
      {team.description && (
        <Typography color="text.secondary" mb={2}>{team.description}</Typography>
      )}

      {/* Info cards */}
      <Grid container spacing={2} mb={3}>
        {[
          ['Department', team.department],
          ['Team Location', team.location],
          ['Team Leader', team.team_leader],
          ['Leader Location', team.leader_location],
          ['Org Leader', team.org_leader],
        ].map(([label, val]) => val ? (
          <Grid item xs={6} sm={4} md={2} key={label}>
            <Card variant="outlined">
              <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Typography variant="caption" color="text.secondary">{label}</Typography>
                <Typography fontWeight={600} noWrap>{val}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ) : null)}
        <Grid item xs={6} sm={4} md={2}>
          <Card variant="outlined" sx={{ bgcolor: nonDirectPct > 20 ? 'error.50' : undefined }}>
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Typography variant="caption" color="text.secondary">Non-direct %</Typography>
              <Typography fontWeight={600} color={nonDirectPct > 20 ? 'error.main' : undefined}>
                {nonDirectPct}%
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Divider sx={{ mb: 3 }} />

      {/* Members */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="h6" fontWeight={600}>
          Members ({members.length})
        </Typography>
        <Button size="small" startIcon={<Add />} onClick={() => navigate(`/members?team_id=${id}`)}>
          Add Member
        </Button>
      </Box>

      <TableContainer component={Paper} elevation={1} sx={{ mb: 4 }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: 'grey.50' }}>
              <TableCell>Name</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Location</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Leader</TableCell>
              {canDelete && <TableCell />}
            </TableRow>
          </TableHead>
          <TableBody>
            {members.length === 0 ? (
              <TableRow><TableCell colSpan={6} align="center" sx={{ color: 'text.secondary', py: 3 }}>
                No members yet
              </TableCell></TableRow>
            ) : members.map(m => (
              <TableRow key={m.id} hover>
                <TableCell>
                  <Typography variant="body2" fontWeight={m.is_team_leader ? 700 : 400}>
                    {m.name}
                  </Typography>
                  {m.email && <Typography variant="caption" color="text.secondary">{m.email}</Typography>}
                </TableCell>
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
                <TableCell>{m.is_team_leader && <Chip size="small" label="Leader" color="primary" />}</TableCell>
                {canDelete && (
                  <TableCell>
                    <Tooltip title="Remove">
                      <IconButton size="small" color="error" onClick={() => setDelMember(m)}>
                        <Delete fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Achievements */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="h6" fontWeight={600}>
          Achievements ({achievs.length})
        </Typography>
        <Button size="small" startIcon={<Add />} onClick={() => navigate(`/achievements?team_id=${id}`)}>
          Add Achievement
        </Button>
      </Box>

      <TableContainer component={Paper} elevation={1}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: 'grey.50' }}>
              <TableCell>Title</TableCell>
              <TableCell>Period</TableCell>
              <TableCell>Impact</TableCell>
              {canDelete && <TableCell />}
            </TableRow>
          </TableHead>
          <TableBody>
            {achievs.length === 0 ? (
              <TableRow><TableCell colSpan={4} align="center" sx={{ color: 'text.secondary', py: 3 }}>
                No achievements recorded
              </TableCell></TableRow>
            ) : achievs.map(a => (
              <TableRow key={a.id} hover>
                <TableCell>
                  <Typography variant="body2" fontWeight={600}>{a.title}</Typography>
                  {a.description && <Typography variant="caption" color="text.secondary">{a.description}</Typography>}
                </TableCell>
                <TableCell>{MONTHS[(a.month || 1) - 1]} {a.year}</TableCell>
                <TableCell>{a.impact || '—'}</TableCell>
                {canDelete && (
                  <TableCell>
                    <Tooltip title="Delete">
                      <IconButton size="small" color="error" onClick={() => setDelAch(a)}>
                        <Delete fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <ConfirmDialog
        open={!!delMember}
        title="Remove Member"
        message={`Remove "${delMember?.name}" from this team?`}
        onConfirm={async () => { await deleteMember(delMember.id); setDelMember(null); load() }}
        onCancel={() => setDelMember(null)}
      />
      <ConfirmDialog
        open={!!delAch}
        title="Delete Achievement"
        message={`Delete "${delAch?.title}"?`}
        onConfirm={async () => { await deleteAchievement(delAch.id); setDelAch(null); load() }}
        onCancel={() => setDelAch(null)}
      />
    </Box>
  )
}
