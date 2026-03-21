import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import SetupWizard from '../assets/views/SetupWizard.js'
import { api } from '../assets/api.js'

// Mock the API wrapper
vi.mock('../assets/api.js', () => ({
    api: {
        testOllama: vi.fn(),
        testPaperless: vi.fn(),
        runSetup: vi.fn()
    }
}))

describe('SetupWizard Component', () => {
    let mockRouter;
    
    beforeEach(() => {
        vi.clearAllMocks()
        mockRouter = {
            push: vi.fn()
        }
    })

    const createWrapper = () => {
        return mount(SetupWizard, {
            global: {
                mocks: {
                    $router: mockRouter
                }
            }
        })
    }

    it('renders the initial setup form', () => {
        const wrapper = createWrapper()
        expect(wrapper.text()).toContain('Initial Setup')
        expect(wrapper.find('form').exists()).toBe(true)
    })

    it('tests Ollama connection and updates models list', async () => {
        const wrapper = createWrapper()
        api.testOllama.mockResolvedValueOnce({ models: ['llama3', 'mistral'] })
        
        await wrapper.vm.fetchModels()
        
        expect(api.testOllama).toHaveBeenCalledWith({ ollama_url: wrapper.vm.form.ollama_url })
        expect(wrapper.vm.availableModels).toEqual(['llama3', 'mistral'])
        expect(wrapper.vm.form.ollama_model).toBe('llama3')
    })
    
    it('shows error if Ollama connection fails', async () => {
        const wrapper = createWrapper()
        api.testOllama.mockRejectedValueOnce(new Error('Network Error'))
        
        await wrapper.vm.fetchModels()
        expect(wrapper.vm.error).toContain('Failed to fetch models: Network Error')
    })

    it('tests Paperless connection and shows success message', async () => {
        const wrapper = createWrapper()
        api.testPaperless.mockResolvedValueOnce({ tags_count: 5 })
        
        await wrapper.vm.testPaperless()
        
        expect(api.testPaperless).toHaveBeenCalledWith({
            paperless_url: wrapper.vm.form.paperless_url,
            paperless_token: wrapper.vm.form.paperless_token
        })
        expect(wrapper.vm.paperlessStatus).toBe('Connection successful! Found 5 tags.')
    })

    it('submits the setup form and redirects to login on success', async () => {
        const wrapper = createWrapper()
        api.runSetup.mockResolvedValueOnce({})
        
        await wrapper.vm.submitSetup()
        
        expect(wrapper.vm.loading).toBe(false)
        expect(api.runSetup).toHaveBeenCalledWith(wrapper.vm.form)
        expect(mockRouter.push).toHaveBeenCalledWith('/login')
    })
})
