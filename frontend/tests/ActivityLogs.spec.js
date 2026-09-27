import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import ActivityLogs from '../assets/components/ActivityLogs.js';

describe('ActivityLogs Component', () => {
    const baseProps = {
        logs: [],
        logsTotal: 0,
        logsLimit: 20,
        logsOffset: 0,
        processingDocs: [],
        serverTimezone: 'UTC'
    };

    it('renders log without token usage correctly', () => {
        const log = {
            id: 1,
            document_id: 101,
            changed_at: '2026-09-27T10:00:00Z',
            original_state: { title: 'Invoice Old' },
            new_state: {
                title: 'Invoice New',
                ai_processing_time_ms: 1500
            }
        };

        const wrapper = mount(ActivityLogs, {
            props: {
                ...baseProps,
                logs: [log],
                logsTotal: 1
            }
        });

        expect(wrapper.text()).toContain('Invoice New');
        expect(wrapper.text()).toContain('1.5s');
        expect(wrapper.text()).not.toContain('Tokens:');
    });

    it('renders token usage with prompt, completion, and total tokens', () => {
        const log = {
            id: 2,
            document_id: 102,
            changed_at: '2026-09-27T10:00:00Z',
            original_state: { title: 'Receipt Old' },
            new_state: {
                title: 'Receipt New',
                ai_processing_time_ms: 2300,
                token_usage: {
                    prompt_tokens: 120,
                    completion_tokens: 45,
                    total_tokens: 165
                }
            }
        };

        const wrapper = mount(ActivityLogs, {
            props: {
                ...baseProps,
                logs: [log],
                logsTotal: 1
            }
        });

        expect(wrapper.text()).toContain('Tokens:');
        expect(wrapper.text()).toContain('165');
        expect(wrapper.text()).toContain('120 prompt');
        expect(wrapper.text()).toContain('45 completion');
        expect(wrapper.text()).not.toContain('reasoning');
    });

    it('renders reasoning tokens when reported', () => {
        const log = {
            id: 3,
            document_id: 103,
            changed_at: '2026-09-27T10:00:00Z',
            original_state: { title: 'Contract Old' },
            new_state: {
                title: 'Contract New',
                token_usage: {
                    prompt_tokens: 300,
                    completion_tokens: 150,
                    total_tokens: 450,
                    reasoning_tokens: 80
                }
            }
        };

        const wrapper = mount(ActivityLogs, {
            props: {
                ...baseProps,
                logs: [log],
                logsTotal: 1
            }
        });

        expect(wrapper.text()).toContain('Tokens:');
        expect(wrapper.text()).toContain('450');
        expect(wrapper.text()).toContain('300 prompt');
        expect(wrapper.text()).toContain('150 completion');
        expect(wrapper.text()).toContain('80 reasoning');
    });

    it('renders token usage on failed processing when available', () => {
        const log = {
            id: 4,
            document_id: 104,
            changed_at: '2026-09-27T10:00:00Z',
            original_state: { title: 'Failed Doc' },
            new_state: {
                error: 'JSONDecodeError',
                attempts: 3,
                token_usage: {
                    prompt_tokens: 210,
                    completion_tokens: 30,
                    total_tokens: 240
                }
            }
        };

        const wrapper = mount(ActivityLogs, {
            props: {
                ...baseProps,
                logs: [log],
                logsTotal: 1
            }
        });

        expect(wrapper.text()).toContain('Processing Failed');
        expect(wrapper.text()).toContain('Tokens: 240');
        expect(wrapper.text()).toContain('210 prompt');
        expect(wrapper.text()).toContain('30 completion');
    });
});
