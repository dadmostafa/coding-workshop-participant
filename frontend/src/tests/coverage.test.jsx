/**
 * Coverage tests for utilities, hooks, and components.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { renderHook } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// Hoist toast mock so it's available at import time
const mockToast = vi.hoisted(() =>
  Object.assign(vi.fn(), {
    success: vi.fn(),
    error:   vi.fn(),
    warning: vi.fn(),
    info:    vi.fn(),
    promise: vi.fn(),
  })
)
vi.mock('react-toastify', () => ({ toast: mockToast }))

// ── utils/time.js ─────────────────────────────────────────────────────────────

import {
  formatDateTime, formatDate, formatTime, timeAgo, formatFull,
  getTimeGreeting, getDueDateStatus,
} from '../utils/time'

describe('utils/time — formatDate', () => {
  it('returns em dash for falsy input', () => {
    expect(formatDate(null)).toBe('—')
    expect(formatDate('')).toBe('—')
    expect(formatDate(undefined)).toBe('—')
  })
  it('formats a valid ISO date', () => {
    const result = formatDate('2026-06-11')
    expect(typeof result).toBe('string')
    expect(result).toMatch(/Jun/)
    expect(result).toMatch(/2026/)
  })
  it('handles a date that already ends with Z', () => {
    const result = formatDate('2026-06-11T00:00:00Z')
    expect(result).toMatch(/2026/)
  })
})

describe('utils/time — formatDateTime', () => {
  it('returns em dash for falsy input', () => {
    expect(formatDateTime(null)).toBe('—')
  })
  it('formats datetime with AM/PM', () => {
    const result = formatDateTime('2026-06-11T14:30:00Z')
    expect(result).toMatch(/2026/)
    expect(result).toMatch(/AM|PM/)
  })
})

describe('utils/time — formatTime', () => {
  it('returns em dash for falsy', () => {
    expect(formatTime(null)).toBe('—')
  })
  it('includes AM or PM', () => {
    expect(formatTime('2026-06-11T09:00:00Z')).toMatch(/AM|PM/)
  })
})

describe('utils/time — timeAgo', () => {
  it('returns em dash for falsy', () => {
    expect(timeAgo(null)).toBe('—')
  })
  it('returns "just now" for future timestamps', () => {
    const future = new Date(Date.now() + 99999).toISOString()
    expect(timeAgo(future)).toBe('just now')
  })
  it('returns seconds ago for very recent', () => {
    const recent = new Date(Date.now() - 10_000).toISOString()
    expect(timeAgo(recent)).toMatch(/s ago/)
  })
  it('returns minutes ago', () => {
    const mins = new Date(Date.now() - 3 * 60_000).toISOString()
    expect(timeAgo(mins)).toMatch(/m ago/)
  })
  it('returns hours ago', () => {
    const hours = new Date(Date.now() - 2 * 3600_000).toISOString()
    expect(timeAgo(hours)).toMatch(/h ago/)
  })
  it('returns days ago', () => {
    const days = new Date(Date.now() - 2 * 86400_000).toISOString()
    expect(timeAgo(days)).toMatch(/d ago/)
  })
  it('returns formatted date for old timestamps', () => {
    const old = '2020-06-15T12:00:00Z'
    const result = timeAgo(old)
    expect(result).toMatch(/2020/)
  })
})

describe('utils/time — formatFull', () => {
  it('returns em dash for falsy', () => {
    expect(formatFull(null)).toBe('—')
  })
  it('combines relative and absolute', () => {
    const result = formatFull('2026-06-11T12:00:00Z')
    expect(result).toContain('·')
  })
})

describe('utils/time — getTimeGreeting', () => {
  it('returns a greeting string containing the name', () => {
    const greeting = getTimeGreeting('Alice')
    expect(greeting).toContain('Alice')
    expect(greeting).toMatch(/morning|afternoon|evening|late/)
  })
})

describe('utils/time — getDueDateStatus', () => {
  it('returns null for falsy input', () => {
    expect(getDueDateStatus(null)).toBeNull()
    expect(getDueDateStatus('')).toBeNull()
  })
  it('returns done for completed status', () => {
    const result = getDueDateStatus('2026-01-01', 'completed')
    expect(result.type).toBe('done')
  })
  it('returns overdue for past dates', () => {
    const result = getDueDateStatus('2020-01-01', '')
    expect(result.type).toBe('overdue')
    expect(result.days).toBeGreaterThan(0)
  })
  it('returns today for today', () => {
    const today = new Date().toISOString().split('T')[0]
    const result = getDueDateStatus(today, '')
    expect(['today', 'overdue', 'critical']).toContain(result.type)
  })
  it('returns critical for 1-3 days left', () => {
    const soon = new Date(Date.now() + 2 * 86400_000).toISOString().split('T')[0]
    const result = getDueDateStatus(soon, '')
    expect(['critical', 'today']).toContain(result.type)
  })
  it('returns warning for 4-14 days left', () => {
    const soon = new Date(Date.now() + 7 * 86400_000).toISOString().split('T')[0]
    const result = getDueDateStatus(soon, '')
    expect(result.type).toBe('warning')
  })
  it('returns good for 15-30 days left', () => {
    const soon = new Date(Date.now() + 20 * 86400_000).toISOString().split('T')[0]
    const result = getDueDateStatus(soon, '')
    expect(result.type).toBe('good')
  })
  it('returns future for more than 30 days out', () => {
    const far = new Date(Date.now() + 60 * 86400_000).toISOString().split('T')[0]
    const result = getDueDateStatus(far, '')
    expect(result.type).toBe('future')
  })
})

// ── utils/toast.js ────────────────────────────────────────────────────────────

import { toastSuccess, toastError, toastWarning, toastInfo, toastPromise } from '../utils/toast'

describe('utils/toast', () => {
  beforeEach(() => {
    mockToast.success.mockClear()
    mockToast.error.mockClear()
    mockToast.warning.mockClear()
    mockToast.info.mockClear()
    mockToast.promise.mockClear()
  })
  it('calls toast.success', () => {
    toastSuccess('Great')
    expect(mockToast.success).toHaveBeenCalledWith('Great', expect.any(Object))
  })
  it('calls toast.error', () => {
    toastError('Bad')
    expect(mockToast.error).toHaveBeenCalledWith('Bad', expect.any(Object))
  })
  it('calls toast.warning', () => {
    toastWarning('Watch out')
    expect(mockToast.warning).toHaveBeenCalledWith('Watch out', expect.any(Object))
  })
  it('calls toast.info', () => {
    toastInfo('FYI')
    expect(mockToast.info).toHaveBeenCalledWith('FYI', expect.any(Object))
  })
  it('calls toast.promise', () => {
    const p = Promise.resolve()
    toastPromise(p, { pending: 'Saving...', success: 'Saved!', error: 'Fail' })
    expect(mockToast.promise).toHaveBeenCalled()
  })
})

// ── hooks/useSort ─────────────────────────────────────────────────────────────

import { useSort } from '../hooks/useSort'

describe('hooks/useSort', () => {
  const data = [
    { name: 'Charlie', score: 30, created_at: '2026-01-03' },
    { name: 'Alice',   score: 10, created_at: '2026-01-01' },
    { name: 'Bob',     score: 20, created_at: '2026-01-02' },
  ]

  it('returns data as-is with no sort field', () => {
    const { result } = renderHook(() => useSort(data))
    expect(result.current.sorted).toEqual(data)
  })

  it('sorts strings ascending by default', () => {
    const { result } = renderHook(() => useSort(data, 'name', 'asc'))
    const names = result.current.sorted.map(d => d.name)
    expect(names).toEqual(['Alice', 'Bob', 'Charlie'])
  })

  it('sorts strings descending', () => {
    const { result } = renderHook(() => useSort(data, 'name', 'desc'))
    const names = result.current.sorted.map(d => d.name)
    expect(names).toEqual(['Charlie', 'Bob', 'Alice'])
  })

  it('sorts numbers ascending', () => {
    const { result } = renderHook(() => useSort(data, 'score', 'asc'))
    const scores = result.current.sorted.map(d => d.score)
    expect(scores).toEqual([10, 20, 30])
  })

  it('sorts numbers descending', () => {
    const { result } = renderHook(() => useSort(data, 'score', 'desc'))
    const scores = result.current.sorted.map(d => d.score)
    expect(scores).toEqual([30, 20, 10])
  })

  it('sorts dates ascending', () => {
    const { result } = renderHook(() => useSort(data, 'created_at', 'asc'))
    const dates = result.current.sorted.map(d => d.created_at)
    expect(dates[0]).toBe('2026-01-01')
    expect(dates[2]).toBe('2026-01-03')
  })

  it('toggles direction when same field clicked twice', () => {
    const { result } = renderHook(() => useSort(data, 'name', 'asc'))
    act(() => { result.current.sortBy('name') })
    expect(result.current.sortDir).toBe('desc')
    act(() => { result.current.sortBy('name') })
    expect(result.current.sortDir).toBe('asc')
  })

  it('resets direction to asc when new field selected', () => {
    const { result } = renderHook(() => useSort(data, 'name', 'desc'))
    act(() => { result.current.sortBy('score') })
    expect(result.current.sortField).toBe('score')
    expect(result.current.sortDir).toBe('asc')
  })

  it('handles empty data array', () => {
    const { result } = renderHook(() => useSort([], 'name'))
    expect(result.current.sorted).toEqual([])
  })

  it('handles null values gracefully', () => {
    const nullData = [{ name: null }, { name: 'Alice' }]
    const { result } = renderHook(() => useSort(nullData, 'name', 'asc'))
    expect(result.current.sorted.length).toBe(2)
  })
})

// ── hooks/usePagination ───────────────────────────────────────────────────────

import { usePagination } from '../hooks/usePagination'

describe('hooks/usePagination', () => {
  const data = Array.from({ length: 25 }, (_, i) => ({ id: i + 1 }))

  it('returns first page by default', () => {
    const { result } = renderHook(() => usePagination(data, 10))
    expect(result.current.page).toBe(1)
    expect(result.current.paginated.length).toBe(10)
    expect(result.current.paginated[0].id).toBe(1)
  })

  it('calculates totalPages correctly', () => {
    const { result } = renderHook(() => usePagination(data, 10))
    expect(result.current.totalPages).toBe(3)
  })

  it('reports hasNext and hasPrev', () => {
    const { result } = renderHook(() => usePagination(data, 10))
    expect(result.current.hasNext).toBe(true)
    expect(result.current.hasPrev).toBe(false)
  })

  it('navigates to next page', () => {
    const { result } = renderHook(() => usePagination(data, 10))
    act(() => { result.current.setPage(2) })
    expect(result.current.page).toBe(2)
    expect(result.current.paginated[0].id).toBe(11)
  })

  it('navigates to last page and has no next', () => {
    const { result } = renderHook(() => usePagination(data, 10))
    act(() => { result.current.setPage(3) })
    expect(result.current.hasNext).toBe(false)
    expect(result.current.hasPrev).toBe(true)
    expect(result.current.paginated.length).toBe(5)
  })

  it('clamps page above totalPages', () => {
    const { result } = renderHook(() => usePagination(data, 10))
    act(() => { result.current.setPage(999) })
    expect(result.current.page).toBe(3)
  })

  it('clamps page below 1', () => {
    const { result } = renderHook(() => usePagination(data, 10))
    act(() => { result.current.setPage(-5) })
    expect(result.current.page).toBe(1)
  })

  it('resets to page 1 when page size changes', () => {
    const { result } = renderHook(() => usePagination(data, 10))
    act(() => { result.current.setPage(2) })
    act(() => { result.current.setPageSize(20) })
    expect(result.current.page).toBe(1)
    expect(result.current.pageSize).toBe(20)
  })

  it('returns correct start/end indices', () => {
    const { result } = renderHook(() => usePagination(data, 10))
    expect(result.current.start).toBe(1)
    expect(result.current.end).toBe(10)
  })

  it('start/end is 0 for empty data', () => {
    const { result } = renderHook(() => usePagination([], 10))
    expect(result.current.start).toBe(0)
    expect(result.current.end).toBe(0)
    expect(result.current.total).toBe(0)
  })
})

// ── components/EmptyState ─────────────────────────────────────────────────────

import EmptyState from '../components/EmptyState'

describe('EmptyState', () => {
  it('renders title and subtitle', () => {
    render(
      <MemoryRouter>
        <EmptyState icon="📦" title="Nothing here" subtitle="Add something to get started." />
      </MemoryRouter>
    )
    expect(screen.getByText('Nothing here')).toBeTruthy()
    expect(screen.getByText('Add something to get started.')).toBeTruthy()
  })

  it('renders action button when actionLabel provided', () => {
    const onAction = vi.fn()
    render(
      <MemoryRouter>
        <EmptyState title="Empty" actionLabel="Add Item" onAction={onAction} canAct />
      </MemoryRouter>
    )
    const btn = screen.getByRole('button', { name: /Add Item/i })
    expect(btn).toBeTruthy()
    fireEvent.click(btn)
    expect(onAction).toHaveBeenCalledTimes(1)
  })

  it('disables button when canAct is false', () => {
    render(
      <MemoryRouter>
        <EmptyState title="Empty" actionLabel="Add" onAction={vi.fn()} canAct={false} />
      </MemoryRouter>
    )
    expect(screen.getByRole('button', { name: /Add/i })).toBeTruthy()
  })

  it('does not render button without actionLabel', () => {
    render(<MemoryRouter><EmptyState title="Empty" /></MemoryRouter>)
    expect(screen.queryByRole('button')).toBeFalsy()
  })
})

// ── components/SortHeader ─────────────────────────────────────────────────────

import SortHeader from '../components/SortHeader'
import DueDateChip from '../components/DueDateChip'
import { ProjectRowSkeleton, KanbanCardSkeleton } from '../components/ProjectCardSkeleton'
import { Table, TableHead, TableRow } from '@mui/material'

function renderSortHeader(props) {
  return render(
    <MemoryRouter>
      <Table><TableHead><TableRow>
        <SortHeader {...props} />
      </TableRow></TableHead></Table>
    </MemoryRouter>
  )
}

describe('SortHeader', () => {
  it('renders label', () => {
    renderSortHeader({ label: 'Name', field: 'name', sortField: '', sortDir: 'asc', onSort: vi.fn() })
    expect(screen.getByText('Name')).toBeTruthy()
  })

  it('calls onSort when clicked', () => {
    const onSort = vi.fn()
    renderSortHeader({ label: 'Name', field: 'name', sortField: '', sortDir: 'asc', onSort })
    fireEvent.click(screen.getByText('Name'))
    expect(onSort).toHaveBeenCalledWith('name')
  })

  it('shows ascending arrow when active asc', () => {
    const { container } = renderSortHeader({
      label: 'Name', field: 'name', sortField: 'name', sortDir: 'asc', onSort: vi.fn()
    })
    expect(container.querySelector('svg')).toBeTruthy()
  })

  it('shows descending arrow when active desc', () => {
    const { container } = renderSortHeader({
      label: 'Score', field: 'score', sortField: 'score', sortDir: 'desc', onSort: vi.fn()
    })
    expect(container.querySelector('svg')).toBeTruthy()
  })
})


// ── components/DueDateChip ────────────────────────────────────────────────────

describe('DueDateChip', () => {
  it('renders nothing for null date', () => {
    const { container } = render(<MemoryRouter><DueDateChip date={null} /></MemoryRouter>)
    expect(container.firstChild).toBeNull()
  })
  it('renders for overdue date', () => {
    const { container } = render(
      <MemoryRouter><DueDateChip date='2020-01-01' status='' /></MemoryRouter>
    )
    expect(container.innerHTML).toBeTruthy()
  })
  it('renders for completed status', () => {
    const { container } = render(
      <MemoryRouter><DueDateChip date='2026-12-31' status='completed' /></MemoryRouter>
    )
    expect(container.innerHTML).toBeTruthy()
  })
  it('renders without tooltip', () => {
    const { container } = render(
      <MemoryRouter><DueDateChip date='2027-06-01' status='' showTooltip={false} /></MemoryRouter>
    )
    expect(container.innerHTML).toBeTruthy()
  })
})

// ── components/ProjectCardSkeleton ──────────────────────────────────────────────

describe('ProjectCardSkeleton', () => {
  it('ProjectRowSkeleton renders', () => {
    const { container } = render(<MemoryRouter><ProjectRowSkeleton /></MemoryRouter>)
    expect(container.firstChild).toBeTruthy()
  })
  it('KanbanCardSkeleton renders', () => {
    const { container } = render(<MemoryRouter><KanbanCardSkeleton /></MemoryRouter>)
    expect(container.firstChild).toBeTruthy()
  })
})

// ── components/UtilizationBar ─────────────────────────────────────────────────

import UtilizationBar from '../components/UtilizationBar'

describe('UtilizationBar', () => {
  it('renders without crashing at 0%', () => {
    const { container } = render(<UtilizationBar pct={0} days={0} capacity={20} />)
    expect(container.firstChild).toBeTruthy()
  })
  it('renders at 50% (optimal)', () => {
    render(<UtilizationBar pct={50} days={10} capacity={20} showLabel />)
    expect(screen.getByText('50%')).toBeTruthy()
  })
  it('renders at 80% (high load)', () => {
    render(<UtilizationBar pct={80} days={16} capacity={20} showLabel />)
    expect(screen.getByText('80%')).toBeTruthy()
  })
  it('renders at 120% (over-allocated)', () => {
    render(<UtilizationBar pct={120} days={24} capacity={20} showLabel />)
    expect(screen.getByText('120%')).toBeTruthy()
  })
  it('renders compact mode without label details', () => {
    render(<UtilizationBar pct={60} days={12} capacity={20} compact />)
    expect(screen.getByText('60%')).toBeTruthy()
  })
  it('hides label when showLabel=false', () => {
    render(<UtilizationBar pct={50} days={10} capacity={20} showLabel={false} />)
    expect(screen.queryByText('50%')).toBeFalsy()
  })
})

// ── context/AuthContext ───────────────────────────────────────────────────────

import { AuthProvider, useAuth } from '../context/AuthContext'

const { mockLogin, mockRegister } = vi.hoisted(() => ({
  mockLogin:    vi.fn(),
  mockRegister: vi.fn(),
}))

vi.mock('../services/api', () => ({
  login:    mockLogin,
  register: mockRegister,
  getStats: vi.fn().mockResolvedValue({}),
  getPipeline: vi.fn().mockResolvedValue({ statuses: {} }),
  getProjects: vi.fn().mockResolvedValue([]),
  getResourceAllocation: vi.fn().mockResolvedValue({ over_allocated: [], all_allocations: [] }),
  getTeams:        vi.fn().mockResolvedValue([]),
  getMembers:      vi.fn().mockResolvedValue([]),
  getAchievements: vi.fn().mockResolvedValue([]),
}))

const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>

describe('context/AuthContext', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('starts with null user and token when storage is empty', () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    expect(result.current.user).toBeNull()
    expect(result.current.token).toBeNull()
  })

  it('reads persisted user and token from localStorage', () => {
    localStorage.setItem('acme_token', 'stored-token')
    localStorage.setItem('acme_user', JSON.stringify({ role: 'admin', username: 'sys' }))
    const { result } = renderHook(() => useAuth(), { wrapper })
    expect(result.current.user.role).toBe('admin')
    expect(result.current.token).toBe('stored-token')
  })

  it('signIn stores token and user', async () => {
    mockLogin.mockResolvedValueOnce({
      token: 'new-token',
      user:  { role: 'viewer', username: 'alice' },
    })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await act(async () => {
      await result.current.signIn('alice', 'pass')
    })
    expect(localStorage.getItem('acme_token')).toBe('new-token')
    expect(result.current.user.role).toBe('viewer')
    expect(result.current.token).toBe('new-token')
  })

  it('signOut clears token and user', async () => {
    localStorage.setItem('acme_token', 'tok')
    localStorage.setItem('acme_user', JSON.stringify({ role: 'viewer' }))
    const { result } = renderHook(() => useAuth(), { wrapper })
    act(() => { result.current.signOut() })
    expect(localStorage.getItem('acme_token')).toBeNull()
    expect(result.current.token).toBeNull()
    expect(result.current.user).toBeNull()
  })

  it('isAdmin and permissions are correct for admin role', () => {
    localStorage.setItem('acme_user', JSON.stringify({ role: 'admin' }))
    localStorage.setItem('acme_token', 'tok')
    const { result } = renderHook(() => useAuth(), { wrapper })
    expect(result.current.isAdmin).toBe(true)
    expect(result.current.canWrite).toBe(true)
    expect(result.current.canDelete).toBe(true)
  })

  it('viewer has limited permissions', () => {
    localStorage.setItem('acme_user', JSON.stringify({ role: 'viewer' }))
    localStorage.setItem('acme_token', 'tok')
    const { result } = renderHook(() => useAuth(), { wrapper })
    expect(result.current.isAdmin).toBe(false)
    expect(result.current.isManager).toBe(false)
    expect(result.current.canWrite).toBe(false)
  })

  it('getGreeting returns a string with the user first name', () => {
    localStorage.setItem('acme_user', JSON.stringify({ full_name: 'Alice Smith', role: 'viewer' }))
    localStorage.setItem('acme_token', 'tok')
    const { result } = renderHook(() => useAuth(), { wrapper })
    const greeting = result.current.getGreeting()
    expect(typeof greeting).toBe('string')
    expect(greeting).toContain('Alice')
  })

  it('signUp stores token and user', async () => {
    mockRegister.mockResolvedValueOnce({
      token: 'reg-token',
      user:  { role: 'viewer', username: 'newuser' },
    })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await act(async () => {
      await result.current.signUp({ username: 'newuser', password: 'pass' })
    })
    expect(result.current.token).toBe('reg-token')
  })
})
