import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import SetupWizard from '../assets/views/SetupWizard.js'
import { api } from '../assets/api.js'

// Mock the API wrapper
vi.mock('../assets/api.js', () => ({
    api: {
        testOllama: vi.fn(),
        testLlamacpp: vi.fn(),
        testPaperless: vi.fn(),
        getPaperlessUsers: vi.fn(),
        getPaperlessGroups: vi.fn(),
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
        
        // Mock API returns
        api.testOllama.mockResolvedValue({ models: ['llama3', 'mistral'] })
        api.testLlamacpp.mockResolvedValue({ models: ['llama-cpp-model'] })
        api.testPaperless.mockResolvedValue({
            tags_count: 5,
            tags: [],
            users: [{ id: 1, username: 'admin' }],
            groups: [{ id: 1, name: 'users' }]
        })
    })

    const createWrapper = async () => {
        const wrapper = mount(SetupWizard, {
            global: {
                mocks: {
                    $router: mockRouter
                }
            }
        })
        await flushPromises()
        return wrapper
    }

    it('renders the initial setup form', async () => {
        const wrapper = await createWrapper()
        expect(wrapper.text()).toContain('Initial Setup')
        expect(wrapper.find('form').exists()).toBe(true)
    })

    it('tests Ollama connection and updates models list', async () => {
        const wrapper = await createWrapper()
        
        await wrapper.vm.fetchModels('ollama')
        
        expect(api.testOllama).toHaveBeenCalledWith({ ollama_url: wrapper.vm.settings.ollama_url })
        expect(wrapper.vm.availableModels).toEqual(['llama3', 'mistral'])
        expect(wrapper.vm.settings.ollama_model).toBe('llama3')
    })
    
    it('shows error if Ollama connection fails', async () => {
        const wrapper = await createWrapper()
        api.testOllama.mockRejectedValueOnce(new Error('Network Error'))
        
        await wrapper.vm.fetchModels('ollama')
        expect(wrapper.vm.error).toContain('Failed to fetch models: Network Error')
    })

    it('switches between Ollama and Llama.cpp backend options', async () => {
        const wrapper = await createWrapper()
        
        // Defaults to ollama
        expect(wrapper.vm.settings.ai_backend).toBe('ollama')
        expect(wrapper.text()).toContain('Ollama API URL')
        expect(wrapper.text()).not.toContain('Llama.cpp API URL')

        // Switch to llamacpp
        await wrapper.find('input[value="llamacpp"]').setValue()
        
        expect(wrapper.vm.settings.ai_backend).toBe('llamacpp')
        expect(wrapper.text()).not.toContain('Ollama API URL')
        expect(wrapper.text()).toContain('Llama.cpp API URL')
    })

    it('tests Paperless connection and shows success message', async () => {
        const wrapper = await createWrapper()

        await wrapper.vm.testPaperless()

        expect(api.testPaperless).toHaveBeenCalledWith({
            paperless_url: wrapper.vm.settings.paperless_url,
            paperless_token: wrapper.vm.settings.paperless_token
        })
        expect(wrapper.vm.paperlessStatus).toBe('Connection successful! Found 5 tags, 1 users, 1 groups.')
        expect(wrapper.vm.availableUsers).toHaveLength(1)
        expect(wrapper.vm.availableGroups).toHaveLength(1)
    })

    it('submits the setup form and redirects to login on success', async () => {
        const wrapper = await createWrapper()
        api.runSetup.mockResolvedValueOnce({})
        
        // Change one of the new fields to non-default
        wrapper.vm.settings.generate_correspondent = true
        wrapper.vm.settings.max_tags = 10
        
        await wrapper.vm.submitSetup()
        
        expect(wrapper.vm.loading).toBe(false)
        expect(api.runSetup).toHaveBeenCalledWith(expect.objectContaining({
            generate_correspondent: true,
            generate_document_type: false,
            generate_tags: false,
            max_tags: 10
        }))
        expect(mockRouter.push).toHaveBeenCalledWith('/login')
    })
})
