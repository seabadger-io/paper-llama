import { settingsMixin } from '../mixins/settingsMixin.js';

export default {
    name: 'PaperlessSettings',
    props: {
        modelValue: { type: Object, required: true },
        paperlessStatus: { type: String, default: '' },
        error: { type: String, default: '' },
        availableTags: { type: Array, default: () => [] }
    },
    emits: ['update:modelValue', 'test'],
    mixins: [settingsMixin],
    template: `
        <div class="space-y-4">
            <h3 class="text-lg font-medium text-gray-900 mb-4">Paperless NGX</h3>
            <div>
                <label class="block text-sm font-medium text-gray-700">Base URL</label>
                <input v-model="modelValue.paperless_url" required class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md sm:text-sm">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700">API Token</label>
                <input type="password" v-model="modelValue.paperless_token" required class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md sm:text-sm">
            </div>
            <button type="button" @click="$emit('test')" class="w-full justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">Test Paperless Connection</button>
            <div v-if="paperlessStatus" class="mt-2 text-sm text-green-700 bg-green-50 p-2.5 rounded-md border border-green-200 flex items-start space-x-2">
                <svg class="h-4 w-4 mt-0.5 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                </svg>
                <span class="break-words">{{ paperlessStatus }}</span>
            </div>
            <div v-if="error" class="mt-2 text-sm text-red-600 bg-red-50 p-2.5 rounded-md border border-red-200 flex items-start space-x-2">
                <svg class="h-4 w-4 mt-0.5 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                </svg>
                <span class="break-words">{{ error }}</span>
            </div>
        </div>
    `
};
