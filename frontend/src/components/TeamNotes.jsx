import { useState, useEffect } from 'react'
import {
  Box, Typography, TextField, Button, Avatar,
  Divider, IconButton, Tooltip, CircularProgress,
  Chip,
} from '@mui/material'
import { Send, Delete } from '@mui/icons-material'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'

const BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3001') + '/api/team-service'
const token = () => localStorage.getItem('acme_token')
const hdrs  = () => ({ Authorization: `Bearer ${token()}` })

function timeAgo(isoString) {
  if (!isoString) return ''
  const ts   = isoString.endsWith('Z') ? isoString : isoString + 'Z'
  const diff = Math.floor((Date.now() - new Date(ts)) / 1000)
  if (diff < 0)     return 'just now'
  if (diff < 60)    return `${diff}s ago`
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return new Date(ts).toLocaleDateString()
}

const AUTHOR_COLORS = ['#FF6B6B','#FFD166','#6BCB77','#4ECDC4','#A29BFE','#74B9FF']
const getColor = name => AUTHOR_COLORS[(name?.charCodeAt(0) || 0) % AUTHOR_COLORS.length]

export default function TeamNotes({ teamId }) {
  const { user, canDelete } = useAuth()
  const [notes,   setNotes]   = useState([])
  const [loading, setLoading] = useState(true)
  const [content, setContent] = useState('')
  const [saving,  setSaving]  = useState(false)

  const load = async () => {
    try {
      const r = await axios.get(`${BASE}/teams/${teamId}/notes`, { headers: hdrs() })
      setNotes(r.data)
    } catch { }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [teamId])

  const handleAdd = async () => {
    if (!content.trim()) return
    setSaving(true)
    try {
      await axios.post(`${BASE}/teams/${teamId}/notes`, { content }, { headers: hdrs() })
      setContent('')
      load()
    } catch { }
    finally { setSaving(false) }
  }

  const handleDelete = async (noteId) => {
    try {
      await axios.delete(`${BASE}/teams/${teamId}/notes/${noteId}`, { headers: hdrs() })
      load()
    } catch { }
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Typography variant="h6" fontWeight={600}>Notes</Typography>
        <Chip label={notes.length} size="small"
          sx={{ bgcolor: 'rgba(162,155,254,0.15)', color: '#A29BFE', border: '1px solid rgba(162,155,254,0.3)', fontWeight: 700 }} />
      </Box>

      {/* Add note */}
      <Box sx={{ display: 'flex', gap: 1.5, mb: 3, alignItems: 'flex-end' }}>
        <TextField
          placeholder="Add a note…"
          multiline maxRows={4} fullWidth
          value={content}
          onChange={e => setContent(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && e.metaKey) handleAdd()
          }}
          size="small"
          helperText={`${content.length}/2000 · Cmd+Enter to submit`}
        />
        <Button
          variant="contained"
          onClick={handleAdd}
          disabled={saving || !content.trim()}
          sx={{
            minWidth: 44, width: 44, height: 40, p: 0,
            bgcolor: '#A29BFE', color: '#13141a',
            '&:hover': { bgcolor: '#9188f0' },
            flexShrink: 0, mb: 2.5,
          }}
        >
          {saving ? <CircularProgress size={16} sx={{ color: '#13141a' }} /> : <Send sx={{ fontSize: 18 }} />}
        </Button>
      </Box>

      {/* Notes list */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
          <CircularProgress size={24} sx={{ color: '#A29BFE' }} />
        </Box>
      ) : notes.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 4, color: '#8b8fa8' }}>
          <Typography variant="body2">No notes yet — add the first one</Typography>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {notes.map((note) => {
            const color = getColor(note.author)
            const isOwn = note.author === user?.username
            return (
              <Box key={note.id} sx={{
                p: 2, borderRadius: 3,
                bgcolor: '#16171f',
                border: '1px solid #2a2d3e',
                transition: 'all 0.2s ease',
                '&:hover': { borderColor: `${color}40`, '& .note-actions': { opacity: 1 } },
              }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Avatar sx={{ width: 24, height: 24, bgcolor: `${color}20`, color, fontSize: 11, fontWeight: 700 }}>
                      {note.author[0].toUpperCase()}
                    </Avatar>
                    <Typography variant="caption" fontWeight={700} sx={{ color }}>
                      {note.author}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {timeAgo(note.created_at)}
                    </Typography>
                  </Box>
                  {(isOwn || canDelete) && (
                    <Box className="note-actions" sx={{ opacity: 0, transition: 'opacity 0.2s' }}>
                      <Tooltip title="Delete note">
                        <IconButton size="small" onClick={() => handleDelete(note.id)}
                          sx={{ color: '#8b8fa8', '&:hover': { color: '#FF6B6B' } }}>
                          <Delete sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  )}
                </Box>
                <Typography variant="body2" sx={{
                  color: 'text.primary', lineHeight: 1.6,
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                }}>
                  {note.content}
                </Typography>
              </Box>
            )
          })}
        </Box>
      )}
    </Box>
  )
}
