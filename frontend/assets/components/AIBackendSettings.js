const RESERVED_KEYS = [
    'model',
    'prompt',
    'system',
    'stream',
    'format',
    'images',
    'messages',
    'response_format'
];

function validateJson(val) {
    if (!val || typeof val !== 'string' || !val.trim()) return null;
    let parsed;
    try {
        parsed = JSON.parse(val);
    } catch {
        return 'Invalid JSON syntax';
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        return 'Must be a JSON object (key-value mapping)';
    }
    for (const key of Object.keys(parsed)) {
        if (RESERVED_KEYS.includes(key)) {
            return `Reserved parameter '${key}' cannot be overridden`;
        }
    }
    return null;
}

export default {
    name: 'AIBackendSettings',
    props: {
        modelValue: { type: Object, required: true },
        availableModels: { type: Array, default: () => [] }
    },
    emits: ['update:modelValue', 'fetch-models'],
    data() {
        return {
            showOllamaAdvanced: Boolean(this.modelValue && this.modelValue.ollama_extra_params),
            showLlamacppAdvanced: Boolean(this.modelValue && this.modelValue.llamacpp_extra_params)
        };
    },
    computed: {
        ollamaParamsError() {
            return validateJson(this.modelValue.ollama_extra_params);
        },
        isOllamaJsonValid() {
            const val = this.modelValue.ollama_extra_params;
            return Boolean(val && typeof val === 'string' && val.trim() && !this.ollamaParamsError);
        },
        llamacppParamsError() {
            return validateJson(this.modelValue.llamacpp_extra_params);
        },
        isLlamacppJsonValid() {
            const val = this.modelValue.llamacpp_extra_params;
            return Boolean(
                val && typeof val === 'string' && val.trim() && !this.llamacppParamsError
            );
        }
    },
    methods: {
        formatJson(field) {
            try {
                const val = this.modelValue[field];
                if (val && typeof val === 'string' && val.trim()) {
                    const parsed = JSON.parse(val);
                    this.modelValue[field] = JSON.stringify(parsed, null, 2);
                }
            } catch {
                // Ignore parsing errors during formatting
            }
        }
    },
    template: `
        <div class="space-y-4">
            <h3 class="text-lg font-medium text-gray-900 mb-4">AI Backend</h3>
            <div class="flex space-x-4 mb-4">
                <label class="flex items-center">
                    <input type="radio" v-model="modelValue.ai_backend" value="ollama" class="text-blue-600 focus:ring-blue-500">
                    <span class="ml-2 text-sm text-gray-700">Ollama</span>
                </label>
                <label class="flex items-center">
                    <input type="radio" v-model="modelValue.ai_backend" value="llamacpp" class="text-blue-600 focus:ring-blue-500">
                    <span class="ml-2 text-sm text-gray-700">Llama.cpp</span>
                </label>
            </div>

            <!-- Ollama Config -->
            <div v-if="modelValue.ai_backend === 'ollama'" class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700">Ollama API URL</label>
                    <div class="flex space-x-2">
                        <input v-model="modelValue.ollama_url" required class="flex-1 block w-full px-3 py-2 border border-gray-300 rounded-md sm:text-sm">
                        <button type="button" @click="$emit('fetch-models', 'ollama')" class="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">Fetch Models</button>
                    </div>
                </div>
                <div v-if="availableModels.length > 0">
                    <label class="block text-sm font-medium text-gray-700">Ollama Model</label>
                    <select v-model="modelValue.ollama_model" required class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md shadow-sm">
                        <option v-for="m in availableModels" :key="m" :value="m">{{ m }}</option>
                    </select>
                </div>
                <div v-else>
                    <label class="block text-sm font-medium text-gray-700">Ollama Model</label>
                    <input v-model="modelValue.ollama_model" required class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md sm:text-sm">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700">API Key (optional)</label>
                    <input type="password" v-model="modelValue.ollama_api_key" placeholder="Optional API key or bearer token" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md sm:text-sm">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700">API Timeout (seconds)</label>
                    <input type="number" v-model="modelValue.ollama_timeout" required min="30" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md sm:text-sm">
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700">Temperature</label>
                        <input type="number" step="0.05" min="0" max="2" v-model.number="modelValue.ollama_temperature" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md sm:text-sm">
                        <p class="mt-1 text-xs text-gray-500 italic">Default: 0.0 (deterministic). Use 0.6+ for reasoning models.</p>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700">Context Window Size</label>
                        <input type="number" step="512" min="512" placeholder="4096" v-model.number="modelValue.ollama_context_size" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md sm:text-sm">
                        <p class="mt-1 text-xs text-gray-500 italic">Tokens passed to Ollama (num_ctx). Default: 4096.</p>
                    </div>
                </div>

                <!-- Collapsible Ollama Advanced Parameters -->
                <div class="pt-2">
                    <button type="button" @click="showOllamaAdvanced = !showOllamaAdvanced" class="flex items-center text-sm font-medium text-blue-600 hover:text-blue-800">
                        <span class="mr-1">{{ showOllamaAdvanced ? '▾' : '▸' }}</span>
                        Advanced Model Parameters (JSON)
                    </button>
                    <div v-if="showOllamaAdvanced" class="mt-2 space-y-2">
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-gray-500">Custom options (e.g. top_p, repeat_penalty, num_predict)</span>
                            <div class="flex items-center space-x-2">
                                <span v-if="isOllamaJsonValid" class="text-xs text-green-600 font-medium">Valid JSON</span>
                                <button type="button" :disabled="!isOllamaJsonValid" @click="formatJson('ollama_extra_params')" class="px-2 py-0.5 text-xs border border-gray-300 rounded bg-white hover:bg-gray-50 text-gray-700 disabled:opacity-40">Format JSON</button>
                            </div>
                        </div>
                        <textarea v-model="modelValue.ollama_extra_params" rows="3" class="block w-full font-mono text-xs px-3 py-2 border rounded-md sm:text-sm" :class="ollamaParamsError ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'" placeholder='{"top_p": 0.9, "repeat_penalty": 1.1}'></textarea>
                        <p v-if="ollamaParamsError" class="text-xs text-red-600">{{ ollamaParamsError }}</p>
                    </div>
                </div>
            </div>

            <!-- Llama.cpp Config -->
            <div v-if="modelValue.ai_backend === 'llamacpp'" class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700">Llama.cpp API URL</label>
                    <div class="flex space-x-2">
                        <input v-model="modelValue.llamacpp_url" required class="flex-1 block w-full px-3 py-2 border border-gray-300 rounded-md sm:text-sm">
                        <button type="button" @click="$emit('fetch-models', 'llamacpp')" class="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">Fetch Models</button>
                    </div>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700">API Key (optional)</label>
                    <input type="password" v-model="modelValue.llamacpp_api_key" placeholder="Optional API key or bearer token" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md sm:text-sm">
                </div>
                <div v-if="availableModels.length > 0">
                    <label class="block text-sm font-medium text-gray-700">Llama.cpp Model</label>
                    <select v-model="modelValue.llamacpp_model" required class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md shadow-sm">
                        <option v-for="m in availableModels" :key="m" :value="m">{{ m }}</option>
                    </select>
                </div>
                <div v-else>
                    <label class="block text-sm font-medium text-gray-700">Llama.cpp Model</label>
                    <input v-model="modelValue.llamacpp_model" required class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md sm:text-sm">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700">API Timeout (seconds)</label>
                    <input type="number" v-model="modelValue.llamacpp_timeout" required min="30" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md sm:text-sm">
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700">Temperature</label>
                        <input type="number" step="0.05" min="0" max="2" v-model.number="modelValue.llamacpp_temperature" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md sm:text-sm">
                        <p class="mt-1 text-xs text-gray-500 italic">Default: 0.0 (deterministic). Use 0.6+ for reasoning models.</p>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700">Max Tokens</label>
                        <input type="number" min="1" placeholder="Backend default" v-model.number="modelValue.llamacpp_max_tokens" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md sm:text-sm">
                        <p class="mt-1 text-xs text-gray-500 italic">Maximum tokens to generate. Optional.</p>
                    </div>
                </div>

                <!-- Collapsible Llama.cpp Advanced Parameters -->
                <div class="pt-2">
                    <button type="button" @click="showLlamacppAdvanced = !showLlamacppAdvanced" class="flex items-center text-sm font-medium text-blue-600 hover:text-blue-800">
                        <span class="mr-1">{{ showLlamacppAdvanced ? '▾' : '▸' }}</span>
                        Advanced Model Parameters (JSON)
                    </button>
                    <div v-if="showLlamacppAdvanced" class="mt-2 space-y-2">
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-gray-500">Custom request parameters (e.g. top_p, presence_penalty)</span>
                            <div class="flex items-center space-x-2">
                                <span v-if="isLlamacppJsonValid" class="text-xs text-green-600 font-medium">Valid JSON</span>
                                <button type="button" :disabled="!isLlamacppJsonValid" @click="formatJson('llamacpp_extra_params')" class="px-2 py-0.5 text-xs border border-gray-300 rounded bg-white hover:bg-gray-50 text-gray-700 disabled:opacity-40">Format JSON</button>
                            </div>
                        </div>
                        <textarea v-model="modelValue.llamacpp_extra_params" rows="3" class="block w-full font-mono text-xs px-3 py-2 border rounded-md sm:text-sm" :class="llamacppParamsError ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'" placeholder='{"top_p": 0.95, "top_k": 40}'></textarea>
                        <p v-if="llamacppParamsError" class="text-xs text-red-600">{{ llamacppParamsError }}</p>
                    </div>
                </div>
            </div>
            <div class="mt-4">
                <label class="block text-sm font-medium text-gray-700">Custom Instructions</label>
                <textarea v-model="modelValue.custom_prompt" rows="4" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md sm:text-sm" placeholder="e.g. 'Use technical language' or 'Respond in German'"></textarea>
                <p class="mt-1 text-xs text-gray-500 italic">Additional guidance for the AI when generating titles and tags.</p>
            </div>
            
            <div class="mt-4">
                <label class="block text-sm font-medium text-gray-700">Max Retries</label>
                <input type="number" v-model="modelValue.max_retries" required min="1" max="10" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md sm:text-sm">
                <p class="mt-1 text-xs text-gray-500 italic">Number of attempts if the AI backend is busy or fails.</p>
            </div>
        </div>
    `
};
