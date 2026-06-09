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
import ActivityPage     from './pages/ActivityPage'
import AuditPage        from './pages/AuditPage'
import Layout           from './components/Layout'

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary:    { main: '#6BCB77' },
    secondary:  { main: '#FFD166' },
    background: { default: '#13141a', paper: '#1e2029' },
    text:       { primary: '#e8eaf0', secondary: '#8b8fa8' },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", sans-serif',
    h5: { fontWeight: 700 },
    h6: { fontWeight: 600 },
  },
  shape: { borderRadius: 12 },
  components: {
    MuiPaper:  { styleOverrides: { root: { backgroundImage: 'none', backgroundColor: '#1e2029' } } },
    MuiCard:   { styleOverrides: { root: { backgroundImage: 'none', backgroundColor: '#1e2029', border: '1px solid #2a2d3e' } } },
    MuiTableContainer: { styleOverrides: { root: { backgroundColor: '#1e2029' } } },
    MuiTableHead: { styleOverrides: { root: { '& .MuiTableCell-head': { backgroundColor: '#16171f', color: '#8b8fa8', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' } } } },
    MuiTableRow:  { styleOverrides: { root: { '&:hover': { backgroundColor: '#252736' }, '& .MuiTableCell-root': { borderColor: '#2a2d3e' } } } },
    MuiButton: { styleOverrides: { contained: { borderRadius: 8, textTransform: 'none', fontWeight: 600 }, outlined: { borderRadius: 8, textTransform: 'none' }, text: { textTransform: 'none' } } },
    MuiChip: { styleOverrides: { root: { borderRadius: 6 } } },
    MuiTextField: { styleOverrides: { root: { '& .MuiOutlinedInput-root': { backgroundColor: '#13141a', '& fieldset': { borderColor: '#2a2d3e' }, '&:hover fieldset': { borderColor: '#6BCB77' } } } } },
    MuiDialog: { styleOverrides: { paper: { backgroundColor: '#1e2029', border: '1px solid #2a2d3e' } } },
  }
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
          <Route path="activity"      element={<ActivityPage />} />
          <Route path="audit"         element={<AdminRoute><AuditPage /></AdminRoute>} />
          <Route path="users"         element={<AdminRoute><UsersPage /></AdminRoute>} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ThemeProvider>
  )
}
