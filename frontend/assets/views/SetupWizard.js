import { api } from '../api.js';
import { settingsMixin } from '../mixins/settingsMixin.js';
import PaperlessSettings from '../components/PaperlessSettings.js';
import AIBackendSettings from '../components/AIBackendSettings.js';
import CapabilitiesSettings from '../components/CapabilitiesSettings.js';
import MetadataPermissionsSettings from '../components/MetadataPermissionsSettings.js';
import DocumentQuerySettings from '../components/DocumentQuerySettings.js';

export default {
    components: {
        'paperless-settings': PaperlessSettings,
        'ai-backend-settings': AIBackendSettings,
        'capabilities-settings': CapabilitiesSettings,
        'metadata-permissions-settings': MetadataPermissionsSettings,
        'document-query-settings': DocumentQuerySettings
    },
    mixins: [settingsMixin],
    template: `
    <div class="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div class="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-lg border border-gray-100">
            <div>
                <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">Initial Setup</h2>
                <p class="mt-2 text-center text-sm text-gray-600">Configure Paper Llama for the first time</p>
            </div>
            
            <form class="mt-8 space-y-6" @submit.prevent="submitSetup">
                <div v-if="error" class="bg-red-50 text-red-500 p-3 rounded-md text-sm border border-red-200">{{ error }}</div>
                
                <!-- Admin Credentials -->
                <div class="pb-4">
                    <h3 class="text-lg font-medium text-gray-900 mb-4">Admin Account</h3>
                    <div class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700">Username</label>
                            <input v-model="settings.username" required class="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700">Password</label>
                            <input type="password" v-model="settings.password" required class="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700">Confirm Password</label>
                            <input type="password" v-model="confirm_password" required class="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm">
                            <p v-if="settings.password !== confirm_password && confirm_password" class="mt-1 text-sm text-red-600">Passwords do not match.</p>
                        </div>
                    </div>
                </div>

                <!-- Paperless Section -->
                <div class="border-t border-gray-100 pt-6">
                    <paperless-settings 
                        v-model="settings" 
                        :paperless-status="paperlessStatus" 
                        :available-tags="availableTags"
                        @test="testPaperless(false)"
                    />
                </div>
                
                <!-- AI Backend Section -->
                <div class="border-t border-gray-100 pt-6">
                    <ai-backend-settings 
                        v-model="settings" 
                        :available-models="availableModels"
                        @fetch-models="(b) => fetchModels(b)"
                    />
                </div>
                
                <!-- AI Capabilities Section -->
                <div class="border-t border-gray-100 pt-6">
                    <capabilities-settings 
                        v-model="settings" 
                        :available-tags="availableTags"
                    />
                </div>
                
                <!-- Metadata Permissions Section -->
                <div class="border-t border-gray-100 pt-6">
                    <metadata-permissions-settings 
                        v-model="settings" 
                        :available-users="availableUsers" 
                        :available-groups="availableGroups"
                    />
                </div>

                <!-- Document Query & Scheduling Section -->
                <div class="border-t border-gray-100 pt-6">
                    <document-query-settings 
                        v-model="settings" 
                        :available-tags="availableTags"
                    />
                </div>

                <div>
                    <button type="submit" :disabled="loading || passwordMismatch" class="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white disabled:bg-indigo-300 bg-blue-600 hover:bg-blue-700 focus:outline-none">
                        <span v-if="loading">Saving...</span>
                        <span v-else>Complete Setup</span>
                    </button>
                </div>
            </form>
        </div>
    </div>`,
    data() {
        return {
            settings: {
                username: 'admin',
                password: '',
                paperless_url: '',
                paperless_token: '',
                ai_backend: 'ollama',
                ollama_url: 'http://localhost:11434',
                ollama_model: '',
                ollama_timeout: 300,
                llamacpp_url: 'http://localhost:8080',
                llamacpp_model: '',
                llamacpp_timeout: 300,
                max_retries: 3,
                update_title: true,
                update_correspondent: true,
                update_document_type: true,
                update_tags: true,
                max_tags: 5,
                generate_correspondent: false,
                generate_document_type: false,
                generate_tags: false,
                update_creation_date: false,
                custom_prompt: '',
                metadata_use_system_defaults: true,
                document_word_limit: 1500,
                schedule_interval_minutes: 5,
                remove_query_tag: true,
                metadata_owner_id: null,
                metadata_view_users: [],
                metadata_view_groups: [],
                metadata_edit_users: [],
                metadata_edit_groups: []
            },
            confirm_password: '',
            availableModels: [],
            availableTags: [],
            availableUsers: [],
            availableGroups: [],
            paperlessStatus: '',
            error: '',
            loading: false
        };
    },
    computed: {
        passwordMismatch() {
            return this.settings.password !== this.confirm_password && this.confirm_password !== '';
        }
    },
    methods: {
        async submitSetup() {
            if (this.passwordMismatch) return;
            try {
                this.loading = true;
                this.error = '';
                await api.runSetup(this.settings);
                this.$router.push('/login');
            } catch (e) {
                this.error = 'Setup failed: ' + e.message;
            } finally {
                this.loading = false;
            }
        }
    }
};
