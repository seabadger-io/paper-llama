import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import SettingsView from '../assets/components/SettingsView.js';

describe('SettingsView Component', () => {
    const defaultModelValue = {
        paperless_url: 'http://paperless',
        paperless_token: 'token',
        ai_backend: 'ollama',
        ollama_url: 'http://localhost:11434',
        ollama_model: 'llama3'
    };

    it('renders top sticky error banner when error is set and emits update:error on dismiss', async () => {
        const wrapper = mount(SettingsView, {
            props: {
                modelValue: defaultModelValue,
                error: 'Failed to fetch models: Connection refused'
            }
        });

        const errorBanner = wrapper.find('.error-banner');
        expect(errorBanner.exists()).toBe(true);
        expect(errorBanner.text()).toContain('Failed to fetch models: Connection refused');

        const dismissBtn = errorBanner.find('button');
        expect(dismissBtn.exists()).toBe(true);
        await dismissBtn.trigger('click');

        expect(wrapper.emitted('update:error')).toBeTruthy();
        expect(wrapper.emitted('update:error')[0]).toEqual(['']);
    });

    it('renders top sticky message banner when message is set and emits update:message on dismiss', async () => {
        const wrapper = mount(SettingsView, {
            props: {
                modelValue: defaultModelValue,
                message: 'Settings updated successfully.'
            }
        });

        const messageBanner = wrapper.find('.message-banner');
        expect(messageBanner.exists()).toBe(true);
        expect(messageBanner.text()).toContain('Settings updated successfully.');

        const dismissBtn = messageBanner.find('button');
        expect(dismissBtn.exists()).toBe(true);
        await dismissBtn.trigger('click');

        expect(wrapper.emitted('update:message')).toBeTruthy();
        expect(wrapper.emitted('update:message')[0]).toEqual(['']);
    });

    it('routes AI backend errors to AIBackendSettings and omits them from the bottom', () => {
        const wrapper = mount(SettingsView, {
            props: {
                modelValue: defaultModelValue,
                error: 'Failed to fetch models: timed out'
            }
        });

        expect(wrapper.vm.aiBackendError).toBe('Failed to fetch models: timed out');
        expect(wrapper.vm.paperlessError).toBe('');

        const aiComponent = wrapper.findComponent({ name: 'AIBackendSettings' });
        expect(aiComponent.exists()).toBe(true);
        expect(aiComponent.props('error')).toBe('Failed to fetch models: timed out');
        expect(aiComponent.text()).toContain('Failed to fetch models: timed out');

        // Verify bottom error block is NOT rendered for section-specific error
        const paperlessComponent = wrapper.findComponent({ name: 'PaperlessSettings' });
        expect(paperlessComponent.props('error')).toBe('');
    });

    it('routes Paperless connection errors to PaperlessSettings and omits them from the bottom', () => {
        const wrapper = mount(SettingsView, {
            props: {
                modelValue: defaultModelValue,
                error: 'Paperless connection failed: 401 Unauthorized'
            }
        });

        expect(wrapper.vm.paperlessError).toBe('Paperless connection failed: 401 Unauthorized');
        expect(wrapper.vm.aiBackendError).toBe('');

        const paperlessComponent = wrapper.findComponent({ name: 'PaperlessSettings' });
        expect(paperlessComponent.exists()).toBe(true);
        expect(paperlessComponent.props('error')).toBe('Paperless connection failed: 401 Unauthorized');
        expect(paperlessComponent.text()).toContain('Paperless connection failed: 401 Unauthorized');
    });

    it('shows general save error in top banner and near the save button', () => {
        const wrapper = mount(SettingsView, {
            props: {
                modelValue: defaultModelValue,
                error: 'Failed to update settings: Validation error'
            }
        });

        expect(wrapper.vm.paperlessError).toBe('');
        expect(wrapper.vm.aiBackendError).toBe('');

        const topBanner = wrapper.find('.error-banner');
        expect(topBanner.exists()).toBe(true);
        expect(topBanner.text()).toContain('Failed to update settings: Validation error');

        // Check save area
        expect(wrapper.text()).toContain('Failed to update settings: Validation error');
    });
});
