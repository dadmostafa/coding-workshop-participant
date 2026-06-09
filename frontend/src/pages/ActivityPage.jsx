import { useState, useEffect, useCallback } from 'react'
import {
  Box, Typography, Card, CardContent, CircularProgress,
  Alert, Chip, Avatar, TextField, MenuItem, Divider,
  IconButton, Tooltip,
} from '@mui/material'
import { Refresh } from '@mui/icons-material'
import axios from 'axios'

const BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3001') + '/api/team-service'
const token = () => localStorage.getItem('acme_token')

const ACTION_STYLES = {
  CREATE: { color: '#6BCB77', bg: 'rgba(107,203,119,0.12)', label: 'Created'  },
  UPDATE: { color: '#FFD166', bg: 'rgba(255,209,102,0.12)', label: 'Updated'  },
  DELETE: { color: '#FF6B6B', bg: 'rgba(255,107,107,0.12)', label: 'Deleted'  },
  LOGIN:  { color: '#4ECDC4', bg: 'rgba(78,205,196,0.12)',  label: 'Login'    },
  LOGOUT: { color: '#8b8fa8', bg: 'rgba(139,143,168,0.12)', label: 'Logout'   },
  LOGIN_FAILED: { color: '#FF9F43', bg: 'rgba(255,159,67,0.12)', label: 'Failed'  },
  EXPORT: { color: '#A29BFE', bg: 'rgba(162,155,254,0.12)', label: 'Export'   },
}

const RESOURCE_ICONS = {
  teams:        '👥',
  members:      '👤',
  achievements: '🏆',
  metadata:     '🏷️',
  users:        '⚙️',
  auth:         '🔐',
}

function timeAgo(isoString) {
  if (!isoString) return ''
  const diff = Math.floor((Date.now() - new Date(isoString)) / 1000)
  if (diff < 60)   return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400)return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export default function ActivityPage() {
  const [feed,     setFeed]     = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')
  const [filter,   setFilter]   = useState('')
  const [resource, setResource] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (filter)   params.append('action',   filter)
      if (resource) params.append('resource', resource)
      const r = await axios.get(
        `${BASE}/activity${params.toString() ? '?' + params : ''}`,
        { headers: { Authorization: `Bearer ${token()}` } }
      )
      setFeed(r.data)
    } catch {
      setError('Failed to load activity feed')
    } finally {
      setLoading(false)
    }
  }, [filter, resource])

  useEffect(() => { load() }, [load])

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [load])

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Activity Feed</Typography>
          <Typography variant="body2" color="text.secondary">
            Real-time log of all actions — refreshes every 30 seconds
          </Typography>
        </Box>
        <Tooltip title="Refresh now">
          <IconButton onClick={load} sx={{ color: '#6BCB77' }}>
            <Refresh />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Filters */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <TextField
          select label="Action" size="small" sx={{ minWidth: 140 }}
          value={filter} onChange={e => setFilter(e.target.value)}
        >
          <MenuItem value="">All actions</MenuItem>
          {Object.entries(ACTION_STYLES).map(([k, v]) => (
            <MenuItem key={k} value={k}>{v.label}</MenuItem>
          ))}
        </TextField>
        <TextField
          select label="Resource" size="small" sx={{ minWidth: 160 }}
          value={resource} onChange={e => setResource(e.target.value)}
        >
          <MenuItem value="">All resources</MenuItem>
          {Object.keys(RESOURCE_ICONS).map(r => (
            <MenuItem key={r} value={r}>{RESOURCE_ICONS[r]} {r}</MenuItem>
          ))}
        </TextField>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
          <CircularProgress sx={{ color: '#6BCB77' }} />
        </Box>
      ) : feed.length === 0 ? (
        <Card sx={{ bgcolor: '#1e2029', border: '1px solid #2a2d3e' }}>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <Typography color="text.secondary">No activity yet</Typography>
          </CardContent>
        </Card>
      ) : (
        <Card sx={{ bgcolor: '#1e2029', border: '1px solid #2a2d3e' }}>
          {feed.map((item, idx) => {
            const style = ACTION_STYLES[item.action] || ACTION_STYLES.UPDATE
            const icon  = RESOURCE_ICONS[item.resource] || '📋'
            return (
              <Box key={item.id}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, px: 3, py: 2 }}>
                  {/* Avatar */}
                  <Avatar sx={{
                    width: 36, height: 36, flexShrink: 0,
                    bgcolor: `${style.color}20`,
                    color: style.color,
                    fontSize: 13, fontWeight: 700,
                    border: `1px solid ${style.color}40`,
                    mt: 0.3,
                  }}>
                    {(item.username || 'S')[0].toUpperCase()}
                  </Avatar>

                  {/* Content */}
                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <Typography variant="body2" fontWeight={600}>
                        {item.sentence}
                      </Typography>
                      <Chip
                        label={style.label}
                        size="small"
                        sx={{
                          bgcolor: style.bg, color: style.color,
                          border: `1px solid ${style.color}30`,
                          fontSize: '0.65rem', height: 18, fontWeight: 600,
                        }}
                      />
                      <Chip
                        label={`${icon} ${item.resource}`}
                        size="small"
                        sx={{
                          bgcolor: 'rgba(139,143,168,0.1)', color: '#8b8fa8',
                          border: '1px solid rgba(139,143,168,0.2)',
                          fontSize: '0.65rem', height: 18,
                        }}
                      />
                    </Box>

                    {/* Changes detail */}
                    {item.changes && Object.keys(item.changes).length > 0 && (
                      <Box sx={{ mt: 0.5 }}>
                        {Object.entries(item.changes).map(([key, val]) => (
                          <Typography key={key} variant="caption" color="text.secondary" sx={{ mr: 1 }}>
                            {key}: <span style={{ color: '#FFD166' }}>{String(val)}</span>
                          </Typography>
                        ))}
                      </Box>
                    )}

                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.3, display: 'block' }}>
                      {timeAgo(item.timestamp)} · {item.role}
                    </Typography>
                  </Box>

                  {/* Time */}
                  <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                    {item.timestamp ? new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </Typography>
                </Box>
                {idx < feed.length - 1 && <Divider sx={{ borderColor: '#2a2d3e' }} />}
              </Box>
            )
          })}
        </Card>
      )}
    </Box>
  )
}
