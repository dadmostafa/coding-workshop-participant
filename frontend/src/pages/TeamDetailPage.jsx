import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Box, Typography, Button, Grid, Card, CardContent,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Chip, CircularProgress, Alert, AlertTitle, Divider, IconButton, Tooltip, Avatar, Stack,
} from '@mui/material'
import { ArrowBack, Delete, Add, EmojiEvents, Person, CheckCircle as CheckCircleIcon, Warning as WarningIcon, Error as ErrorIcon } from '@mui/icons-material'
import { getTeam, getMembers, getAchievements, deleteMember, deleteAchievement } from '../services/api'
import { useAuth } from '../context/AuthContext'
import ConfirmDialog from '../components/ConfirmDialog'
import TeamNotes from '../components/TeamNotes'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const AVATAR_COLORS = ['#FF6B6B','#FFD166','#6BCB77','#4ECDC4','#A29BFE','#74B9FF','#FF9F43','#FD79A8']
const getColor = name => AVATAR_COLORS[(name?.charCodeAt(0) || 0) % AVATAR_COLORS.length]

function InfoCard({ label, value, color = '#8b8fa8' }) {
  if (!value) return null
  return (
    <Card sx={{ bgcolor: '#16171f', border: '1px solid #2a2d3e' }}>
      <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Typography variant="caption" sx={{ color: '#8b8fa8', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>{label}</Typography>
        <Typography variant="body2" fontWeight={600} sx={{ color, mt: 0.3 }}>{value}</Typography>
      </CardContent>
    </Card>
  )
}

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
      const [t, m, a] = await Promise.all([getTeam(id), getMembers({ team_id: id }), getAchievements({ team_id: id })])
      setTeam(t); setMembers(m); setAchievs(a)
    } catch { setError('Failed to load team') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [id])

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress sx={{ color: '#6BCB77' }} /></Box>
  if (error)   return <Alert severity="error">{error}</Alert>
  if (!team)   return <Alert severity="warning">Team not found</Alert>

  const nonDirectCount = members.filter(m => m.employment_type === 'non-direct').length
  const nonDirectPct   = members.length ? Math.round((nonDirectCount / members.length) * 100) : 0

  return (
    <Box>
      <Button startIcon={<ArrowBack />} onClick={() => navigate('/teams')} sx={{ color: '#8b8fa8', mb: 2, '&:hover': { color: 'text.primary' } }}>
        Back to Teams
      </Button>

      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Avatar sx={{ width: 48, height: 48, bgcolor: `${getColor(team.name)}20`, color: getColor(team.name), fontSize: 20, fontWeight: 700, border: `2px solid ${getColor(team.name)}40` }}>
          {team.name[0].toUpperCase()}
        </Avatar>
        <Box>
          <Typography variant="h5" fontWeight={700}>{team.name}</Typography>
          {team.description && <Typography variant="body2" color="text.secondary">{team.description}</Typography>}
        </Box>
      </Box>

      {/* Info grid */}
      <Grid container spacing={1.5} mb={4}>
        <Grid item xs={6} sm={4} md={2}><InfoCard label="Department" value={team.department} color="text.primary" /></Grid>
        <Grid item xs={6} sm={4} md={2}><InfoCard label="Location" value={team.location} color="#4ECDC4" /></Grid>
        <Grid item xs={6} sm={4} md={2}><InfoCard label="Team Leader" value={team.team_leader} color="#FFD166" /></Grid>
        <Grid item xs={6} sm={4} md={2}><InfoCard label="Leader Location" value={team.leader_location} color={team.leader_location && team.location && team.leader_location !== team.location ? '#FF9F43' : 'text.primary'} /></Grid>
        <Grid item xs={6} sm={4} md={2}><InfoCard label="Org Leader" value={team.org_leader} color="#A29BFE" /></Grid>
        <Grid item xs={6} sm={4} md={2}>
          <Card sx={{ bgcolor: '#16171f', border: `1px solid ${nonDirectPct > 20 ? 'rgba(255,107,107,0.3)' : '#2a2d3e'}` }}>
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Typography variant="caption" sx={{ color: '#8b8fa8', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Non-direct %</Typography>
              <Typography variant="body2" fontWeight={700} sx={{ color: nonDirectPct > 20 ? '#FF6B6B' : '#6BCB77', mt: 0.3 }}>{nonDirectPct}%</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Health Status Panel */}
      {team.health && (team.health.errors?.length > 0 || team.health.warnings?.length > 0) && (
        <Box sx={{ mb: 3, p: 2, bgcolor: 'rgba(255, 0, 0, 0.05)', borderRadius: 1, border: '1px solid rgba(255, 0, 0, 0.1)' }}>
          <Stack spacing={1.5}>
            {team.health.errors && team.health.errors.length > 0 && (
              <Stack spacing={1}>
                {team.health.errors.map((err, i) => (
                  <Alert severity="error" key={i} icon={<ErrorIcon />}>
                    <AlertTitle>{err.code}</AlertTitle>
                    {err.message}
                  </Alert>
                ))}
              </Stack>
            )}
            {team.health.warnings && team.health.warnings.length > 0 && (
              <Stack spacing={1}>
                {team.health.warnings.map((warn, i) => (
                  <Alert severity="warning" key={i} icon={<WarningIcon />}>
                    <AlertTitle>{warn.code}</AlertTitle>
                    {warn.message}
                  </Alert>
                ))}
              </Stack>
            )}
          </Stack>
        </Box>
      )}

      <Divider sx={{ borderColor: '#2a2d3e', mb: 3 }} />

      {/* Members */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Person sx={{ color: '#4ECDC4', fontSize: 20 }} />
          <Typography variant="h6" fontWeight={600}>Members</Typography>
          <Chip label={members.length} size="small" sx={{ bgcolor: 'rgba(78,205,196,0.15)', color: '#4ECDC4', border: '1px solid rgba(78,205,196,0.3)', fontWeight: 700 }} />
        </Box>
        <Button size="small" startIcon={<Add />} onClick={() => navigate(`/members?team_id=${id}`)}
          sx={{ color: '#4ECDC4', borderColor: 'rgba(78,205,196,0.3)', border: '1px solid', '&:hover': { bgcolor: 'rgba(78,205,196,0.1)' } }}>
          Add
        </Button>
      </Box>

      <TableContainer component={Paper} sx={{ bgcolor: '#1e2029', border: '1px solid #2a2d3e', mb: 4 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell><TableCell>Role</TableCell><TableCell>Location</TableCell><TableCell>Type</TableCell>{canDelete && <TableCell />}
            </TableRow>
          </TableHead>
          <TableBody>
            {members.length === 0 ? (
              <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4, color: '#8b8fa8' }}>No members yet</TableCell></TableRow>
            ) : members.map(m => (
              <TableRow key={m.id}>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Avatar sx={{ width: 26, height: 26, bgcolor: `${getColor(m.name)}20`, color: getColor(m.name), fontSize: 11, fontWeight: 700 }}>{m.name[0].toUpperCase()}</Avatar>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Typography variant="body2" fontWeight={m.is_team_leader ? 700 : 400}>{m.name}</Typography>
                      {m.is_team_leader && <Chip label="Leader" size="small" sx={{ bgcolor: 'rgba(107,203,119,0.15)', color: '#6BCB77', border: '1px solid rgba(107,203,119,0.3)', fontSize: '0.6rem', height: 16 }} />}
                    </Box>
                  </Box>
                </TableCell>
                <TableCell><Typography variant="body2" color="text.secondary">{m.role || '—'}</Typography></TableCell>
                <TableCell><Typography variant="body2" color="text.secondary">{m.location || '—'}</Typography></TableCell>
                <TableCell><Chip label={m.employment_type || 'direct'} size="small" sx={m.employment_type === 'non-direct' ? { bgcolor: 'rgba(255,159,67,0.15)', color: '#FF9F43', border: '1px solid rgba(255,159,67,0.3)', fontSize: '0.65rem' } : { bgcolor: 'rgba(107,203,119,0.15)', color: '#6BCB77', border: '1px solid rgba(107,203,119,0.3)', fontSize: '0.65rem' }} /></TableCell>
                {canDelete && <TableCell align="right"><Tooltip title="Remove"><IconButton size="small" onClick={() => setDelMember(m)} sx={{ color: '#8b8fa8', '&:hover': { color: '#FF6B6B' } }}><Delete sx={{ fontSize: 14 }} /></IconButton></Tooltip></TableCell>}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Achievements */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <EmojiEvents sx={{ color: '#FFD166', fontSize: 20 }} />
          <Typography variant="h6" fontWeight={600}>Achievements</Typography>
          <Chip label={achievs.length} size="small" sx={{ bgcolor: 'rgba(255,209,102,0.15)', color: '#FFD166', border: '1px solid rgba(255,209,102,0.3)', fontWeight: 700 }} />
        </Box>
        <Button size="small" startIcon={<Add />} onClick={() => navigate(`/achievements?team_id=${id}`)}
          sx={{ color: '#FFD166', border: '1px solid rgba(255,209,102,0.3)', '&:hover': { bgcolor: 'rgba(255,209,102,0.1)' } }}>
          Add
        </Button>
      </Box>

      <TableContainer component={Paper} sx={{ bgcolor: '#1e2029', border: '1px solid #2a2d3e' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Title</TableCell><TableCell>Period</TableCell><TableCell>Impact</TableCell>{canDelete && <TableCell />}
            </TableRow>
          </TableHead>
          <TableBody>
            {achievs.length === 0 ? (
              <TableRow><TableCell colSpan={4} align="center" sx={{ py: 4, color: '#8b8fa8' }}>No achievements yet</TableCell></TableRow>
            ) : achievs.map(a => (
              <TableRow key={a.id}>
                <TableCell>
                  <Typography variant="body2" fontWeight={600}>{a.title}</Typography>
                  {a.description && <Typography variant="caption" color="text.secondary">{a.description}</Typography>}
                </TableCell>
                <TableCell><Chip label={`${MONTHS[(a.month||1)-1]} ${a.year}`} size="small" sx={{ bgcolor: 'rgba(255,209,102,0.12)', color: '#FFD166', border: '1px solid rgba(255,209,102,0.25)', fontSize: '0.65rem' }} /></TableCell>
                <TableCell><Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 200 }}>{a.impact || '—'}</Typography></TableCell>
                {canDelete && <TableCell align="right"><Tooltip title="Delete"><IconButton size="small" onClick={() => setDelAch(a)} sx={{ color: '#8b8fa8', '&:hover': { color: '#FF6B6B' } }}><Delete sx={{ fontSize: 14 }} /></IconButton></Tooltip></TableCell>}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <ConfirmDialog open={!!delMember} title="Remove Member" message={`Remove "${delMember?.name}"?`} onConfirm={async () => { await deleteMember(delMember.id); setDelMember(null); load() }} onCancel={() => setDelMember(null)} />
      <ConfirmDialog open={!!delAch} title="Delete Achievement" message={`Delete "${delAch?.title}"?`} onConfirm={async () => { await deleteAchievement(delAch.id); setDelAch(null); load() }} onCancel={() => setDelAch(null)} />

      <Divider sx={{ borderColor: '#2a2d3e', my: 3 }} />
      <TeamNotes teamId={id} />
    </Box>
  )
}
