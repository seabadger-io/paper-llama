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
            <div v-if="paperlessStatus" class="text-sm text-green-600">{{ paperlessStatus }}</div>
        </div>
    `
};
