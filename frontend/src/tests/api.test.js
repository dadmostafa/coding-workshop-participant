import { beforeEach, describe, expect, it, vi } from 'vitest'

const getMock = vi.fn()
const postMock = vi.fn()
const putMock = vi.fn()
const deleteMock = vi.fn()
const requestUseMock = vi.fn()
const responseUseMock = vi.fn()

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      get: getMock,
      post: postMock,
      put: putMock,
      delete: deleteMock,
      interceptors: {
        request: { use: requestUseMock },
        response: { use: responseUseMock },
      },
    })),
  },
}))

describe('api service functions', () => {
  beforeEach(() => {
    getMock.mockReset()
    postMock.mockReset()
    putMock.mockReset()
    deleteMock.mockReset()
  })

  it('calls login endpoint and returns payload', async () => {
    postMock.mockResolvedValueOnce({ data: { token: 'abc' } })

    const { login } = await import('../services/api')
    const result = await login('admin', 'admin123')

    expect(postMock).toHaveBeenCalledWith('/auth/login', {
      username: 'admin',
      password: 'admin123',
    })
    expect(result).toEqual({ token: 'abc' })
  })

  it('calls teams endpoint with query params', async () => {
    postMock.mockResolvedValue({ data: {} })
    getMock.mockResolvedValueOnce({ data: [{ id: 't1' }] })

    const { getTeams } = await import('../services/api')
    const result = await getTeams({ search: 'acme' })

    expect(getMock).toHaveBeenCalledWith('/teams', { params: { search: 'acme' } })
    expect(result).toEqual([{ id: 't1' }])
  })

  it('calls createProject endpoint', async () => {
    const payload = { name: 'Test Project' }
    postMock.mockResolvedValueOnce({ data: { id: 'p1', ...payload } })

    const { createProject } = await import('../services/api')
    const result = await createProject(payload)

    expect(postMock).toHaveBeenCalledWith('/projects', payload)
    expect(result).toEqual({ id: 'p1', name: 'Test Project' })
  })
})
