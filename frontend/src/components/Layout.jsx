import { useState, useCallback } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import {
  Box, Tooltip, Avatar, Divider, Menu, MenuItem,
  Typography, useMediaQuery, useTheme, Drawer, IconButton,
  InputBase, Paper, List, ListItem, ListItemText, Chip,
  ClickAwayListener,
} from '@mui/material'
import {
  Dashboard, Groups, Person, EmojiEvents,
  AdminPanelSettings, Logout, Menu as MenuIcon,
  Search, Timeline, Security, Close,
} from '@mui/icons-material'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'

const SIDEBAR_W = 72
const BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3001') + '/api/team-service'

const ROLE_COLORS = {
  admin: '#FF6B6B', manager: '#FFD166', contributor: '#6BCB77', viewer: '#4ECDC4'
}

const NAV = [
  { label: 'Dashboard',    path: '/',             icon: <Dashboard /> },
  { label: 'Teams',        path: '/teams',        icon: <Groups /> },
  { label: 'Members',      path: '/members',      icon: <Person /> },
  { label: 'Achievements', path: '/achievements', icon: <EmojiEvents /> },
  { label: 'Activity',     path: '/activity',     icon: <Timeline /> },
]

function GlobalSearch() {
  const navigate   = useNavigate()
  const [q,        setQ]       = useState('')
  const [results,  setResults] = useState(null)
  const [open,     setOpen]    = useState(false)
  const [loading,  setLoading] = useState(false)

  const search = useCallback(async (val) => {
    if (val.length < 2) { setResults(null); return }
    setLoading(true)
    try {
      const token = localStorage.getItem('acme_token')
      const r = await axios.get(`${BASE}/search?q=${encodeURIComponent(val)}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setResults(r.data)
    } catch { setResults(null) }
    finally { setLoading(false) }
  }, [])

  const handleChange = (e) => {
    const val = e.target.value
    setQ(val)
    setOpen(true)
    const t = setTimeout(() => search(val), 300)
    return () => clearTimeout(t)
  }

  const handleSelect = (type, id) => {
    setOpen(false)
    setQ('')
    setResults(null)
    if (type === 'team')        navigate(`/teams/${id}`)
    if (type === 'member')      navigate(`/members`)
    if (type === 'achievement') navigate(`/achievements`)
  }

  const total = results ? results.total : 0

  return (
    <ClickAwayListener onClickAway={() => setOpen(false)}>
      <Box sx={{ position: 'relative', flexGrow: 1, maxWidth: 480 }}>
        <Paper sx={{
          display: 'flex', alignItems: 'center', gap: 1,
          px: 2, py: 0.8, bgcolor: '#16171f',
          border: '1px solid', borderColor: open ? '#6BCB77' : '#2a2d3e',
          borderRadius: 3, transition: 'all 0.2s ease',
          boxShadow: open ? '0 0 0 3px rgba(107,203,119,0.15)' : 'none',
        }}>
          <Search sx={{ color: '#8b8fa8', fontSize: 18 }} />
          <InputBase
            placeholder="Search teams, members, achievements…"
            value={q}
            onChange={handleChange}
            onFocus={() => q.length >= 2 && setOpen(true)}
            sx={{ flexGrow: 1, fontSize: '0.875rem', color: 'text.primary',
              '& input::placeholder': { color: '#8b8fa8' } }}
          />
          {q && (
            <IconButton size="small" onClick={() => { setQ(''); setResults(null); setOpen(false) }}
              sx={{ color: '#8b8fa8', p: 0.3 }}>
              <Close sx={{ fontSize: 16 }} />
            </IconButton>
          )}
        </Paper>

        {/* Results dropdown */}
        {open && results && (
          <Paper sx={{
            position: 'absolute', top: '110%', left: 0, right: 0,
            bgcolor: '#1e2029', border: '1px solid #2a2d3e',
            borderRadius: 3, zIndex: 9999,
            boxShadow: '0 16px 48px rgba(0,0,0,0.4)',
            maxHeight: 400, overflow: 'auto',
          }}>
            {total === 0 ? (
              <Box sx={{ p: 3, textAlign: 'center', color: '#8b8fa8' }}>
                <Typography variant="body2">No results for "{q}"</Typography>
              </Box>
            ) : (
              <>
                {results.teams?.length > 0 && (
                  <>
                    <Box sx={{ px: 2, pt: 1.5, pb: 0.5 }}>
                      <Typography variant="caption" sx={{ color: '#8b8fa8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        Teams ({results.counts.teams})
                      </Typography>
                    </Box>
                    {results.teams.map(t => (
                      <ListItem key={t.id} onClick={() => handleSelect('team', t.id)}
                        sx={{ cursor: 'pointer', py: 1, '&:hover': { bgcolor: '#252736' } }}>
                        <Avatar sx={{ width: 28, height: 28, bgcolor: 'rgba(107,203,119,0.2)', color: '#6BCB77', fontSize: 12, mr: 1.5 }}>
                          {t.name[0]}
                        </Avatar>
                        <ListItemText
                          primary={<Typography variant="body2" fontWeight={600}>{t.name}</Typography>}
                          secondary={<Typography variant="caption" color="text.secondary">{t.department} · {t.location}</Typography>}
                        />
                        <Chip label="Team" size="small" sx={{ bgcolor: 'rgba(107,203,119,0.12)', color: '#6BCB77', fontSize: '0.65rem' }} />
                      </ListItem>
                    ))}
                  </>
                )}

                {results.members?.length > 0 && (
                  <>
                    <Divider sx={{ borderColor: '#2a2d3e' }} />
                    <Box sx={{ px: 2, pt: 1.5, pb: 0.5 }}>
                      <Typography variant="caption" sx={{ color: '#8b8fa8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        Members ({results.counts.members})
                      </Typography>
                    </Box>
                    {results.members.map(m => (
                      <ListItem key={m.id} onClick={() => handleSelect('member', m.id)}
                        sx={{ cursor: 'pointer', py: 1, '&:hover': { bgcolor: '#252736' } }}>
                        <Avatar sx={{ width: 28, height: 28, bgcolor: 'rgba(78,205,196,0.2)', color: '#4ECDC4', fontSize: 12, mr: 1.5 }}>
                          {m.name[0]}
                        </Avatar>
                        <ListItemText
                          primary={<Typography variant="body2" fontWeight={600}>{m.name}</Typography>}
                          secondary={<Typography variant="caption" color="text.secondary">{m.role} · {m.location}</Typography>}
                        />
                        <Chip label="Member" size="small" sx={{ bgcolor: 'rgba(78,205,196,0.12)', color: '#4ECDC4', fontSize: '0.65rem' }} />
                      </ListItem>
                    ))}
                  </>
                )}

                {results.achievements?.length > 0 && (
                  <>
                    <Divider sx={{ borderColor: '#2a2d3e' }} />
                    <Box sx={{ px: 2, pt: 1.5, pb: 0.5 }}>
                      <Typography variant="caption" sx={{ color: '#8b8fa8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        Achievements ({results.counts.achievements})
                      </Typography>
                    </Box>
                    {results.achievements.map(a => (
                      <ListItem key={a.id} onClick={() => handleSelect('achievement', a.id)}
                        sx={{ cursor: 'pointer', py: 1, '&:hover': { bgcolor: '#252736' } }}>
                        <Avatar sx={{ width: 28, height: 28, bgcolor: 'rgba(255,209,102,0.2)', color: '#FFD166', fontSize: 12, mr: 1.5 }}>
                          🏆
                        </Avatar>
                        <ListItemText
                          primary={<Typography variant="body2" fontWeight={600}>{a.title}</Typography>}
                          secondary={<Typography variant="caption" color="text.secondary">{a.impact}</Typography>}
                        />
                        <Chip label="Achievement" size="small" sx={{ bgcolor: 'rgba(255,209,102,0.12)', color: '#FFD166', fontSize: '0.65rem' }} />
                      </ListItem>
                    ))}
                  </>
                )}

                <Box sx={{ px: 2, py: 1, borderTop: '1px solid #2a2d3e' }}>
                  <Typography variant="caption" color="text.secondary">
                    {total} result{total !== 1 ? 's' : ''} for "{q}"
                  </Typography>
                </Box>
              </>
            )}
          </Paper>
        )}
      </Box>
    </ClickAwayListener>
  )
}

export default function Layout() {
  const { user, signOut, isAdmin } = useAuth()
  const navigate  = useNavigate()
  const location  = useLocation()
  const theme     = useTheme()
  const isMobile  = useMediaQuery(theme.breakpoints.down('md'))
  const [mobileOpen, setMobileOpen] = useState(false)
  const [anchorEl,   setAnchorEl]   = useState(null)

  const navItems = isAdmin
    ? [...NAV,
        { label: 'Users', path: '/users', icon: <AdminPanelSettings /> },
        { label: 'Audit', path: '/audit', icon: <Security /> },
      ]
    : NAV

  const isActive = path =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path)

  const NavItem = ({ item }) => (
    <Tooltip title={item.label} placement="right" arrow>
      <Box
        onClick={() => { navigate(item.path); setMobileOpen(false) }}
        sx={{
          width: 44, height: 44, borderRadius: 2.5,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', mb: 0.5,
          color: isActive(item.path) ? '#13141a' : '#8b8fa8',
          bgcolor: isActive(item.path) ? '#6BCB77' : 'transparent',
          transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
          '&:hover': {
            bgcolor: isActive(item.path) ? '#6BCB77' : '#252736',
            color: isActive(item.path) ? '#13141a' : '#fff',
            transform: 'scale(1.1)',
          },
          '&:active': { transform: 'scale(0.95)' },
        }}
      >
        {item.icon}
      </Box>
    </Tooltip>
  )

  const sidebar = (
    <Box sx={{
      width: isMobile ? 220 : SIDEBAR_W,
      height: '100vh',
      bgcolor: '#16171f',
      borderRight: '1px solid #2a2d3e',
      display: 'flex', flexDirection: 'column',
      alignItems: isMobile ? 'flex-start' : 'center',
      py: 2, px: isMobile ? 2 : 1.5,
      position: 'fixed', top: 0, left: 0, zIndex: 100,
    }}>
      {/* Logo */}
      <Box sx={{
        width: 40, height: 40, borderRadius: 3,
        background: 'linear-gradient(135deg, #6BCB77, #4ECDC4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        mb: 3, flexShrink: 0, cursor: 'pointer',
        transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
        '&:hover': { transform: 'scale(1.1) rotate(-5deg)' },
      }} onClick={() => navigate('/')}>
        <Groups sx={{ fontSize: 22, color: '#13141a' }} />
      </Box>

      {/* Nav */}
      <Box sx={{ flexGrow: 1, width: '100%', display: 'flex', flexDirection: 'column', alignItems: isMobile ? 'flex-start' : 'center' }}>
        {navItems.map(item =>
          isMobile ? (
            <Box key={item.path} onClick={() => { navigate(item.path); setMobileOpen(false) }}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1.5,
                px: 1.5, py: 1.2, borderRadius: 2, mb: 0.5, width: '100%', cursor: 'pointer',
                color: isActive(item.path) ? '#13141a' : '#8b8fa8',
                bgcolor: isActive(item.path) ? '#6BCB77' : 'transparent',
                transition: 'all 0.2s ease',
                '&:hover': { bgcolor: isActive(item.path) ? '#6BCB77' : '#252736', color: isActive(item.path) ? '#13141a' : '#fff' },
              }}>
              {item.icon}
              <Typography variant="body2" fontWeight={600}>{item.label}</Typography>
            </Box>
          ) : (
            <NavItem key={item.path} item={item} />
          )
        )}
      </Box>

      <Divider sx={{ borderColor: '#2a2d3e', width: '100%', mb: 2 }} />

      {/* User avatar */}
      <Tooltip title={`${user?.username} · ${user?.role}`} placement="right">
        <Avatar
          onClick={e => setAnchorEl(e.currentTarget)}
          sx={{
            width: 38, height: 38, cursor: 'pointer',
            bgcolor: ROLE_COLORS[user?.role] || '#6BCB77',
            fontSize: 15, fontWeight: 700, color: '#13141a',
            border: `2px solid ${ROLE_COLORS[user?.role] || '#6BCB77'}40`,
            transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
            '&:hover': { transform: 'scale(1.1)', boxShadow: `0 0 0 4px ${ROLE_COLORS[user?.role] || '#6BCB77'}20` },
          }}
        >
          {(user?.username || 'U')[0].toUpperCase()}
        </Avatar>
      </Tooltip>

      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}
        PaperProps={{ sx: { bgcolor: '#1e2029', border: '1px solid #2a2d3e', borderRadius: 3, minWidth: 200 } }}>
        <Box sx={{ px: 2, py: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
            <Avatar sx={{
              width: 40, height: 40,
              bgcolor: user?.avatar_color || ROLE_COLORS[user?.role] || '#6BCB77',
              fontSize: 16, fontWeight: 700, color: '#13141a',
            }}>
              {(user?.username || 'U')[0].toUpperCase()}
            </Avatar>
            <Box>
              <Typography variant="body2" fontWeight={700} lineHeight={1.2}>
                {user?.full_name || user?.username}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {user?.title || user?.email}
              </Typography>
            </Box>
          </Box>
          {user?.department && (
            <Typography variant="caption" color="text.secondary" display="block">
              {user.department}{user.location ? ` · ${user.location}` : ''}
            </Typography>
          )}
          <Chip
            label={user?.role}
            size="small"
            sx={{
              mt: 0.5,
              bgcolor: `${ROLE_COLORS[user?.role]}20`,
              color: ROLE_COLORS[user?.role],
              border: `1px solid ${ROLE_COLORS[user?.role]}40`,
              fontSize: '0.7rem', fontWeight: 700,
            }}
          />
        </Box>
        <Divider sx={{ borderColor: '#2a2d3e' }} />
        <MenuItem onClick={() => { setAnchorEl(null); signOut(); navigate('/login') }}
          sx={{ gap: 1.5, color: '#FF6B6B', mt: 0.5, borderRadius: 2, mx: 1, mb: 0.5,
            '&:hover': { bgcolor: 'rgba(255,107,107,0.1)' } }}>
          <Logout fontSize="small" /> Sign out
        </MenuItem>
      </Menu>
    </Box>
  )

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Desktop sidebar */}
      {!isMobile && sidebar}

      {/* Mobile drawer */}
      <Drawer open={mobileOpen} onClose={() => setMobileOpen(false)}
        PaperProps={{ sx: { bgcolor: 'transparent', border: 'none' } }}>
        {sidebar}
      </Drawer>

      {/* Main area */}
      <Box sx={{
        flexGrow: 1,
        ml: isMobile ? 0 : `${SIDEBAR_W}px`,
        display: 'flex', flexDirection: 'column', minHeight: '100vh',
      }}>
        {/* Top bar with search */}
        <Box sx={{
          position: 'sticky', top: 0, zIndex: 50,
          bgcolor: 'rgba(19,20,26,0.85)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid #2a2d3e',
          px: { xs: 2, md: 3 }, py: 1.5,
          display: 'flex', alignItems: 'center', gap: 2,
        }}>
          {isMobile && (
            <IconButton onClick={() => setMobileOpen(true)} sx={{ color: '#8b8fa8' }}>
              <MenuIcon />
            </IconButton>
          )}
          <GlobalSearch />
          <Avatar
            onClick={e => setAnchorEl(e.currentTarget)}
            sx={{
              display: { xs: 'flex', md: 'none' },
              width: 34, height: 34, cursor: 'pointer',
              bgcolor: ROLE_COLORS[user?.role] || '#6BCB77',
              fontSize: 13, fontWeight: 700, color: '#13141a',
            }}
          >
            {(user?.username || 'U')[0].toUpperCase()}
          </Avatar>
        </Box>

        {/* Page content */}
        <Box component="main" sx={{ flexGrow: 1, p: { xs: 2, md: 3 } }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  )
}
