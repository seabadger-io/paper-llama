import { api } from '../api.js';

export default {
    name: 'LoggingSettings',
    props: {
        modelValue: { type: Object, required: true }
    },
    emits: ['update:modelValue'],
    data() {
        return {
            cleaning: false,
            cleanupResult: '',
            cleanupError: ''
        };
    },
    methods: {
        async runCleanup() {
            try {
                this.cleaning = true;
                this.cleanupResult = '';
                this.cleanupError = '';
                const res = await api.runLogCleanup();
                this.cleanupResult = `Cleanup complete: pruned ${res.deleted_logs} log(s), compacted ${res.compacted_logs} log(s).`;
            } catch (e) {
                this.cleanupError = 'Failed to run cleanup: ' + e.message;
            } finally {
                this.cleaning = false;
            }
        }
    },
    template: `
        <div class="space-y-4">
            <h3 class="text-lg font-medium text-gray-900 mb-1">Logging & Retention</h3>
            <p class="text-xs text-gray-500 mb-4">Control how AI prompts and responses are stored in the changelog, and configure automatic log retention and compaction to prevent database bloat.</p>
            
            <div class="space-y-4">
                <!-- Log AI Prompts & Responses Toggle -->
                <div class="flex items-start">
                    <div class="flex items-center h-5">
                        <input 
                            id="log_ai_interactions" 
                            type="checkbox" 
                            v-model="modelValue.log_ai_interactions" 
                            class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        >
                    </div>
                    <div class="ml-3 text-sm">
                        <label for="log_ai_interactions" class="font-medium text-gray-700">Log AI Prompts & Responses</label>
                        <p class="text-xs text-gray-500">Record full AI prompts and responses in the changelog for inspecting classification and debugging.</p>
                    </div>
                </div>

                <!-- Max Characters limit (visible if log_ai_interactions is checked) -->
                <div v-if="modelValue.log_ai_interactions">
                    <label class="block text-sm font-medium text-gray-700">Max AI Interaction Characters</label>
                    <input 
                        type="number" 
                        min="0" 
                        step="500"
                        v-model.number="modelValue.log_max_ai_chars" 
                        class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md sm:text-sm"
                        placeholder="0 for unlimited"
                    >
                    <p class="mt-1 text-xs text-gray-500 italic">Limits stored character size of prompt and response texts. Set to 0 for unlimited / full text.</p>
                </div>

                <!-- Log Retention Period -->
                <div>
                    <label class="block text-sm font-medium text-gray-700">Log Retention Period (Days)</label>
                    <input 
                        type="number" 
                        min="0" 
                        step="1"
                        v-model.number="modelValue.log_retention_days" 
                        class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md sm:text-sm"
                    >
                    <p class="mt-1 text-xs text-gray-500 italic">Automatically delete document changelog entries older than this many days. Set to 0 to keep entries indefinitely.</p>
                </div>

                <!-- Log Compaction Period -->
                <div>
                    <label class="block text-sm font-medium text-gray-700">Log Compaction Period (Days)</label>
                    <input 
                        type="number" 
                        min="0" 
                        step="1"
                        v-model.number="modelValue.log_compact_after_days" 
                        class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md sm:text-sm"
                    >
                    <p class="mt-1 text-xs text-gray-500 italic">Remove stored prompt and response texts from entries older than this many days while keeping titles, tags, and audit history. Set to 0 to never compact.</p>
                </div>

                <!-- Manual Maintenance Action -->
                <div class="pt-2 border-t border-gray-100">
                    <div class="flex items-center justify-between">
                        <div>
                            <div class="text-sm font-medium text-gray-800">Manual Log Maintenance</div>
                            <p class="text-xs text-gray-500">Run retention pruning and prompt compaction immediately.</p>
                        </div>
                        <button 
                            type="button" 
                            :disabled="cleaning"
                            @click="runCleanup" 
                            class="px-3 py-1.5 border border-gray-300 rounded-md shadow-sm text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                        >
                            {{ cleaning ? 'Running...' : 'Run Maintenance Now' }}
                        </button>
                    </div>
                    <div v-if="cleanupResult" class="mt-2 text-xs text-green-700 bg-green-50 p-2 rounded border border-green-200">
                        {{ cleanupResult }}
                    </div>
                    <div v-if="cleanupError" class="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded border border-red-200">
                        {{ cleanupError }}
                    </div>
                </div>
            </div>
        </div>
    `
};
