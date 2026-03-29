import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { api } from '../assets/api.js'

describe('api.js HTTP Wrapper', () => {
    
    beforeEach(() => {
        global.fetch = vi.fn()
        vi.stubGlobal('localStorage', {
            getItem: vi.fn(),
            setItem: vi.fn(),
            removeItem: vi.fn()
        })
        
        // Mock window.location
        delete window.location
        window.location = { href: '/' }
    })
    
    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('performs a basic GET request successfully', async () => {
        const mockData = { status: 'ok' }
        global.fetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => mockData
        })
        
        const result = await api.getStatus()
        
        expect(global.fetch).toHaveBeenCalledWith('/api/admin/status', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        })
        expect(result).toEqual(mockData)
    })

    it('adds authentication token to headers if required', async () => {
        vi.mocked(localStorage.getItem).mockReturnValue('fake-token')
        
        global.fetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({ logs: [] })
        })
        
        await api.getLogs()
        
        expect(localStorage.getItem).toHaveBeenCalledWith('token')
        expect(global.fetch).toHaveBeenCalledWith('/api/admin/logs?limit=50', {
            method: 'GET',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': 'Bearer fake-token' 
            }
        })
    })

    it('handles 401 Unauthorized by clearing token and redirecting', async () => {
        global.fetch.mockResolvedValueOnce({
            ok: false,
            status: 401,
            json: async () => ({})
        })
        
        await expect(api.getSettings()).rejects.toThrow('Unauthorized')
        
        expect(localStorage.removeItem).toHaveBeenCalledWith('token')
        expect(window.location.href).toBe('/login')
    })
    
    it('throws custom error message on 400 Bad Request', async () => {
        global.fetch.mockResolvedValueOnce({
            ok: false,
            status: 400,
            json: async () => ({ detail: 'Invalid data provided' })
        })
        
        await expect(api.runSetup({})).rejects.toThrow('Invalid data provided')
    })

    it('passes standard JSON body in POST requests', async () => {
        global.fetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({ token: '123' })
        })
        
        await api.login('admin', 'password')
        
        expect(global.fetch).toHaveBeenCalledWith('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'admin', password: 'password' })
        })
    })
})
