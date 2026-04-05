import PaperlessSettings from './PaperlessSettings.js';
import AIBackendSettings from './AIBackendSettings.js';
import CapabilitiesSettings from './CapabilitiesSettings.js';
import MetadataPermissionsSettings from './MetadataPermissionsSettings.js';
import DocumentQuerySettings from './DocumentQuerySettings.js';

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
    emits: ['update:modelValue', 'save', 'test-paperless', 'fetch-models'],
    components: {
        'paperless-settings': PaperlessSettings,
        'ai-backend-settings': AIBackendSettings,
        'capabilities-settings': CapabilitiesSettings,
        'metadata-permissions-settings': MetadataPermissionsSettings,
        'document-query-settings': DocumentQuerySettings
    },
    template: `
        <div class="bg-white shadow sm:rounded-md p-6 max-w-2xl">
            <h2 class="text-lg leading-6 font-medium text-gray-900 mb-4">Application Settings</h2>
            <form @submit.prevent="$emit('save')" class="space-y-6">
                <!-- Paperless Section -->
                <paperless-settings 
                    v-model="modelValue" 
                    :paperless-status="paperlessStatus" 
                    :available-tags="availableTags"
                    @test="$emit('test-paperless')"
                />
                
                <!-- AI Backend Section -->
                <div class="border-t border-gray-100 pt-6">
                    <ai-backend-settings 
                        v-model="modelValue" 
                        :available-models="availableModels"
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

                <!-- Feedback Messages -->
                <div v-if="message" class="bg-green-50 text-green-700 p-3 rounded-md text-sm border border-green-200 flex justify-between">
                    {{ message }}
                    <button type="button" @click="$emit('update:message', '')">x</button>
                </div>
                <div v-if="error" class="bg-red-50 text-red-500 p-3 rounded-md text-sm border border-red-200">{{ error }}</div>

                <div class="pt-4 flex justify-center">
                    <button type="submit" class="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 font-bold uppercase tracking-wide">
                        Save All Settings
                    </button>
                </div>
            </form>
        </div>
    `
};
