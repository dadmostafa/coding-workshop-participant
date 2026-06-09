import { useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import {
  Box, Drawer, AppBar, Toolbar, Typography, List, ListItem,
  ListItemButton, ListItemIcon, ListItemText, IconButton,
  Avatar, Menu, MenuItem, Divider, Chip, useMediaQuery, useTheme,
} from '@mui/material'
import {
  Dashboard, Groups, Person, EmojiEvents, Settings,
  Menu as MenuIcon, Logout, AdminPanelSettings,
} from '@mui/icons-material'
import { useAuth } from '../context/AuthContext'

const DRAWER_WIDTH = 240

const NAV = [
  { label: 'Dashboard',    path: '/',             icon: <Dashboard /> },
  { label: 'Teams',        path: '/teams',        icon: <Groups /> },
  { label: 'Members',      path: '/members',      icon: <Person /> },
  { label: 'Achievements', path: '/achievements', icon: <EmojiEvents /> },
]

const ROLE_COLOR = {
  admin: 'error', manager: 'warning', contributor: 'info', viewer: 'default'
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

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Toolbar sx={{ bgcolor: 'primary.main' }}>
        <Typography variant="h6" sx={{ color: 'white', fontWeight: 700 }}>
          ACME Teams
        </Typography>
      </Toolbar>
      <List sx={{ flexGrow: 1, pt: 1 }}>
        {navItems.map(item => (
          <ListItem key={item.path} disablePadding>
            <ListItemButton
              selected={location.pathname === item.path ||
                (item.path !== '/' && location.pathname.startsWith(item.path))}
              onClick={() => { navigate(item.path); setMobileOpen(false) }}
              sx={{
                mx: 1, borderRadius: 2, mb: 0.5,
                '&.Mui-selected': { bgcolor: 'primary.light', color: 'primary.dark' },
              }}
            >
              <ListItemIcon sx={{ minWidth: 38 }}>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      <Divider />
      <Box sx={{ p: 2 }}>
        <Typography variant="caption" color="text.secondary">
          Logged in as
        </Typography>
        <Typography variant="body2" fontWeight={600}>{user?.full_name || user?.username}</Typography>
        <Chip
          size="small"
          label={user?.role}
          color={ROLE_COLOR[user?.role] || 'default'}
          sx={{ mt: 0.5 }}
        />
      </Box>
    </Box>
  )

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar position="fixed" sx={{ zIndex: theme.zIndex.drawer + 1 }}>
        <Toolbar>
          {isMobile && (
            <IconButton color="inherit" edge="start" onClick={() => setMobileOpen(v => !v)} sx={{ mr: 2 }}>
              <MenuIcon />
            </IconButton>
          )}
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            ACME Inc. – Team Management
          </Typography>
          <IconButton color="inherit" onClick={e => setAnchorEl(e.currentTarget)}>
            <Avatar sx={{ width: 32, height: 32, bgcolor: 'secondary.main', fontSize: 14 }}>
              {(user?.username || 'U')[0].toUpperCase()}
            </Avatar>
          </IconButton>
          <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
            <MenuItem disabled>
              <Typography variant="caption">{user?.email}</Typography>
            </MenuItem>
            <Divider />
            <MenuItem onClick={() => { setAnchorEl(null); signOut(); navigate('/login') }}>
              <Logout fontSize="small" sx={{ mr: 1 }} /> Logout
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      {/* Desktop drawer */}
      {!isMobile && (
        <Drawer
          variant="permanent"
          sx={{
            width: DRAWER_WIDTH,
            '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' },
          }}
        >
          {drawer}
        </Drawer>
      )}

      {/* Mobile drawer */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': { width: DRAWER_WIDTH },
        }}
      >
        {drawer}
      </Drawer>

      <Box component="main" sx={{
        flexGrow: 1,
        p: 3,
        mt: 8,
        ml: isMobile ? 0 : `${DRAWER_WIDTH}px`,
        bgcolor: 'background.default',
        minHeight: '100vh',
      }}>
        <Outlet />
      </Box>
    </Box>
  )
}
