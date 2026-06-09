import { useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import {
  Box, Tooltip, Avatar, Divider, Menu, MenuItem,
  Typography, useMediaQuery, useTheme, Drawer, IconButton,
} from '@mui/material'
import {
  Dashboard, Groups, Person, EmojiEvents,
  AdminPanelSettings, Logout, Menu as MenuIcon,
} from '@mui/icons-material'
import { useAuth } from '../context/AuthContext'

const SIDEBAR_W = 68
const MOBILE_DRAWER_W = 220

const NAV = [
  { label: 'Dashboard',    path: '/',             icon: <Dashboard /> },
  { label: 'Teams',        path: '/teams',        icon: <Groups /> },
  { label: 'Members',      path: '/members',      icon: <Person /> },
  { label: 'Achievements', path: '/achievements', icon: <EmojiEvents /> },
]

const ROLE_COLORS = {
  admin: '#FF6B6B', manager: '#FFD166', contributor: '#6BCB77', viewer: '#4ECDC4'
}

function NavIcon({ item, active, onClick }) {
  return (
    <Tooltip title={item.label} placement="right">
      <Box
        onClick={onClick}
        sx={{
          width: 44, height: 44,
          borderRadius: 2.5,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', mb: 0.5,
          color: active ? '#fff' : '#8b8fa8',
          bgcolor: active ? 'primary.main' : 'transparent',
          transition: 'all 0.15s',
          '&:hover': { bgcolor: active ? 'primary.main' : '#252736', color: '#fff' },
        }}
      >
        {item.icon}
      </Box>
    </Tooltip>
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
    ? [...NAV, { label: 'Users', path: '/users', icon: <AdminPanelSettings /> }]
    : NAV

  const isActive = (path) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path)

  const sidebarContent = (
    <Box sx={{
      width: isMobile ? MOBILE_DRAWER_W : SIDEBAR_W,
      height: '100vh',
      bgcolor: '#16171f',
      borderRight: '1px solid #2a2d3e',
      display: 'flex', flexDirection: 'column',
      alignItems: isMobile ? 'flex-start' : 'center',
      py: 2, px: isMobile ? 2 : 1.5,
    }}>
      <Box sx={{
        width: 36, height: 36, borderRadius: 2,
        bgcolor: 'primary.main', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        mb: 3, flexShrink: 0,
      }}>
        <Groups sx={{ fontSize: 20, color: '#13141a' }} />
      </Box>

      <Box sx={{ flexGrow: 1, width: '100%', display: 'flex', flexDirection: 'column', alignItems: isMobile ? 'flex-start' : 'center' }}>
        {navItems.map(item => (
          isMobile ? (
            <Box
              key={item.path}
              onClick={() => { navigate(item.path); setMobileOpen(false) }}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1.5,
                px: 1.5, py: 1.2, borderRadius: 2, mb: 0.5, width: '100%',
                cursor: 'pointer',
                color: isActive(item.path) ? '#fff' : '#8b8fa8',
                bgcolor: isActive(item.path) ? 'primary.main' : 'transparent',
                '&:hover': { bgcolor: isActive(item.path) ? 'primary.main' : '#252736', color: '#fff' },
              }}
            >
              {item.icon}
              <Typography variant="body2" fontWeight={600}>{item.label}</Typography>
            </Box>
          ) : (
            <NavIcon
              key={item.path}
              item={item}
              active={isActive(item.path)}
              onClick={() => navigate(item.path)}
            />
          )
        ))}
      </Box>

      <Divider sx={{ borderColor: '#2a2d3e', width: '100%', mb: 2 }} />

      <Tooltip title={`${user?.username} (${user?.role})`} placement="right">
        <Avatar
          onClick={e => setAnchorEl(e.currentTarget)}
          sx={{
            width: 36, height: 36, cursor: 'pointer',
            bgcolor: ROLE_COLORS[user?.role] || '#6BCB77',
            fontSize: 14, fontWeight: 700, color: '#13141a',
          }}
        >
          {(user?.username || 'U')[0].toUpperCase()}
        </Avatar>
      </Tooltip>

      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}
        PaperProps={{ sx: { bgcolor: '#1e2029', border: '1px solid #2a2d3e', minWidth: 180 } }}
      >
        <Box sx={{ px: 2, py: 1 }}>
          <Typography variant="body2" fontWeight={700}>{user?.full_name || user?.username}</Typography>
          <Typography variant="caption" color="text.secondary">{user?.role}</Typography>
        </Box>
        <Divider sx={{ borderColor: '#2a2d3e' }} />
        <MenuItem onClick={() => { setAnchorEl(null); signOut(); navigate('/login') }}
          sx={{ gap: 1, color: '#FF6B6B', mt: 0.5 }}>
          <Logout fontSize="small" /> Sign out
        </MenuItem>
      </Menu>
    </Box>
  )

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      {isMobile && (
        <Box sx={{
          position: 'fixed', top: 0, left: 0, right: 0, height: 56,
          bgcolor: '#16171f', borderBottom: '1px solid #2a2d3e',
          display: 'flex', alignItems: 'center', px: 2, zIndex: 1200,
        }}>
          <IconButton onClick={() => setMobileOpen(true)} sx={{ color: '#8b8fa8' }}>
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" sx={{ ml: 1, fontSize: 16 }}>ACME Teams</Typography>
        </Box>
      )}

      {!isMobile && sidebarContent}

      <Drawer open={mobileOpen} onClose={() => setMobileOpen(false)}
        PaperProps={{ sx: { bgcolor: 'transparent', border: 'none' } }}>
        {sidebarContent}
      </Drawer>

      <Box component="main" sx={{
        flexGrow: 1, p: { xs: 2, md: 3 },
        mt: isMobile ? 7 : 0,
        overflow: 'auto', minHeight: '100vh',
      }}>
        <Outlet />
      </Box>
    </Box>
  )
}
