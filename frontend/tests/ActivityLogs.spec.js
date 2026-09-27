import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import ActivityLogs from '../assets/components/ActivityLogs.js';
import { api } from '../assets/api.js';

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

    it('opens AI details modal on click and fetches log details on demand', async () => {
        const log = {
            id: 42,
            document_id: 1042,
            changed_at: '2026-09-27T10:00:00Z',
            original_state: { title: 'Invoice 1042' },
            new_state: { title: 'Invoice 1042 Clean' }
        };

        const detailsResponse = {
            id: 42,
            document_id: 1042,
            prompt_used: 'System: Extract invoice data\nUser: Invoice text...',
            ai_response: '{"title": "Invoice 1042 Clean"}'
        };

        const getLogDetailsSpy = vi.spyOn(api, 'getLogDetails').mockResolvedValue(detailsResponse);

        const wrapper = mount(ActivityLogs, {
            props: {
                ...baseProps,
                logs: [log],
                logsTotal: 1
            }
        });

        // Find inspect button and click
        const inspectButton = wrapper.findAll('button').find(b => b.text().includes('Inspect AI Prompt & Response'));
        expect(inspectButton.exists()).toBe(true);
        await inspectButton.trigger('click');

        expect(getLogDetailsSpy).toHaveBeenCalledWith(42);

        // Wait for async fetch to update reactive state
        await wrapper.vm.$nextTick();
        await wrapper.vm.$nextTick();

        // Check modal contents
        expect(wrapper.text()).toContain('AI Interaction — Document #1042');
        expect(wrapper.text()).toContain('System: Extract invoice data');

        // Switch tab to response
        const responseTabBtn = wrapper.findAll('button').find(b => b.text().includes('Raw AI Response'));
        expect(responseTabBtn.exists()).toBe(true);
        await responseTabBtn.trigger('click');
        expect(wrapper.text()).toContain('{"title": "Invoice 1042 Clean"}');

        // Close modal
        const closeBtn = wrapper.findAll('button').find(b => b.text().trim() === 'Close');
        expect(closeBtn.exists()).toBe(true);
        await closeBtn.trigger('click');
        expect(wrapper.text()).not.toContain('AI Interaction — Document #1042');
    });

    it('renders Retry button on failed log and handles retry click', async () => {
        const failedLog = {
            id: 50,
            document_id: 500,
            changed_at: '2026-09-27T10:00:00Z',
            original_state: { title: 'Failed Invoice' },
            new_state: { error: 'Ollama timeout', attempts: 3 }
        };

        const reprocessSpy = vi.spyOn(api, 'reprocessDocument').mockResolvedValue({
            message: 'Reprocessing triggered for document 500',
            document_id: 500
        });

        const wrapper = mount(ActivityLogs, {
            props: {
                ...baseProps,
                logs: [failedLog],
                logsTotal: 1
            }
        });

        const retryBtn = wrapper.findAll('button').find(b => b.text().includes('Retry'));
        expect(retryBtn.exists()).toBe(true);
        expect(retryBtn.attributes('disabled')).toBeUndefined();

        await retryBtn.trigger('click');
        expect(reprocessSpy).toHaveBeenCalledWith(500);

        await wrapper.vm.$nextTick();
        expect(wrapper.text()).toContain('Reprocessing triggered for document 500');
        expect(wrapper.emitted('reprocess')).toBeTruthy();
        expect(wrapper.emitted('reprocess')[0]).toEqual([500]);
    });

    it('renders Re-process button on successful log and handles click', async () => {
        const successLog = {
            id: 51,
            document_id: 501,
            changed_at: '2026-09-27T10:00:00Z',
            original_state: { title: 'Good Doc' },
            new_state: { title: 'Clean Doc' }
        };

        const reprocessSpy = vi.spyOn(api, 'reprocessDocument').mockResolvedValue({
            message: 'Reprocessing triggered for document 501',
            document_id: 501
        });

        const wrapper = mount(ActivityLogs, {
            props: {
                ...baseProps,
                logs: [successLog],
                logsTotal: 1
            }
        });

        const reprocessBtn = wrapper.findAll('button').find(b => b.text().includes('Re-process'));
        expect(reprocessBtn.exists()).toBe(true);

        await reprocessBtn.trigger('click');
        expect(reprocessSpy).toHaveBeenCalledWith(501);

        await wrapper.vm.$nextTick();
        expect(wrapper.text()).toContain('Reprocessing triggered for document 501');
    });

    it('disables button and shows processing state when document is in processingDocs', () => {
        const failedLog = {
            id: 52,
            document_id: 502,
            changed_at: '2026-09-27T10:00:00Z',
            original_state: { title: 'Doc 502' },
            new_state: { error: 'Connection failed', attempts: 3 }
        };

        const wrapper = mount(ActivityLogs, {
            props: {
                ...baseProps,
                logs: [failedLog],
                logsTotal: 1,
                processingDocs: [{ document_id: 502, started_at: '2026-09-27T10:05:00Z' }]
            }
        });

        const retryBtn = wrapper.findAll('button').find(b => b.text().includes('Retrying...'));
        expect(retryBtn.exists()).toBe(true);
        expect(retryBtn.attributes('disabled')).toBeDefined();
    });

    it('displays error banner if reprocessing fails', async () => {
        const failedLog = {
            id: 53,
            document_id: 503,
            changed_at: '2026-09-27T10:00:00Z',
            original_state: { title: 'Doc 503' },
            new_state: { error: 'Error', attempts: 3 }
        };

        vi.spyOn(api, 'reprocessDocument').mockRejectedValue(new Error('Document is already being processed'));

        const wrapper = mount(ActivityLogs, {
            props: {
                ...baseProps,
                logs: [failedLog],
                logsTotal: 1
            }
        });

        const retryBtn = wrapper.findAll('button').find(b => b.text().includes('Retry'));
        await retryBtn.trigger('click');
        await wrapper.vm.$nextTick();
        await wrapper.vm.$nextTick();

        expect(wrapper.text()).toContain('Failed to reprocess document #503: Document is already being processed');
    });
});

