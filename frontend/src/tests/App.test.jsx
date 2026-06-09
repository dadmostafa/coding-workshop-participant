/**
 * Frontend component tests
 * Run: npm test
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '../context/AuthContext'

// ── Test helpers ──────────────────────────────────────────────────────────────

function withProviders(ui, route = '/') {
  return (
    <MemoryRouter initialEntries={[route]}>
      <AuthProvider>{ui}</AuthProvider>
    </MemoryRouter>
  )
}

// ── ConfirmDialog tests ───────────────────────────────────────────────────────

import ConfirmDialog from '../components/ConfirmDialog'

describe('ConfirmDialog', () => {
  it('renders when open=true', () => {
    render(
      <ConfirmDialog
        open
        title="Delete item"
        message="Are you sure?"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    )
    expect(screen.getByText('Delete item')).toBeInTheDocument()
    expect(screen.getByText('Are you sure?')).toBeInTheDocument()
  })

  it('does not render when open=false', () => {
    render(
      <ConfirmDialog
        open={false}
        title="Hidden"
        message="Should not appear"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    )
    expect(screen.queryByText('Hidden')).not.toBeInTheDocument()
  })

  it('calls onConfirm when Confirm clicked', () => {
    const onConfirm = vi.fn()
    render(
      <ConfirmDialog
        open
        title="Test"
        message="msg"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    )
    fireEvent.click(screen.getByText('Confirm'))
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('calls onCancel when Cancel clicked', () => {
    const onCancel = vi.fn()
    render(
      <ConfirmDialog
        open
        title="Test"
        message="msg"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    )
    fireEvent.click(screen.getByText('Cancel'))
    expect(onCancel).toHaveBeenCalledOnce()
  })
})

// ── Login page tests ──────────────────────────────────────────────────────────

import LoginPage from '../pages/LoginPage'

vi.mock('../services/api', () => ({
  login: vi.fn(),
  seedUsers: vi.fn(),
  getTeams: vi.fn(() => Promise.resolve([])),
  getMembers: vi.fn(() => Promise.resolve([])),
  getAchievements: vi.fn(() => Promise.resolve([])),
  getStats: vi.fn(() => Promise.resolve({
    total_teams: 0, total_members: 0, total_achievements: 0,
    leader_not_colocated: 0, leader_non_direct: 0,
    high_nondirect_ratio: 0, has_org_leader: 0,
  })),
}))

import { login as mockLogin } from '../services/api'

describe('LoginPage', () => {
  it('renders username and password fields', () => {
    render(withProviders(<LoginPage />))
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
  })

  it('shows validation errors when submitted empty', async () => {
    render(withProviders(<LoginPage />))
    fireEvent.click(screen.getByText('Sign In'))
    await waitFor(() => {
      expect(screen.getByText('Username is required')).toBeInTheDocument()
      expect(screen.getByText('Password is required')).toBeInTheDocument()
    })
  })

  it('calls login API with credentials', async () => {
    mockLogin.mockResolvedValueOnce({
      token: 'tok',
      user: { id: '1', username: 'admin', role: 'admin', full_name: 'Admin' }
    })
    render(withProviders(<LoginPage />))
    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'admin' } })
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'admin123' } })
    fireEvent.click(screen.getByText('Sign In'))
    await waitFor(() => expect(mockLogin).toHaveBeenCalledWith('admin', 'admin123'))
  })

  it('shows API error on failed login', async () => {
    mockLogin.mockRejectedValueOnce({
      response: { data: { error: 'Invalid credentials' } }
    })
    render(withProviders(<LoginPage />))
    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'bad' } })
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'bad' } })
    fireEvent.click(screen.getByText('Sign In'))
    await waitFor(() => expect(screen.getByText('Invalid credentials')).toBeInTheDocument())
  })

  it('shows demo credentials section', () => {
    render(withProviders(<LoginPage />))
    expect(screen.getByText(/demo credentials/i)).toBeInTheDocument()
  })

  it('fills form when demo credential is clicked', () => {
    render(withProviders(<LoginPage />))
    fireEvent.click(screen.getByText(/admin: admin \/ admin123/i))
    expect(screen.getByLabelText(/username/i)).toHaveValue('admin')
  })
})

// ── DashboardPage tests ───────────────────────────────────────────────────────

import DashboardPage from '../pages/DashboardPage'
import { getStats } from '../services/api'

describe('DashboardPage', () => {
  it('renders stat cards after loading', async () => {
    render(withProviders(<DashboardPage />))
    await waitFor(() => {
      expect(screen.getByText('Total Teams')).toBeInTheDocument()
      expect(screen.getByText('Total Members')).toBeInTheDocument()
      expect(screen.getByText('Achievements')).toBeInTheDocument()
    })
  })

  it('shows error if stats fail', async () => {
    getStats.mockRejectedValueOnce(new Error('network'))
    render(withProviders(<DashboardPage />))
    await waitFor(() => expect(screen.getByText(/could not load/i)).toBeInTheDocument())
  })
})
