import { Routes, Route, Navigate } from 'react-router-dom'
import { createTheme, ThemeProvider, CssBaseline } from '@mui/material'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
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
import ProjectsPage     from './pages/ProjectsPage'
import ProjectDetailPage from './pages/ProjectDetailPage'
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
    h4: { fontWeight: 800, letterSpacing: '-0.02em' },
    h5: { fontWeight: 700, letterSpacing: '-0.01em' },
    h6: { fontWeight: 600 },
  },
  shape: { borderRadius: 16 },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: '#1e2029',
          transition: 'box-shadow 0.2s ease, transform 0.2s ease',
        }
      }
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: '#1e2029',
          border: '1px solid #2a2d3e',
          borderRadius: 16,
          transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          }
        }
      }
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          textTransform: 'none',
          fontWeight: 600,
          transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
          '&:hover': { transform: 'translateY(-1px)' },
          '&:active': { transform: 'translateY(0px) scale(0.98)' },
        },
        contained: { boxShadow: 'none', '&:hover': { boxShadow: '0 4px 16px rgba(107,203,119,0.3)' } },
      }
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontWeight: 600,
          transition: 'all 0.15s ease',
        }
      }
    },
    MuiTextField: {
      defaultProps: {
        InputLabelProps: { shrink: true },
      },
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 12,
            backgroundColor: '#13141a',
            transition: 'all 0.2s ease',
            '& fieldset': { borderColor: '#2a2d3e', transition: 'border-color 0.2s ease' },
            '&:hover fieldset': { borderColor: '#6BCB77' },
            '&.Mui-focused fieldset': { borderColor: '#6BCB77', borderWidth: 2 },
          }
        }
      }
    },
    MuiTableContainer: {
      styleOverrides: { root: { backgroundColor: '#1e2029', borderRadius: 16 } }
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-head': {
            backgroundColor: '#16171f',
            color: '#8b8fa8',
            fontWeight: 700,
            fontSize: '0.7rem',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }
        }
      }
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          transition: 'background-color 0.15s ease',
          '&:hover': { backgroundColor: '#252736' },
          '& .MuiTableCell-root': { borderColor: '#2a2d3e' },
        }
      }
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: '#1e2029',
          border: '1px solid #2a2d3e',
          borderRadius: 20,
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
        }
      }
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
          '&:hover': { transform: 'scale(1.1)' },
          '&:active': { transform: 'scale(0.95)' },
        }
      }
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: '#2a2d3e',
          borderRadius: 8,
          fontSize: '0.75rem',
          fontWeight: 500,
        }
      }
    },
  }
})

function PrivateRoute({ children }) {
  const { token } = useAuth()
  return token ? children : <Navigate to="/login" replace />
}

function AdminRoute({ children }) {
  const { token, isAdmin } = useAuth()
  if (!token)   return <Navigate to="/login" replace />
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
          <Route path="projects"      element={<ProjectsPage />} />
          <Route path="projects/:id"  element={<ProjectDetailPage />} />
          <Route path="activity"      element={<ActivityPage />} />
          <Route path="users"         element={<AdminRoute><UsersPage /></AdminRoute>} />
          <Route path="audit"         element={<AdminRoute><AuditPage /></AdminRoute>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ToastContainer
        position="bottom-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        pauseOnHover
        draggable
        theme="dark"
        toastStyle={{
          backgroundColor: '#1e2029',
          border: '1px solid #2a2d3e',
          borderRadius: '10px',
          color: '#e8eaf0',
          fontSize: '0.85rem',
        }}
      />
    </ThemeProvider>
  )
}
