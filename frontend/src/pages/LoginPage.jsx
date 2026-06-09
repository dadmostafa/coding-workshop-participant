import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Card, CardContent, TextField, Button, Typography,
  Alert, CircularProgress, InputAdornment, IconButton, Chip,
} from '@mui/material'
import { Visibility, VisibilityOff, Groups } from '@mui/icons-material'
import { useAuth } from '../context/AuthContext'

const DEMO_USERS = [
  { username: 'admin',    password: 'admin123',   role: 'Admin',       color: '#FF6B6B' },
  { username: 'manager1', password: 'manager123', role: 'Manager',     color: '#FFD166' },
  { username: 'contrib1', password: 'contrib123', role: 'Contributor', color: '#6BCB77' },
  { username: 'viewer1',  password: 'viewer123',  role: 'Viewer',      color: '#4ECDC4' },
]

export default function LoginPage() {
  const { signIn } = useAuth()
  const navigate   = useNavigate()
  const [form,    setForm]    = useState({ username: '', password: '' })
  const [errors,  setErrors]  = useState({})
  const [apiErr,  setApiErr]  = useState('')
  const [loading, setLoading] = useState(false)
  const [showPw,  setShowPw]  = useState(false)

  const validate = () => {
    const e = {}
    if (!form.username.trim()) e.username = 'Username is required'
    if (!form.password)        e.password = 'Password is required'
    return e
  }

  const handleSubmit = async () => {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    setErrors({}); setApiErr(''); setLoading(true)
    try {
      await signIn(form.username.trim(), form.password)
      navigate('/', { replace: true })
    } catch (err) {
      setApiErr(err.response?.data?.error || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box sx={{
      minHeight: '100vh', bgcolor: '#13141a',
      display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2,
      backgroundImage: 'radial-gradient(ellipse at 20% 50%, rgba(107,203,119,0.05) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(255,209,102,0.05) 0%, transparent 60%)',
    }}>
      <Box sx={{ width: '100%', maxWidth: 420 }}>
        {/* Header */}
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Box sx={{
            width: 56, height: 56, borderRadius: 3, bgcolor: '#6BCB77',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            mx: 'auto', mb: 2,
          }}>
            <Groups sx={{ fontSize: 30, color: '#13141a' }} />
          </Box>
          <Typography variant="h5" fontWeight={700} color="text.primary">
            ACME Team Management
          </Typography>
          <Typography variant="body2" color="text.secondary" mt={0.5}>
            Sign in to your workspace
          </Typography>
        </Box>

        <Card sx={{ bgcolor: '#1e2029', border: '1px solid #2a2d3e' }}>
          <CardContent sx={{ p: 3 }}>
            {apiErr && <Alert severity="error" sx={{ mb: 2, bgcolor: 'rgba(255,107,107,0.1)', color: '#FF6B6B', border: '1px solid rgba(255,107,107,0.2)' }}>{apiErr}</Alert>}

            <TextField
              label="Username" fullWidth margin="normal"
              value={form.username}
              onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
              error={!!errors.username} helperText={errors.username}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              disabled={loading} autoFocus
              sx={{ '& label': { color: '#8b8fa8' } }}
            />
            <TextField
              label="Password" type={showPw ? 'text' : 'password'}
              fullWidth margin="normal"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              error={!!errors.password} helperText={errors.password}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              disabled={loading}
              sx={{ '& label': { color: '#8b8fa8' } }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPw(v => !v)} sx={{ color: '#8b8fa8' }}>
                      {showPw ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />

            <Button
              fullWidth variant="contained" size="large"
              sx={{ mt: 2.5, py: 1.4, bgcolor: '#6BCB77', color: '#13141a', fontWeight: 700,
                '&:hover': { bgcolor: '#5ab868' } }}
              onClick={handleSubmit} disabled={loading}
            >
              {loading ? <CircularProgress size={22} sx={{ color: '#13141a' }} /> : 'Sign In'}
            </Button>
          </CardContent>
        </Card>

        {/* Demo credentials */}
        <Box sx={{ mt: 3, p: 2.5, bgcolor: '#1e2029', borderRadius: 2, border: '1px solid #2a2d3e' }}>
          <Typography variant="caption" color="text.secondary" display="block" mb={1.5} fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Demo accounts
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {DEMO_USERS.map(u => (
              <Chip
                key={u.username}
                label={u.role}
                size="small"
                onClick={() => setForm({ username: u.username, password: u.password })}
                sx={{
                  bgcolor: `${u.color}18`, color: u.color,
                  border: `1px solid ${u.color}40`, cursor: 'pointer',
                  fontWeight: 600, fontSize: '0.75rem',
                  '&:hover': { bgcolor: `${u.color}30` },
                }}
              />
            ))}
          </Box>
          <Typography variant="caption" color="text.secondary" display="block" mt={1}>
            Click a role to fill credentials
          </Typography>
        </Box>
      </Box>
    </Box>
  )
}
