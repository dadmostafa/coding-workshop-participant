import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Card, CardContent, TextField, Button, Typography,
  Alert, CircularProgress, InputAdornment, IconButton,
} from '@mui/material'
import { Visibility, VisibilityOff, Groups } from '@mui/icons-material'
import { useAuth } from '../context/AuthContext'

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
    setErrors({})
    setApiErr('')
    setLoading(true)
    try {
      await signIn(form.username.trim(), form.password)
      navigate('/', { replace: true })
    } catch (err) {
      setApiErr(err.response?.data?.error || 'Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleKey = e => { if (e.key === 'Enter') handleSubmit() }

  return (
    <Box sx={{
      minHeight: '100vh',
      bgcolor: 'primary.main',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      p: 2,
    }}>
      <Card sx={{ width: '100%', maxWidth: 400 }} elevation={8}>
        <CardContent sx={{ p: 4 }}>
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Groups sx={{ fontSize: 48, color: 'primary.main' }} />
            <Typography variant="h5" fontWeight={700} mt={1}>ACME Team Management</Typography>
            <Typography variant="body2" color="text.secondary">Sign in to your account</Typography>
          </Box>

          {apiErr && <Alert severity="error" sx={{ mb: 2 }}>{apiErr}</Alert>}

          <TextField
            label="Username"
            fullWidth
            margin="normal"
            value={form.username}
            onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
            error={!!errors.username}
            helperText={errors.username}
            onKeyDown={handleKey}
            disabled={loading}
            autoFocus
          />

          <TextField
            label="Password"
            type={showPw ? 'text' : 'password'}
            fullWidth
            margin="normal"
            value={form.password}
            onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            error={!!errors.password}
            helperText={errors.password}
            onKeyDown={handleKey}
            disabled={loading}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowPw(v => !v)} edge="end">
                    {showPw ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              )
            }}
          />

          <Button
            fullWidth
            variant="contained"
            size="large"
            sx={{ mt: 3 }}
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} color="inherit" /> : 'Sign In'}
          </Button>

          <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
            <Typography variant="caption" color="text.secondary" display="block" fontWeight={600} mb={0.5}>
              Demo credentials
            </Typography>
            {[
              ['admin',    'admin123',   'Admin'],
              ['manager1', 'manager123', 'Manager'],
              ['contrib1', 'contrib123', 'Contributor'],
              ['viewer1',  'viewer123',  'Viewer'],
            ].map(([u, p, role]) => (
              <Typography
                key={u}
                variant="caption"
                display="block"
                sx={{ cursor: 'pointer', color: 'primary.main', '&:hover': { textDecoration: 'underline' } }}
                onClick={() => setForm({ username: u, password: p })}
              >
                {role}: {u} / {p}
              </Typography>
            ))}
          </Box>
        </CardContent>
      </Card>
    </Box>
  )
}
