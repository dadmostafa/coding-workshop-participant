import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// ── Setup Mocks ──────────────────────────────────────────────────────────────

const { signIn: mockSignIn, getStats: mockGetStats } = vi.hoisted(() => ({
  signIn: vi.fn(),
  getStats: vi.fn(),
}))

vi.mock('../services/api', () => ({
  login: vi.fn().mockResolvedValue({
    token: 'test-token',
    user:  { username: 'admin', role: 'admin', full_name: 'Admin' },
  }),
  register: vi.fn().mockResolvedValue({
    token: 'test-token',
    user:  { username: 'newuser', role: 'viewer', full_name: 'New User' },
  }),
  getStats: mockGetStats.mockResolvedValue({
    active_projects:    5,
    at_risk_projects:   1,
    overdue_projects:   1,
    over_budget_count:  0,
    over_allocated:     3,
    total_projects:     10,
    total_teams:        6,
    total_members:      74,
    total_achievements: 54,
    total_budget:       4425000,
    spent_budget:       3016180,
  }),
  getPipeline: vi.fn().mockResolvedValue({
    total: 10, overdue: 1,
    statuses: {
      in_progress: { count: 5, projects: [] },
      review:      { count: 2, projects: [] },
      completed:   { count: 1, projects: [] },
      backlog:     { count: 2, projects: [] },
      planning:    { count: 0, projects: [] },
      on_hold:     { count: 0, projects: [] },
      cancelled:   { count: 0, projects: [] },
    }
  }),
  getProjects: vi.fn().mockResolvedValue([]),
  getResourceAllocation: vi.fn().mockResolvedValue({
    over_allocated:       [],
    over_allocated_count: 0,
    total_allocated:      0,
    all_allocations:      [],
  }),
  getTeams:        vi.fn().mockResolvedValue([]),
  getMembers:      vi.fn().mockResolvedValue([]),
  getAchievements: vi.fn().mockResolvedValue([]),
}))

vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn().mockReturnValue({
    user: {
      username:  'admin',
      role:      'admin',
      full_name: 'Admin User',
      title:     'Administrator',
      department:'Technology',
    },
    token:      'fake-token',
    signIn:     mockSignIn,
    signUp:     vi.fn(),
    signOut:    vi.fn(),
    isAdmin:    true,
    isManager:  true,
    canWrite:   true,
    canDelete:  true,
    getGreeting: vi.fn().mockReturnValue('Good morning, Admin ☀️'),
  }),
  AuthProvider: ({ children }) => children,
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  }
})

// ── Helpers ───────────────────────────────────────────────────────────────────

const theme = {
  palette:    { mode: 'dark' },
  typography: { fontFamily: 'sans-serif' },
  shape:      { borderRadius: 8 },
  components: {},
}

function renderWithRouter(ui) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

// ── ConfirmDialog tests ───────────────────────────────────────────────────────

import ConfirmDialog from '../components/ConfirmDialog'

describe('ConfirmDialog', () => {
  it('renders when open=true', () => {
    renderWithRouter(
      <ConfirmDialog open={true} title="Delete?" message="Are you sure?"
        onConfirm={vi.fn()} onCancel={vi.fn()} />
    )
    expect(screen.getByText('Delete?')).toBeTruthy()
    expect(screen.getByText('Are you sure?')).toBeTruthy()
  })

  it('does not render when open=false', () => {
    renderWithRouter(
      <ConfirmDialog open={false} title="Delete?" message="Are you sure?"
        onConfirm={vi.fn()} onCancel={vi.fn()} />
    )
    expect(screen.queryByText('Delete?')).toBeFalsy()
  })

  it('calls onConfirm when Confirm clicked', async () => {
    const onConfirm = vi.fn()
    renderWithRouter(
      <ConfirmDialog open={true} title="Delete?" message="Are you sure?"
        onConfirm={onConfirm} onCancel={vi.fn()} />
    )
    fireEvent.click(screen.getByText('Confirm'))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('calls onCancel when Cancel clicked', async () => {
    const onCancel = vi.fn()
    renderWithRouter(
      <ConfirmDialog open={true} title="Delete?" message="Are you sure?"
        onConfirm={vi.fn()} onCancel={onCancel} />
    )
    fireEvent.click(screen.getByText('Cancel'))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})

// ── LoginPage tests ───────────────────────────────────────────────────────────

import LoginPage from '../pages/LoginPage'

describe('LoginPage', () => {
  beforeEach(() => { 
    vi.clearAllMocks()
    mockSignIn.mockClear()
  })

  it('renders username and password fields', () => {
    renderWithRouter(<LoginPage />)
    expect(screen.getByLabelText(/username/i)).toBeTruthy()
    expect(screen.getByLabelText(/^password$/i)).toBeTruthy()
  })

  it('shows validation errors when submitted empty', async () => {
    renderWithRouter(<LoginPage />)
    // Click the Sign In button specifically inside the form (role=button)
    const buttons = screen.getAllByRole('button', { name: /sign in/i })
    fireEvent.click(buttons[buttons.length - 1])
    await waitFor(() => {
      expect(screen.getByText(/username is required/i)).toBeTruthy()
    })
  })

  it('calls login API with credentials', async () => {
    mockSignIn.mockResolvedValueOnce({ username: 'admin', role: 'admin', full_name: 'Admin' })
    renderWithRouter(<LoginPage />)
    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'admin' } })
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'admin123' } })
    const buttons = screen.getAllByRole('button', { name: /sign in/i })
    fireEvent.click(buttons[buttons.length - 1])
    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith('admin', 'admin123')
    })
  })

  it('shows API error on failed login', async () => {
    mockSignIn.mockRejectedValueOnce({
      response: { data: { error: 'Invalid credentials' } }
    })
    renderWithRouter(<LoginPage />)
    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'admin' } })
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'wrong' } })
    const buttons = screen.getAllByRole('button', { name: /sign in/i })
    fireEvent.click(buttons[buttons.length - 1])
    await waitFor(() => {
      expect(screen.getByText(/invalid credentials/i)).toBeTruthy()
    })
  })

  it('shows demo accounts section', () => {
    renderWithRouter(<LoginPage />)
    // Our new login page shows role chips not text
    expect(screen.getByText(/Admin/i)).toBeTruthy()
    expect(screen.getByText(/Viewer/i)).toBeTruthy()
  })

  it('fills form when demo credential chip clicked', async () => {
    renderWithRouter(<LoginPage />)
    // Click the Admin demo chip
    const adminChip = screen.getByText('Admin')
    fireEvent.click(adminChip)
    await waitFor(() => {
      expect(screen.getByLabelText(/username/i).value).toBe('admin')
    })
  })
})

// ── DashboardPage tests ───────────────────────────────────────────────────────

import DashboardPage from '../pages/DashboardPage'

describe('DashboardPage', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('renders stat cards after loading', async () => {
    renderWithRouter(<DashboardPage />)
    await waitFor(() => {
      // Check for key stat labels - use getAllByText to get multiple matches
      const activeProjectsElements = screen.getAllByText(/active projects/i)
      expect(activeProjectsElements.length).toBeGreaterThan(0)
    })
  })

  it('shows error if stats fail', async () => {
    mockGetStats.mockRejectedValueOnce(new Error('Network error'))
    renderWithRouter(<DashboardPage />)
    await waitFor(() => {
      expect(screen.getByText(/could not load/i)).toBeTruthy()
    })
  })
})
