import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import Login from '../assets/views/Login.js'
import { api } from '../assets/api.js'

// Mock the API and global storage
vi.mock('../assets/api.js', () => ({
    api: {
        login: vi.fn()
    }
}))

describe('Login Component', () => {
    let mockRouter;

    beforeEach(() => {
        vi.clearAllMocks()
        vi.stubGlobal('localStorage', {
            setItem: vi.fn()
        })
        mockRouter = {
            push: vi.fn()
        }
    })

    const createWrapper = () => {
        return mount(Login, {
            global: {
                mocks: {
                    $router: mockRouter
                }
            }
        })
    }

    it('renders the login form', () => {
        const wrapper = createWrapper()
        expect(wrapper.text()).toContain('Paper Llama Login')
        expect(wrapper.find('input[type="password"]').exists()).toBe(true)
    })

    it('submits credentials and redirects to dashboard with token on success', async () => {
        const wrapper = createWrapper()
        api.login.mockResolvedValueOnce({ access_token: 'test-jwt-token' })

        wrapper.vm.username = 'admin'
        wrapper.vm.password = 'secret123'
        await wrapper.vm.login()

        expect(api.login).toHaveBeenCalledWith('admin', 'secret123')
        expect(localStorage.setItem).toHaveBeenCalledWith('token', 'test-jwt-token')
        expect(mockRouter.push).toHaveBeenCalledWith('/dashboard')
        expect(wrapper.vm.loading).toBe(false)
    })

    it('displays an error message if login fails', async () => {
        const wrapper = createWrapper()
        api.login.mockRejectedValueOnce(new Error('Invalid credentials'))

        wrapper.vm.username = 'admin'
        wrapper.vm.password = 'wrongpass'
        await wrapper.vm.login()

        expect(wrapper.vm.error).toContain('Login failed: Invalid credentials')
        expect(localStorage.setItem).not.toHaveBeenCalled()
        expect(mockRouter.push).not.toHaveBeenCalled()
    })
})
