export default {
    name: 'AIBackendSettings',
    props: {
        modelValue: { type: Object, required: true },
        availableModels: { type: Array, default: () => [] }
    },
    emits: ['update:modelValue', 'fetch-models'],
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
                    <label class="block text-sm font-medium text-gray-700">API Timeout (seconds)</label>
                    <input type="number" v-model="modelValue.ollama_timeout" required min="30" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md sm:text-sm">
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
