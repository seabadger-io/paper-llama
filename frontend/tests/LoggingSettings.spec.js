import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import LoggingSettings from '../assets/components/LoggingSettings.js';
import { api } from '../assets/api.js';

describe('LoggingSettings Component', () => {
    it('renders logging controls and inputs', () => {
        const modelValue = {
            log_ai_interactions: true,
            log_max_ai_chars: 5000,
            log_retention_days: 90,
            log_compact_after_days: 30
        };

        const wrapper = mount(LoggingSettings, {
            props: { modelValue }
        });

        expect(wrapper.text()).toContain('Logging & Retention');
        expect(wrapper.text()).toContain('Log AI Prompts & Responses');
        expect(wrapper.text()).toContain('Max AI Interaction Characters');
        expect(wrapper.text()).toContain('Log Retention Period (Days)');
        expect(wrapper.text()).toContain('Log Compaction Period (Days)');
        expect(wrapper.find('input#log_ai_interactions').element.checked).toBe(true);
    });

    it('hides max ai chars input when log_ai_interactions is false', () => {
        const modelValue = {
            log_ai_interactions: false,
            log_max_ai_chars: 0,
            log_retention_days: 90,
            log_compact_after_days: 30
        };

        const wrapper = mount(LoggingSettings, {
            props: { modelValue }
        });

        expect(wrapper.text()).not.toContain('Max AI Interaction Characters');
    });

    it('runs log cleanup successfully and displays summary', async () => {
        vi.spyOn(api, 'runLogCleanup').mockResolvedValue({
            deleted_logs: 5,
            compacted_logs: 12
        });

        const modelValue = {
            log_ai_interactions: true,
            log_max_ai_chars: 0,
            log_retention_days: 90,
            log_compact_after_days: 30
        };

        const wrapper = mount(LoggingSettings, {
            props: { modelValue }
        });

        const button = wrapper.find('button');
        expect(button.text()).toBe('Run Maintenance Now');
        await button.trigger('click');

        expect(api.runLogCleanup).toHaveBeenCalled();
        expect(wrapper.text()).toContain('Cleanup complete: pruned 5 log(s), compacted 12 log(s).');
    });

    it('displays error message when cleanup fails', async () => {
        vi.spyOn(api, 'runLogCleanup').mockRejectedValue(new Error('Network failure'));

        const modelValue = {
            log_ai_interactions: true,
            log_max_ai_chars: 0,
            log_retention_days: 90,
            log_compact_after_days: 30
        };

        const wrapper = mount(LoggingSettings, {
            props: { modelValue }
        });

        const button = wrapper.find('button');
        await button.trigger('click');

        expect(wrapper.text()).toContain('Failed to run cleanup: Network failure');
    });
});
