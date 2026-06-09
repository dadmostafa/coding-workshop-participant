import { Routes, Route, Navigate } from 'react-router-dom'
import { createTheme, ThemeProvider, CssBaseline } from '@mui/material'
import { useAuth } from './context/AuthContext'

import LoginPage        from './pages/LoginPage'
import DashboardPage    from './pages/DashboardPage'
import TeamsPage        from './pages/TeamsPage'
import TeamDetailPage   from './pages/TeamDetailPage'
import MembersPage      from './pages/MembersPage'
import AchievementsPage from './pages/AchievementsPage'
import UsersPage        from './pages/UsersPage'
import Layout           from './components/Layout'

const theme = createTheme({
  palette: {
    primary:   { main: '#1565C0' },
    secondary: { main: '#F57C00' },
    background: { default: '#F4F6F9' },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
  },
  shape: { borderRadius: 10 },
})

function PrivateRoute({ children }) {
  const { token } = useAuth()
  return token ? children : <Navigate to="/login" replace />
}

function AdminRoute({ children }) {
  const { token, isAdmin } = useAuth()
  if (!token) return <Navigate to="/login" replace />
  if (!isAdmin) return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route index                element={<DashboardPage />} />
          <Route path="teams"         element={<TeamsPage />} />
          <Route path="teams/:id"     element={<TeamDetailPage />} />
          <Route path="members"       element={<MembersPage />} />
          <Route path="achievements"  element={<AchievementsPage />} />
          <Route path="users"         element={<AdminRoute><UsersPage /></AdminRoute>} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ThemeProvider>
  )
}
