import { useState, useEffect, useCallback } from 'react'
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Chip, CircularProgress, Alert,
  TextField, MenuItem,
} from '@mui/material'
import axios from 'axios'
import { formatDateTime } from '../utils/time'

const BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3001') + '/api/team-service'
const token = () => localStorage.getItem('acme_token')

const ACTION_STYLES = {
  CREATE: { color: '#6BCB77', bg: 'rgba(107,203,119,0.12)' },
  UPDATE: { color: '#FFD166', bg: 'rgba(255,209,102,0.12)' },
  DELETE: { color: '#FF6B6B', bg: 'rgba(255,107,107,0.12)' },
  LOGIN:  { color: '#4ECDC4', bg: 'rgba(78,205,196,0.12)'  },
  LOGIN_FAILED: { color: '#FF9F43', bg: 'rgba(255,159,67,0.12)' },
}

export default function AuditPage() {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [action,  setAction]  = useState('')
  const [resource,setResource]= useState('')
  const [username,setUsername]= useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const params = new URLSearchParams()
      if (action)   params.append('action',   action)
      if (resource) params.append('resource', resource)
      if (username) params.append('username', username)
      params.append('limit', '100')
      const r = await axios.get(
        `${BASE}/audit?${params}`,
        { headers: { Authorization: `Bearer ${token()}` } }
      )
      setEntries(r.data)
    } catch { setError('Failed to load audit trail') }
    finally { setLoading(false) }
  }, [action, resource, username])

  useEffect(() => { load() }, [load])

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>Audit Trail</Typography>
        <Typography variant="body2" color="text.secondary">
          Complete record of all system changes — last 100 entries
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <TextField select label="Action" size="small" sx={{ minWidth: 140 }}
          value={action} onChange={e => setAction(e.target.value)}>
          <MenuItem value="">All</MenuItem>
          {['CREATE','UPDATE','DELETE','LOGIN','LOGIN_FAILED'].map(a =>
            <MenuItem key={a} value={a}>{a}</MenuItem>
          )}
        </TextField>
        <TextField select label="Resource" size="small" sx={{ minWidth: 160 }}
          value={resource} onChange={e => setResource(e.target.value)}>
          <MenuItem value="">All</MenuItem>
          {['teams','members','achievements','metadata','users','auth'].map(r =>
            <MenuItem key={r} value={r}>{r}</MenuItem>
          )}
        </TextField>
        <TextField label="Username" size="small" sx={{ minWidth: 160 }}
          value={username} onChange={e => setUsername(e.target.value)}
          placeholder="Filter by user..." />
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TableContainer component={Paper} sx={{ bgcolor: '#1e2029', border: '1px solid #2a2d3e' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Timestamp</TableCell>
              <TableCell>User</TableCell>
              <TableCell>Action</TableCell>
              <TableCell>Resource</TableCell>
              <TableCell>Details</TableCell>
              <TableCell>Role</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                <CircularProgress size={24} sx={{ color: '#6BCB77' }} />
              </TableCell></TableRow>
            ) : entries.length === 0 ? (
              <TableRow><TableCell colSpan={6} align="center" sx={{ py: 6, color: '#8b8fa8' }}>
                No audit entries found
              </TableCell></TableRow>
            ) : entries.map(e => {
              const style = ACTION_STYLES[e.action] || ACTION_STYLES.UPDATE
              return (
                <TableRow key={e.id}>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">
                      {formatDateTime(e.timestamp)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>{e.username}</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label={e.action} size="small" sx={{
                      bgcolor: style.bg, color: style.color,
                      border: `1px solid ${style.color}30`,
                      fontSize: '0.65rem', fontWeight: 600,
                    }} />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">{e.resource}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 250 }}>
                      {e.details || e.resource_id || '—'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">{e.role}</Typography>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  )
}
