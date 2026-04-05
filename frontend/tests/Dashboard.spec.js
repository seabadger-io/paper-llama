import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import Dashboard from '../assets/views/Dashboard.js'
import { api } from '../assets/api.js'

vi.mock('../assets/api.js', () => ({
    api: {
        getLogs: vi.fn(),
        getProcessing: vi.fn(),
        getSettings: vi.fn(),
        updateSettings: vi.fn(),
        testOllama: vi.fn(),
        testLlamacpp: vi.fn(),
        testPaperless: vi.fn(),
        getPaperlessUsers: vi.fn(),
        getPaperlessGroups: vi.fn(),
        triggerProcessing: vi.fn(),
        getTriggerStats: vi.fn(),
        getAdminAccount: vi.fn()
    }
}))

describe('Dashboard Component', () => {
    let mockRouter;
    
    beforeEach(() => {
        vi.clearAllMocks()
        vi.useFakeTimers() // To handle setInterval
        
        vi.stubGlobal('localStorage', {
            removeItem: vi.fn()
        })
        vi.stubGlobal('alert', vi.fn())
        
        mockRouter = {
            push: vi.fn()
        }
        
        // Default API mock returns for mount
        api.getLogs.mockResolvedValue([])
        api.getProcessing.mockResolvedValue([])
        api.getSettings.mockResolvedValue({
            paperless_url: 'http://paperless',
            paperless_token: 'token',
            update_title: true,
            ai_backend: 'ollama',
            ollama_url: 'http://ollama'
        })
        api.testOllama.mockResolvedValue({ models: ['model-a'] })
        api.testPaperless.mockResolvedValue({ tags: [], tags_count: 0 })
        api.getPaperlessUsers.mockResolvedValue([])
        api.getPaperlessGroups.mockResolvedValue([])
        api.getTriggerStats.mockResolvedValue({ count: 5 })
        api.getAdminAccount.mockResolvedValue({ username: 'admin' })
    })
    
    afterEach(() => {
        vi.useRealTimers()
    })

    const createWrapper = async () => {
        const wrapper = mount(Dashboard, {
            global: {
                mocks: {
                    $router: mockRouter
                },
                components: {
                    LoadingSpinner: { template: '<div class="spinner">Mock Spinner</div>' }
                }
            }
        })
        // wait for mount promises
        await flushPromises()
        return wrapper
    }

    it('loads data on mount and displays the Activity Logs tab', async () => {
        const wrapper = await createWrapper()
        
        expect(api.getLogs).toHaveBeenCalled()
        expect(api.getSettings).toHaveBeenCalled()
        
        expect(wrapper.vm.loading).toBe(false)
        expect(wrapper.text()).toContain('Recent Processing Activity')
        expect(wrapper.text()).toContain('No documents processed yet.')
    })

    it('displays parsed log data correctly', async () => {
        api.getLogs.mockResolvedValueOnce([{
            id: 1,
            document_id: 100,
            changed_at: '2023-01-01T12:00:00Z',
            original_state: { title: 'Invoice' },
            new_state: { 
                title: 'Processed Invoice', 
                ai_processing_time_ms: 1500,
                tags: ['200 (AI Tag)', '300 (Manual Tag)'],
                ai_generated: { tags: [200] }
            }
        }])
        
        const wrapper = await createWrapper()
        
        expect(wrapper.text()).toContain('Invoice')
        expect(wrapper.text()).toContain('#100')
        expect(wrapper.text()).toContain('Processed Invoice')
        expect(wrapper.text()).toContain('1.5s')
        
        // Check for AI Tag highlight (the sparkle icon)
        expect(wrapper.html()).toContain('✨')
        
        // Find the specific tag element for '200 (AI Tag)' and check its class
        const aiTag = wrapper.findAll('.text-green-600')
        expect(aiTag.length).toBe(1)
        expect(aiTag[0].text()).toContain('200 (AI Tag)')
    })

    it('navigates to settings tab and saves settings', async () => {
        const wrapper = await createWrapper()
        
        // Switch to settings
        await wrapper.setData({ tab: 'settings' })
        
        expect(wrapper.text()).toContain('Application Settings')
        
        api.updateSettings.mockResolvedValueOnce({})
        await wrapper.vm.saveSettings()
        
        expect(api.updateSettings).toHaveBeenCalledWith(wrapper.vm.settings)
        expect(wrapper.vm.message).toBe('Settings updated successfully.')
    })

    it('switches between AI backends and tests connection accordingly', async () => {
        const wrapper = await createWrapper()
        
        // Switch to settings
        await wrapper.setData({ tab: 'settings' })
        
        // Switch to llamacpp
        await wrapper.setData({ settings: { ...wrapper.vm.settings, ai_backend: 'llamacpp', llamacpp_url: 'http://llama:8080' } })
        await flushPromises()
        
        // Check UI rendering
        expect(wrapper.text()).toContain('Llama.cpp API URL')
        expect(wrapper.text()).not.toContain('Ollama API URL')
        
        api.testLlamacpp.mockResolvedValueOnce({ models: ['llama-model'] })
        
        await wrapper.vm.fetchModels('llamacpp', true)
        
        expect(api.testLlamacpp).toHaveBeenCalledWith({ llamacpp_url: 'http://llama:8080' })
        expect(wrapper.vm.availableModels).toEqual(['llama-model'])
    })

    it('renders the trigger processing modal with correct count', async () => {
        const wrapper = await createWrapper()
        
        api.getTriggerStats.mockResolvedValueOnce({ count: 12 })
        
        // Open modal
        await wrapper.vm.openTriggerModal()
        await flushPromises()
        
        expect(wrapper.vm.showTriggerModal).toBe(true)
        expect(wrapper.vm.pendingCount).toBe(12)
        expect(wrapper.text()).toContain('Found 12 documents waiting to be processed')
        
        // Confirm trigger
        api.triggerProcessing.mockResolvedValueOnce({})
        await wrapper.find('.modal-confirm').trigger('click')
        await flushPromises()
        
        expect(api.triggerProcessing).toHaveBeenCalled()
        expect(wrapper.vm.showTriggerModal).toBe(false)
        expect(wrapper.vm.message).toContain('Processing triggered successfully')
    })

    it('polls for logs every 15 seconds', async () => {
        const wrapper = await createWrapper()
        expect(api.getLogs).toHaveBeenCalledTimes(1) // Initial load
        
        vi.advanceTimersByTime(15000)
        expect(api.getLogs).toHaveBeenCalledTimes(2) // Interval tick
        
        wrapper.unmount()
        vi.advanceTimersByTime(15000)
        expect(api.getLogs).toHaveBeenCalledTimes(2) // No longer polling after unmount
    })

    it('logs out and redirects to login', async () => {
        const wrapper = await createWrapper()
        
        wrapper.vm.logout()
        
        expect(localStorage.removeItem).toHaveBeenCalledWith('token')
        expect(mockRouter.push).toHaveBeenCalledWith('/login')
    })
})
