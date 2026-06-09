import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Card, CardContent, TextField, Button, Typography,
  Alert, CircularProgress, InputAdornment, IconButton,
  Chip, Tabs, Tab, Divider,
} from '@mui/material'
import {
  Visibility, VisibilityOff, Groups,
  PersonAdd, Login,
} from '@mui/icons-material'
import { useAuth } from '../context/AuthContext'

const DEMO_USERS = [
  { username: 'admin',    password: 'admin123',   role: 'Admin',       color: '#FF6B6B' },
  { username: 'manager1', password: 'manager123', role: 'Manager',     color: '#FFD166' },
  { username: 'contrib1', password: 'contrib123', role: 'Contributor', color: '#6BCB77' },
  { username: 'viewer1',  password: 'viewer123',  role: 'Viewer',      color: '#4ECDC4' },
]

function LoginForm({ onSuccess }) {
  const { signIn } = useAuth()
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
      const user = await signIn(form.username.trim(), form.password)
      onSuccess(user)
    } catch (err) {
      setApiErr(err.response?.data?.error || 'Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box>
      {apiErr && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 3, bgcolor: 'rgba(255,107,107,0.1)', color: '#FF6B6B', border: '1px solid rgba(255,107,107,0.2)' }}>
          {apiErr}
        </Alert>
      )}

      <TextField
        label="Username" fullWidth margin="normal"
        value={form.username}
        onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
        error={!!errors.username} helperText={errors.username}
        onKeyDown={e => e.key === 'Enter' && handleSubmit()}
        disabled={loading} autoFocus
      />
      <TextField
        label="Password" type={showPw ? 'text' : 'password'}
        fullWidth margin="normal"
        value={form.password}
        onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
        error={!!errors.password} helperText={errors.password}
        onKeyDown={e => e.key === 'Enter' && handleSubmit()}
        disabled={loading}
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
        sx={{ mt: 2.5, py: 1.4, bgcolor: '#6BCB77', color: '#13141a', fontWeight: 700, borderRadius: 3,
          '&:hover': { bgcolor: '#5ab868', transform: 'translateY(-2px)', boxShadow: '0 8px 24px rgba(107,203,119,0.3)' } }}
        onClick={handleSubmit} disabled={loading} startIcon={!loading && <Login />}
      >
        {loading ? <CircularProgress size={22} sx={{ color: '#13141a' }} /> : 'Sign In'}
      </Button>

      {/* Demo credentials */}
      <Box sx={{ mt: 3, p: 2, bgcolor: '#16171f', borderRadius: 3, border: '1px solid #2a2d3e' }}>
        <Typography variant="caption" color="text.secondary" display="block" mb={1.5}
          fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Demo accounts — click to fill
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {DEMO_USERS.map(u => (
            <Chip key={u.username} label={u.role} size="small"
              onClick={() => setForm({ username: u.username, password: u.password })}
              sx={{
                bgcolor: `${u.color}18`, color: u.color,
                border: `1px solid ${u.color}40`, cursor: 'pointer', fontWeight: 600,
                '&:hover': { bgcolor: `${u.color}30`, transform: 'scale(1.05)' },
                transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
              }}
            />
          ))}
        </Box>
      </Box>
    </Box>
  )
}

function RegisterForm({ onSuccess }) {
  const { signUp } = useAuth()
  const [form, setForm] = useState({
    full_name: '', username: '', email: '',
    password: '', confirm: '', title: '', department: '', location: '',
  })
  const [errors,  setErrors]  = useState({})
  const [apiErr,  setApiErr]  = useState('')
  const [loading, setLoading] = useState(false)
  const [showPw,  setShowPw]  = useState(false)

  const validate = () => {
    const e = {}
    if (!form.full_name.trim())    e.full_name = 'Full name is required'
    if (!form.username.trim())     e.username  = 'Username is required'
    if (form.username.length < 3)  e.username  = 'Minimum 3 characters'
    if (!/^[a-z0-9_]+$/i.test(form.username)) e.username = 'Letters, numbers, underscores only'
    if (!form.email.includes('@')) e.email     = 'Valid email is required'
    if (form.password.length < 8)  e.password  = 'Minimum 8 characters'
    if (!/[A-Z]/.test(form.password)) e.password = 'Must contain an uppercase letter'
    if (!/[0-9]/.test(form.password)) e.password = 'Must contain a number'
    if (form.password !== form.confirm) e.confirm = 'Passwords do not match'
    return e
  }

  const handleSubmit = async () => {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    setErrors({}); setApiErr(''); setLoading(true)
    try {
      const user = await signUp({
        full_name:  form.full_name,
        username:   form.username.toLowerCase(),
        email:      form.email.toLowerCase(),
        password:   form.password,
        title:      form.title,
        department: form.department,
        location:   form.location,
      })
      onSuccess(user)
    } catch (err) {
      const fields = err.response?.data?.fields
      if (fields) setErrors(fields)
      else setApiErr(err.response?.data?.error || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  const f = key => ({
    value: form[key],
    onChange: e => setForm(p => ({ ...p, [key]: e.target.value })),
    error: !!errors[key],
    helperText: errors[key],
  })

  const strength = [
    form.password.length >= 8,
    /[A-Z]/.test(form.password),
    /[0-9]/.test(form.password),
    /[^a-zA-Z0-9]/.test(form.password),
  ]
  const strengthScore  = strength.filter(Boolean).length
  const strengthColors = ['#FF6B6B', '#FF9F43', '#FFD166', '#6BCB77']
  const strengthLabels = ['Weak', 'Fair', 'Good', 'Strong']

  return (
    <Box>
      {apiErr && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 3 }}>{apiErr}</Alert>
      )}

      <Alert severity="info" sx={{ mb: 2, borderRadius: 3, bgcolor: 'rgba(78,205,196,0.1)', color: '#4ECDC4', border: '1px solid rgba(78,205,196,0.2)', fontSize: '0.8rem' }}>
        New accounts start with Viewer access. An admin can upgrade your role.
      </Alert>

      <TextField label="Full Name" fullWidth margin="dense" required autoFocus {...f('full_name')} />
      <TextField label="Username" fullWidth margin="dense" required
        {...f('username')}
        helperText={errors.username || 'Letters, numbers, underscores only'}
      />
      <TextField label="Email" type="email" fullWidth margin="dense" required {...f('email')} />

      <TextField
        label="Password" type={showPw ? 'text' : 'password'}
        fullWidth margin="dense" required {...f('password')}
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

      {form.password && (
        <Box sx={{ mt: 0.5, mb: 1 }}>
          <Box sx={{ display: 'flex', gap: 0.5, mb: 0.5 }}>
            {[0,1,2,3].map(i => (
              <Box key={i} sx={{
                height: 3, flex: 1, borderRadius: 2,
                bgcolor: i < strengthScore ? strengthColors[strengthScore - 1] : '#2a2d3e',
                transition: 'background-color 0.3s ease',
              }} />
            ))}
          </Box>
          <Typography variant="caption" sx={{ color: strengthColors[strengthScore - 1] || '#8b8fa8' }}>
            {form.password ? (strengthLabels[strengthScore - 1] || 'Too weak') : ''}
          </Typography>
        </Box>
      )}

      <TextField label="Confirm Password" type="password" fullWidth margin="dense" required {...f('confirm')} />

      <Divider sx={{ borderColor: '#2a2d3e', my: 2 }}>
        <Typography variant="caption" color="text.secondary">Optional profile info</Typography>
      </Divider>

      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
        <TextField label="Job Title" size="small" {...f('title')} />
        <TextField label="Department" size="small" {...f('department')} />
        <TextField label="Location" size="small" sx={{ gridColumn: '1 / -1' }} {...f('location')} />
      </Box>

      <Button
        fullWidth variant="contained" size="large"
        sx={{ mt: 2.5, py: 1.4, bgcolor: '#4ECDC4', color: '#13141a', fontWeight: 700, borderRadius: 3,
          '&:hover': { bgcolor: '#3dbdb5', transform: 'translateY(-2px)', boxShadow: '0 8px 24px rgba(78,205,196,0.3)' } }}
        onClick={handleSubmit} disabled={loading} startIcon={!loading && <PersonAdd />}
      >
        {loading ? <CircularProgress size={22} sx={{ color: '#13141a' }} /> : 'Create Account'}
      </Button>
    </Box>
  )
}

export default function LoginPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState(0)

  const handleSuccess = () => {
    navigate('/', { replace: true })
  }

  return (
    <Box sx={{
      minHeight: '100vh', bgcolor: '#13141a',
      display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2,
      backgroundImage: `
        radial-gradient(ellipse at 20% 50%, rgba(107,203,119,0.06) 0%, transparent 60%),
        radial-gradient(ellipse at 80% 20%, rgba(78,205,196,0.06) 0%, transparent 60%),
        radial-gradient(ellipse at 60% 80%, rgba(255,209,102,0.04) 0%, transparent 50%)
      `,
    }}>
      <Box sx={{ width: '100%', maxWidth: 440 }}>
        {/* Header */}
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Box sx={{
            width: 60, height: 60, borderRadius: 4,
            background: 'linear-gradient(135deg, #6BCB77, #4ECDC4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            mx: 'auto', mb: 2,
            boxShadow: '0 8px 32px rgba(107,203,119,0.3)',
            transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
            '&:hover': { transform: 'scale(1.1) rotate(-5deg)' },
          }}>
            <Groups sx={{ fontSize: 32, color: '#13141a' }} />
          </Box>
          <Typography variant="h5" fontWeight={800} color="text.primary" letterSpacing="-0.02em">
            ACME Team Management
          </Typography>
          <Typography variant="body2" color="text.secondary" mt={0.5}>
            {tab === 0 ? 'Welcome back — sign in to continue' : 'Create your account to get started'}
          </Typography>
        </Box>

        <Card sx={{ bgcolor: '#1e2029', border: '1px solid #2a2d3e', borderRadius: 4, overflow: 'hidden' }}>
          <Tabs
            value={tab} onChange={(_, v) => setTab(v)}
            sx={{
              px: 2, pt: 1,
              '& .MuiTab-root': {
                textTransform: 'none', fontWeight: 600, borderRadius: 2,
                minHeight: 40, color: '#8b8fa8',
                transition: 'all 0.2s ease',
              },
              '& .Mui-selected': { color: 'text.primary' },
              '& .MuiTabs-indicator': { bgcolor: '#6BCB77', borderRadius: 2, height: 3 },
            }}
          >
            <Tab label="Sign In" icon={<Login sx={{ fontSize: 16 }} />} iconPosition="start" />
            <Tab label="Create Account" icon={<PersonAdd sx={{ fontSize: 16 }} />} iconPosition="start" />
          </Tabs>

          <Divider sx={{ borderColor: '#2a2d3e' }} />

          <CardContent sx={{ p: 3, maxHeight: '70vh', overflow: 'auto' }}>
            {tab === 0
              ? <LoginForm onSuccess={handleSuccess} />
              : <RegisterForm onSuccess={handleSuccess} />
            }
          </CardContent>
        </Card>

        <Typography variant="caption" color="text.secondary" display="block" textAlign="center" mt={2}>
          ACME Inc. Team Management Platform · {new Date().getFullYear()}
        </Typography>
      </Box>
    </Box>
  )
}
