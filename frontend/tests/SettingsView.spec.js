import { describe, it, expect, vi } from 'vitest';
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

    it('automatically dismisses message banner after 5 seconds', async () => {
        vi.useFakeTimers();
        try {
            const wrapper = mount(SettingsView, {
                props: {
                    modelValue: defaultModelValue,
                    message: 'Settings updated successfully.'
                }
            });

            expect(wrapper.find('.message-banner').exists()).toBe(true);

            vi.advanceTimersByTime(4999);
            expect(wrapper.emitted('update:message')).toBeFalsy();

            vi.advanceTimersByTime(1);
            expect(wrapper.emitted('update:message')).toBeTruthy();
            expect(wrapper.emitted('update:message')[0]).toEqual(['']);
        } finally {
            vi.useRealTimers();
        }
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
        expect(paperlessComponent.props('error')).toBe(
            'Paperless connection failed: 401 Unauthorized'
        );
        expect(paperlessComponent.text()).toContain(
            'Paperless connection failed: 401 Unauthorized'
        );
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

    it('renders all category navigation items with titles and subtitles', () => {
        const wrapper = mount(SettingsView, {
            props: {
                modelValue: defaultModelValue
            }
        });

        const nav = wrapper.find('nav');
        expect(nav.exists()).toBe(true);
        expect(nav.text()).toContain('Paperless-ngx');
        expect(nav.text()).toContain('AI Backend & Models');
        expect(nav.text()).toContain('Capabilities & Permissions');
        expect(nav.text()).toContain('Processing & Schedule');
        expect(nav.text()).toContain('Logging & Retention');
        expect(nav.text()).toContain('All Settings');
    });

    it('navigates to subsettings category on click and triggers router push', async () => {
        const mockPush = vi.fn();
        const wrapper = mount(SettingsView, {
            props: {
                modelValue: defaultModelValue
            },
            global: {
                mocks: {
                    $router: { push: mockPush },
                    $route: {
                        params: { category: 'paperless' },
                        path: '/dashboard/settings/paperless'
                    }
                }
            }
        });

        expect(wrapper.vm.activeCategory).toBe('paperless');

        // Click Logging category button in desktop nav
        const buttons = wrapper.findAll('nav button');
        const loggingBtn = buttons.find((b) => b.text().includes('Logging & Retention'));
        expect(loggingBtn.exists()).toBe(true);
        await loggingBtn.trigger('click');

        expect(mockPush).toHaveBeenCalledWith('/dashboard/settings/logging');
        expect(wrapper.vm.internalCategory).toBe('logging');
    });

    it('activates category from $route.params.category URL', () => {
        const wrapper = mount(SettingsView, {
            props: {
                modelValue: defaultModelValue
            },
            global: {
                mocks: {
                    $route: { params: { category: 'logging' }, path: '/dashboard/settings/logging' }
                }
            }
        });

        expect(wrapper.vm.activeCategory).toBe('logging');
        expect(wrapper.vm.currentCategoryObj.title).toBe('Logging & Retention');
        expect(wrapper.vm.isCategoryActive('logging')).toBe(true);
        expect(wrapper.vm.isCategoryActive('paperless')).toBe(false);
    });

    it('shows all sections when all category is selected', () => {
        const wrapper = mount(SettingsView, {
            props: {
                modelValue: defaultModelValue
            },
            global: {
                mocks: {
                    $route: { params: { category: 'all' }, path: '/dashboard/settings/all' }
                }
            }
        });

        expect(wrapper.vm.activeCategory).toBe('all');
        expect(wrapper.vm.isCategoryActive('paperless')).toBe(true);
        expect(wrapper.vm.isCategoryActive('ai')).toBe(true);
        expect(wrapper.vm.isCategoryActive('capabilities')).toBe(true);
        expect(wrapper.vm.isCategoryActive('processing')).toBe(true);
        expect(wrapper.vm.isCategoryActive('logging')).toBe(true);
    });

    it('displays error badge on category when section-specific error occurs', () => {
        const wrapper = mount(SettingsView, {
            props: {
                modelValue: defaultModelValue,
                error: 'Failed to fetch models: Connection timed out'
            }
        });

        const nav = wrapper.find('nav');
        // AI nav button should display error indicator
        const aiBtn = nav.findAll('button').find((b) => b.text().includes('AI Backend'));
        expect(aiBtn.exists()).toBe(true);
        expect(aiBtn.text()).toContain('!');
    });

    it('navigates via Previous and Next buttons in footer', async () => {
        const mockPush = vi.fn();
        const wrapper = mount(SettingsView, {
            props: {
                modelValue: defaultModelValue
            },
            global: {
                mocks: {
                    $router: { push: mockPush },
                    $route: {
                        params: { category: 'paperless' },
                        path: '/dashboard/settings/paperless'
                    }
                }
            }
        });

        expect(wrapper.vm.nextCategory.id).toBe('ai');
        const nextBtn = wrapper
            .findAll('form button')
            .find((b) => b.text().includes('Next: AI Backend'));
        expect(nextBtn.exists()).toBe(true);
        await nextBtn.trigger('click');

        expect(mockPush).toHaveBeenCalledWith('/dashboard/settings/ai');
    });
});
