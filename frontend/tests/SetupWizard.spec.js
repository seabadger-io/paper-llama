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
        expect(wrapper.vm.aiBackendError).toContain('Failed to fetch models: Network Error')
        expect(wrapper.findComponent({ name: 'AIBackendSettings' }).props('error')).toContain('Failed to fetch models: Network Error')
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

    it('renders all stepper progress items', async () => {
        const wrapper = await createWrapper()
        expect(wrapper.text()).toContain('Account')
        expect(wrapper.text()).toContain('Paperless')
        expect(wrapper.text()).toContain('AI Backend')
        expect(wrapper.text()).toContain('Capabilities')
        expect(wrapper.text()).toContain('Processing')
        expect(wrapper.text()).toContain('Finish')
    })

    it('switches steps when clicking stepper item and pushes to router', async () => {
        const wrapper = await createWrapper()
        expect(wrapper.vm.currentStep).toBe('account')

        await wrapper.vm.setStep('paperless')
        expect(mockRouter.push).toHaveBeenCalledWith('/setup/paperless')
        expect(wrapper.vm.internalStep).toBe('paperless')
    })

    it('activates step from route params URL directly', async () => {
        const wrapper = mount(SetupWizard, {
            global: {
                mocks: {
                    $router: mockRouter,
                    $route: { params: { step: 'capabilities' }, path: '/setup/capabilities' }
                }
            }
        })
        await flushPromises()

        expect(wrapper.vm.currentStep).toBe('capabilities')
        expect(wrapper.vm.currentStepObj.title).toBe('Capabilities & Permissions')
        expect(wrapper.vm.isStepActive('capabilities')).toBe(true)
        expect(wrapper.vm.isStepActive('account')).toBe(false)
    })

    it('navigates through steps using next and back buttons', async () => {
        const wrapper = await createWrapper()
        expect(wrapper.vm.currentStep).toBe('account')

        wrapper.vm.goToNextStep()
        expect(wrapper.vm.internalStep).toBe('paperless')
        expect(mockRouter.push).toHaveBeenCalledWith('/setup/paperless')

        wrapper.vm.goToPrevStep()
        expect(wrapper.vm.internalStep).toBe('account')
        expect(mockRouter.push).toHaveBeenCalledWith('/setup/account')
    })

    it('displays summary and final complete button on the finish step', async () => {
        const wrapper = mount(SetupWizard, {
            global: {
                mocks: {
                    $router: mockRouter,
                    $route: { params: { step: 'logging' }, path: '/setup/logging' }
                }
            }
        })
        await flushPromises()

        expect(wrapper.text()).toContain('Configuration Summary')
        expect(wrapper.text()).toContain('Complete Setup & Launch 🚀')
    })

    it('generates a 32-byte non-empty webhook token by default', async () => {
        const wrapper = await createWrapper()
        expect(wrapper.vm.settings.webhook_tokens).toBeDefined()
        expect(wrapper.vm.settings.webhook_tokens.length).toBe(64)
        expect(/^[0-9a-f]{64}$/i.test(wrapper.vm.settings.webhook_tokens)).toBe(true)
    })

    it('allows user to clear webhook_tokens to empty string', async () => {
        const wrapper = await createWrapper()
        api.runSetup.mockResolvedValueOnce({})
        wrapper.vm.settings.webhook_tokens = ''
        await wrapper.vm.submitSetup()
        expect(api.runSetup).toHaveBeenCalledWith(expect.objectContaining({
            webhook_tokens: ''
        }))
    })

    it('validates password length on account step', async () => {
        const wrapper = await createWrapper()
        wrapper.vm.settings.password = '123'
        wrapper.vm.confirm_password = '123'
        wrapper.vm.goToNextStep()
        expect(wrapper.vm.error).toBe('Password must be at least 8 characters long.')
        expect(wrapper.vm.internalStep).toBe('account')

        wrapper.vm.settings.password = '12345678'
        wrapper.vm.confirm_password = '12345678'
        wrapper.vm.goToNextStep()
        expect(wrapper.vm.error).toBe('')
        expect(wrapper.vm.internalStep).toBe('paperless')
    })
})


