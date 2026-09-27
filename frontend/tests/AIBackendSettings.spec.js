import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import AIBackendSettings from '../assets/components/AIBackendSettings.js';

describe('AIBackendSettings Component', () => {
    it('renders temperature and context window for Ollama', () => {
        const modelValue = {
            ai_backend: 'ollama',
            ollama_url: 'http://localhost:11434',
            ollama_model: 'llama3',
            ollama_timeout: 300,
            ollama_temperature: 0.0,
            ollama_context_size: 4096,
            ollama_extra_params: ''
        };

        const wrapper = mount(AIBackendSettings, {
            props: { modelValue }
        });

        expect(wrapper.text()).toContain('Temperature');
        expect(wrapper.text()).toContain('Context Window Size');
        expect(wrapper.text()).toContain('Advanced Model Parameters (JSON)');
    });

    it('renders temperature and max tokens for Llama.cpp', () => {
        const modelValue = {
            ai_backend: 'llamacpp',
            llamacpp_url: 'http://localhost:8080',
            llamacpp_model: 'llama-3',
            llamacpp_timeout: 300,
            llamacpp_temperature: 0.7,
            llamacpp_max_tokens: 2048,
            llamacpp_extra_params: ''
        };

        const wrapper = mount(AIBackendSettings, {
            props: { modelValue }
        });

        expect(wrapper.text()).toContain('Temperature');
        expect(wrapper.text()).toContain('Max Tokens');
        expect(wrapper.text()).toContain('Advanced Model Parameters (JSON)');
    });

    it('toggles collapsible advanced section and shows error on invalid JSON', async () => {
        const modelValue = {
            ai_backend: 'ollama',
            ollama_url: 'http://localhost:11434',
            ollama_model: 'llama3',
            ollama_extra_params: 'invalid json {'
        };

        const wrapper = mount(AIBackendSettings, {
            props: { modelValue }
        });

        // Initially shown because ollama_extra_params is non-empty
        expect(wrapper.find('textarea').exists()).toBe(true);
        expect(wrapper.vm.ollamaParamsError).toBe('Invalid JSON syntax');
        expect(wrapper.text()).toContain('Invalid JSON syntax');
    });

    it('detects reserved keys in extra parameters JSON', async () => {
        const modelValue = {
            ai_backend: 'ollama',
            ollama_url: 'http://localhost:11434',
            ollama_model: 'llama3',
            ollama_extra_params: '{"model": "forbidden", "top_p": 0.9}'
        };

        const wrapper = mount(AIBackendSettings, {
            props: { modelValue }
        });

        expect(wrapper.vm.ollamaParamsError).toContain("Reserved parameter 'model' cannot be overridden");
        expect(wrapper.text()).toContain("Reserved parameter 'model' cannot be overridden");
    });

    it('formats valid JSON on clicking Format JSON', async () => {
        const modelValue = {
            ai_backend: 'ollama',
            ollama_url: 'http://localhost:11434',
            ollama_model: 'llama3',
            ollama_extra_params: '{"top_p":0.9,"repeat_penalty":1.1}'
        };

        const wrapper = mount(AIBackendSettings, {
            props: { modelValue }
        });

        expect(wrapper.vm.isOllamaJsonValid).toBe(true);
        wrapper.vm.formatJson('ollama_extra_params');

        expect(modelValue.ollama_extra_params).toBe(JSON.stringify({ top_p: 0.9, repeat_penalty: 1.1 }, null, 2));
    });
});
