import PaperlessSettings from './PaperlessSettings.js';
import AIBackendSettings from './AIBackendSettings.js';
import CapabilitiesSettings from './CapabilitiesSettings.js';
import MetadataPermissionsSettings from './MetadataPermissionsSettings.js';
import DocumentQuerySettings from './DocumentQuerySettings.js';
import LoggingSettings from './LoggingSettings.js';

export default {
    name: 'SettingsView',
    props: {
        modelValue: { type: Object, required: true },
        availableModels: { type: Array, default: () => [] },
        availableTags: { type: Array, default: () => [] },
        availableUsers: { type: Array, default: () => [] },
        availableGroups: { type: Array, default: () => [] },
        paperlessStatus: { type: String, default: '' },
        message: { type: String, default: '' },
        error: { type: String, default: '' }
    },
    emits: [
        'update:modelValue',
        'update:message',
        'update:error',
        'save',
        'test-paperless',
        'fetch-models'
    ],
    components: {
        'paperless-settings': PaperlessSettings,
        'ai-backend-settings': AIBackendSettings,
        'capabilities-settings': CapabilitiesSettings,
        'metadata-permissions-settings': MetadataPermissionsSettings,
        'document-query-settings': DocumentQuerySettings,
        'logging-settings': LoggingSettings
    },
    computed: {
        paperlessError() {
            if (!this.error) return '';
            const lower = this.error.toLowerCase();
            if (lower.includes('paperless') || lower.includes('tags no longer exist')) {
                return this.error;
            }
            return '';
        },
        aiBackendError() {
            if (!this.error) return '';
            const lower = this.error.toLowerCase();
            if (lower.includes('models') || lower.includes('ollama') || lower.includes('llama')) {
                return this.error;
            }
            return '';
        }
    },
    watch: {
        error(newVal) {
            if (newVal) {
                this.$nextTick(() => {
                    const el =
                        this.$el && this.$el.querySelector
                            ? this.$el.querySelector('.error-banner')
                            : null;
                    if (el && typeof el.scrollIntoView === 'function') {
                        try {
                            el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                        } catch {
                            // ignore in environments without smooth scroll
                        }
                    }
                });
            }
        }
    },
    template: `
        <div class="bg-white shadow sm:rounded-md p-6 max-w-2xl relative">
            <h2 class="text-lg leading-6 font-medium text-gray-900 mb-4">Application Settings</h2>

            <!-- Floating / Sticky Feedback Messages at the Top -->
            <div v-if="error" class="error-banner sticky top-4 z-20 bg-red-50 text-red-700 p-4 rounded-md text-sm border-l-4 border-red-500 flex items-start justify-between shadow-md mb-6 transition-all duration-200">
                <div class="flex items-start space-x-2">
                    <svg class="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                    </svg>
                    <span class="font-medium break-words">{{ error }}</span>
                </div>
                <button type="button" @click="$emit('update:error', '')" class="text-red-400 hover:text-red-600 focus:outline-none ml-4 font-bold text-base leading-none" title="Dismiss error">&times;</button>
            </div>

            <div v-if="message" class="message-banner sticky top-4 z-20 bg-green-50 text-green-700 p-4 rounded-md text-sm border-l-4 border-green-500 flex items-start justify-between shadow-md mb-6 transition-all duration-200">
                <div class="flex items-start space-x-2">
                    <svg class="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                    </svg>
                    <span class="font-medium break-words">{{ message }}</span>
                </div>
                <button type="button" @click="$emit('update:message', '')" class="text-green-400 hover:text-green-600 focus:outline-none ml-4 font-bold text-base leading-none" title="Dismiss message">&times;</button>
            </div>

            <form @submit.prevent="$emit('save')" class="space-y-6">
                <!-- Paperless Section -->
                <paperless-settings 
                    v-model="modelValue" 
                    :paperless-status="paperlessStatus" 
                    :error="paperlessError"
                    :available-tags="availableTags"
                    @test="$emit('test-paperless')"
                />
                
                <!-- AI Backend Section -->
                <div class="border-t border-gray-100 pt-6">
                    <ai-backend-settings 
                        v-model="modelValue" 
                        :available-models="availableModels"
                        :error="aiBackendError"
                        @fetch-models="(b) => $emit('fetch-models', b)"
                    />
                </div>
                
                <!-- AI Capabilities Section -->
                <div class="border-t border-gray-100 pt-6">
                    <capabilities-settings 
                        v-model="modelValue" 
                        :available-tags="availableTags"
                    />
                </div>
                
                <!-- Metadata Permissions Section -->
                <div class="border-t border-gray-100 pt-6">
                    <metadata-permissions-settings 
                        v-model="modelValue" 
                        :available-users="availableUsers" 
                        :available-groups="availableGroups"
                    />
                </div>

                <!-- Document Query & Scheduling Section -->
                <div class="border-t border-gray-100 pt-6">
                    <document-query-settings 
                        v-model="modelValue" 
                        :available-tags="availableTags"
                    />
                </div>

                <!-- Logging & Retention Section -->
                <div class="border-t border-gray-100 pt-6" id="logging-settings">
                    <logging-settings 
                        v-model="modelValue" 
                    />
                </div>

                <!-- Bottom feedback for general / save actions -->
                <div v-if="error && !paperlessError && !aiBackendError" class="bg-red-50 text-red-500 p-3 rounded-md text-sm border border-red-200 flex justify-between items-center">
                    <span>{{ error }}</span>
                    <button type="button" @click="$emit('update:error', '')" class="text-red-400 hover:text-red-600 focus:outline-none ml-2 font-bold">&times;</button>
                </div>

                <div class="pt-4 flex justify-center">
                    <button type="submit" class="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 font-bold uppercase tracking-wide">
                        Save All Settings
                    </button>
                </div>
            </form>
        </div>
    `
};
