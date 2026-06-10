import { useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import {
  Box, Tooltip, Avatar, Divider, Menu, MenuItem,
  Typography, useMediaQuery, useTheme, IconButton,
  Chip, Drawer,
} from '@mui/material'
import {
  Dashboard, Groups, Person, EmojiEvents,
  AdminPanelSettings, Logout,
  Timeline, Security, FolderOpen, Menu as MenuIcon,
} from '@mui/icons-material'
import { useAuth } from '../context/AuthContext'


const ROLE_COLORS = {
  admin: '#FF6B6B', manager: '#FFD166',
  contributor: '#6BCB77', viewer: '#4ECDC4'
}

const NAV = [
  { label: 'Dashboard', path: '/', icon: <Dashboard sx={{ fontSize: 16 }} /> },
  { label: 'Projects', path: '/projects', icon: <FolderOpen sx={{ fontSize: 16 }} /> },
  { label: 'Teams', path: '/teams', icon: <Groups sx={{ fontSize: 16 }} /> },
  { label: 'Members', path: '/members', icon: <Person sx={{ fontSize: 16 }} /> },
  { label: 'Achievements', path: '/achievements', icon: <EmojiEvents sx={{ fontSize: 16 }} /> },
  { label: 'Activity', path: '/activity', icon: <Timeline sx={{ fontSize: 16 }} /> },
]


export default function Layout() {
  const { user, signOut, isAdmin } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [anchorEl, setAnchorEl] = useState(null)
  const [mobileOpen, setMobileOpen] = useState(false)

  const navItems = isAdmin
    ? [...NAV,
      { label: 'Users', path: '/users', icon: <AdminPanelSettings sx={{ fontSize: 16 }} /> },
      { label: 'Audit', path: '/audit', icon: <Security sx={{ fontSize: 16 }} /> },
    ]
    : NAV

  const isActive = (path) => (
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path)
  )

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <Box sx={{
        position: 'sticky', top: 0, zIndex: 100,
        bgcolor: 'rgba(19,20,26,0.92)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid #2a2d3e',
        px: { xs: 2, md: 4 },
        py: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        height: 52,
      }}>
        <Box
          onClick={() => navigate('/')}
          sx={{
            display: 'flex', alignItems: 'center', gap: 1,
            cursor: 'pointer', flexShrink: 0,
            transition: 'opacity 0.2s',
            '&:hover': { opacity: 0.8 },
          }}
        >
          <Box sx={{
            width: 28, height: 28, borderRadius: 2,
            background: 'linear-gradient(135deg, #6BCB77, #4ECDC4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Groups sx={{ fontSize: 16, color: '#13141a' }} />
          </Box>
          <Typography variant="body2" fontWeight={800}
            sx={{ display: { xs: 'none', sm: 'block' }, letterSpacing: '-0.01em' }}>
            ACME
          </Typography>
        </Box>

        <Divider orientation="vertical" flexItem sx={{ borderColor: '#2a2d3e', my: 1 }} />

        {!isMobile && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {navItems.map((item) => (
              <Box
                key={item.path}
                onClick={() => navigate(item.path)}
                sx={{
                  position: 'relative',
                  display: 'flex', alignItems: 'center', gap: 0.8,
                  px: 1.5, py: 0.8, borderRadius: 2,
                  cursor: 'pointer',
                  color: isActive(item.path) ? '#fff' : '#8b8fa8',
                  bgcolor: isActive(item.path) ? 'rgba(255,255,255,0.08)' : 'transparent',
                  transition: 'all 0.15s ease',
                  '&:hover': {
                    bgcolor: 'rgba(255,255,255,0.06)',
                    color: '#fff',
                  },
                }}
              >
                {item.icon}
                <Typography variant="caption" fontWeight={isActive(item.path) ? 700 : 500}
                  sx={{ fontSize: '0.8rem' }}>
                  {item.label}
                </Typography>
                {isActive(item.path) && (
                  <Box sx={{
                    position: 'absolute',
                    bottom: 0,
                    width: '100%',
                    height: 2,
                    bgcolor: '#6BCB77',
                    borderRadius: '2px 2px 0 0',
                  }} />
                )}
              </Box>
            ))}
          </Box>
        )}

        <Box sx={{ flexGrow: 1 }} />

        <Tooltip title={`${user?.full_name || user?.username} · ${user?.role}`}>
          <Avatar
            onClick={(e) => setAnchorEl(e.currentTarget)}
            sx={{
              width: 32, height: 32, cursor: 'pointer', flexShrink: 0,
              bgcolor: user?.avatar_color || ROLE_COLORS[user?.role] || '#6BCB77',
              fontSize: 13, fontWeight: 700, color: '#13141a',
              border: `2px solid ${user?.avatar_color || ROLE_COLORS[user?.role] || '#6BCB77'}40`,
              transition: 'all 0.2s cubic-bezier(0.34,1.56,0.64,1)',
              '&:hover': { transform: 'scale(1.1)' },
            }}
          >
            {(user?.username || 'U')[0].toUpperCase()}
          </Avatar>
        </Tooltip>

        {isMobile && (
          <IconButton onClick={() => setMobileOpen(true)}
            sx={{ color: '#8b8fa8', flexShrink: 0 }}>
            <MenuIcon />
          </IconButton>
        )}
      </Box>

      {!isMobile && (
        <Box sx={{
          height: 2,
          bgcolor: '#13141a',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {navItems.map((item) => isActive(item.path) && (
            <Box key={item.path} sx={{
              position: 'absolute', bottom: 0, height: 2,
              bgcolor: '#6BCB77',
              width: '100%',
              opacity: 0.4,
            }} />
          ))}
        </Box>
      )}

      <Drawer open={mobileOpen} onClose={() => setMobileOpen(false)}
        PaperProps={{ sx: { bgcolor: '#16171f', border: 'none', width: 240 } }}>
        <Box sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
            <Box sx={{
              width: 32, height: 32, borderRadius: 2,
              background: 'linear-gradient(135deg, #6BCB77, #4ECDC4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Groups sx={{ fontSize: 18, color: '#13141a' }} />
            </Box>
            <Typography fontWeight={800}>ACME Teams</Typography>
          </Box>
          {navItems.map((item) => (
            <Box key={item.path}
              onClick={() => {
                navigate(item.path)
                setMobileOpen(false)
              }}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1.5,
                px: 1.5, py: 1.2, borderRadius: 2, mb: 0.5, cursor: 'pointer',
                color: isActive(item.path) ? '#fff' : '#8b8fa8',
                bgcolor: isActive(item.path) ? 'rgba(107,203,119,0.15)' : 'transparent',
                '&:hover': { bgcolor: '#252736', color: '#fff' },
              }}>
              {item.icon}
              <Typography variant="body2" fontWeight={600}>{item.label}</Typography>
            </Box>
          ))}
        </Box>
      </Drawer>

      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        PaperProps={{ sx: {
          bgcolor: '#1e2029', border: '1px solid #2a2d3e',
          borderRadius: 3, minWidth: 220,
          boxShadow: '0 16px 48px rgba(0,0,0,0.4)',
        } }}>
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
          <Chip label={user?.role} size="small" sx={{
            mt: 0.5,
            bgcolor: `${ROLE_COLORS[user?.role]}20`,
            color: ROLE_COLORS[user?.role],
            border: `1px solid ${ROLE_COLORS[user?.role]}40`,
            fontSize: '0.7rem', fontWeight: 700,
          }} />
        </Box>
        <Divider sx={{ borderColor: '#2a2d3e' }} />
        <MenuItem
          onClick={() => {
            setAnchorEl(null)
            signOut()
            navigate('/login')
          }}
          sx={{
            gap: 1.5, color: '#FF6B6B', mt: 0.5,
            borderRadius: 2, mx: 1, mb: 0.5,
            '&:hover': { bgcolor: 'rgba(255,107,107,0.1)' },
          }}>
          <Logout fontSize="small" /> Sign out
        </MenuItem>
      </Menu>

      <Box component="main" sx={{
        maxWidth: 1400, mx: 'auto',
        px: { xs: 2, md: 4 }, py: 3,
      }}>
        <Outlet />
      </Box>
    </Box>
  )
}
