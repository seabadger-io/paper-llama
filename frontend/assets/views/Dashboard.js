import { api } from '../api.js';
import LoadingSpinner from '../components/LoadingSpinner.js';

export default {
    template: `
    <div class="min-h-screen bg-gray-100">
        <nav class="bg-white border-b border-gray-200">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex justify-between h-16">
                    <div class="flex">
                        <div class="flex-shrink-0 flex items-center font-bold text-blue-600 text-lg">
                            Paper Llama
                        </div>
                        <div class="ml-6 flex items-center space-x-4">
                            <button @click="triggerProcessing" class="px-3 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 mr-4">Trigger Processing</button>
                            <button @click="tab = 'logs'" :class="tab === 'logs' ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:text-gray-700'" class="px-3 py-2 rounded-md text-sm font-medium">Activity Logs</button>
                            <button @click="tab = 'settings'" :class="tab === 'settings' ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:text-gray-700'" class="px-3 py-2 rounded-md text-sm font-medium">Settings</button>
                        </div>
                    </div>
                    <div class="flex items-center">
                        <button @click="logout" class="text-gray-500 hover:text-gray-700 px-3 py-2 rounded-md text-sm font-medium">Logout</button>
                    </div>
                </div>
            </div>
        </nav>

        <main class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
            <div v-if="loading"><loading-spinner/></div>
            <div v-else>
                <!-- Logs Tab -->
                <div v-if="tab === 'logs'" class="bg-white shadow overflow-hidden sm:rounded-md p-6">
                    <h2 class="text-lg leading-6 font-medium text-gray-900 mb-4">Recent Processing Activity</h2>
                    <div v-if="logs.length === 0" class="text-gray-500 text-sm py-4">No documents processed yet.</div>
                    <ul v-else class="divide-y divide-gray-200">
                        <li v-for="log in logs" :key="log.id" class="py-4">
                            <div class="flex space-x-3">
                                <div class="flex-1 space-y-1">
                                    <div class="flex items-center justify-between">
                                        <h3 class="text-sm font-medium text-gray-900">Document ID: {{ log.document_id }}</h3>
                                        <p class="text-sm text-gray-500">{{ new Date(log.changed_at).toLocaleString() }}</p>
                                    </div>
                                    <div class="text-sm text-gray-500 flex flex-col space-y-1">
                                        <div class="grid grid-cols-2 gap-4 bg-gray-50 p-3 rounded mt-2 text-xs sm:text-sm">
                                            <div class="min-w-0">
                                                <div class="font-semibold text-[10px] uppercase text-gray-400 mb-1">Before</div>
                                                <div class="truncate" :title="log.original_state?.title"><strong>Title:</strong> {{ log.original_state?.title || 'None' }}</div>
                                                <div class="truncate" :title="log.original_state?.correspondent"><strong>Corr:</strong> {{ log.original_state?.correspondent || 'None' }}</div>
                                                <div class="truncate" :title="log.original_state?.document_type"><strong>Type:</strong> {{ log.original_state?.document_type || 'None' }}</div>
                                                <div class="truncate" :title="log.original_state?.created"><strong>Date:</strong> {{ log.original_state?.created || 'None' }}</div>
                                                <div class="mt-1 line-clamp-2" :title="(log.original_state?.tags || []).join(', ')"><strong>Tags:</strong> {{ (log.original_state?.tags || []).join(', ') || 'None' }}</div>
                                            </div>
                                            <div class="min-w-0">
                                                <div class="font-semibold text-[10px] uppercase text-blue-400 mb-1">After</div>
                                                <div class="truncate" :title="log.new_state?.title"><strong>Title:</strong> {{ log.new_state?.title || 'None' }}</div>
                                                <div class="truncate" :title="log.new_state?.correspondent"><strong>Corr:</strong> {{ log.new_state?.correspondent || 'None' }}</div>
                                                <div class="truncate" :title="log.new_state?.document_type"><strong>Type:</strong> {{ log.new_state?.document_type || 'None' }}</div>
                                                <div class="truncate" :title="log.new_state?.created"><strong>Date:</strong> {{ log.new_state?.created || 'None' }}</div>
                                                <div class="mt-1 line-clamp-2" :title="(log.new_state?.tags || []).join(', ')"><strong>Tags:</strong> {{ (log.new_state?.tags || []).join(', ') || 'None' }}</div>
                                                <div v-if="log.new_state?.ai_processing_time_ms != null" class="mt-1 text-xs text-indigo-500 font-medium whitespace-nowrap"><strong>AI Time:</strong> {{ (log.new_state.ai_processing_time_ms / 1000).toFixed(1) }}s</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </li>
                    </ul>
                </div>

                <!-- Settings Tab -->
                <div v-if="tab === 'settings'" class="bg-white shadow sm:rounded-md p-6 max-w-2xl">
                    <h2 class="text-lg leading-6 font-medium text-gray-900 mb-4">Application Settings</h2>
                    <form @submit.prevent="saveSettings" class="space-y-4">
                        <div v-if="message" class="bg-green-50 text-green-700 p-3 rounded-md text-sm border border-green-200 flex justify-between">
                            {{ message }}
                            <button type="button" @click="message=''">x</button>
                        </div>
                        <div v-if="error" class="bg-red-50 text-red-500 p-3 rounded-md text-sm">{{ error }}</div>

                        <div>
                            <label class="block text-sm font-medium text-gray-700">Paperless URL</label>
                            <input v-model="settings.paperless_url" required class="mt-1 appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 sm:text-sm">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700">Paperless API Token</label>
                            <input type="password" v-model="settings.paperless_token" required class="mt-1 appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 sm:text-sm">
                            <button type="button" @click="testPaperless(false)" class="mt-2 px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none">Test Paperless Connection</button>
                            <div v-if="paperlessStatus" class="mt-2 text-sm text-green-600">{{ paperlessStatus }}</div>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700">Ollama API URL</label>
                            <div class="flex space-x-2">
                                <input v-model="settings.ollama_url" required class="mt-1 appearance-none rounded-md flex-1 block w-full px-3 py-2 border border-gray-300 sm:text-sm">
                                <button type="button" @click="fetchModels" class="mt-1 px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">Fetch Models</button>
                            </div>
                        </div>
                        <div v-if="availableModels.length > 0">
                            <label class="block text-sm font-medium text-gray-700">Ollama Model</label>
                            <select v-model="settings.ollama_model" required class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md">
                                <option v-for="m in availableModels" :key="m" :value="m">{{ m }}</option>
                            </select>
                        </div>
                        <div v-else>
                            <label class="block text-sm font-medium text-gray-700">Ollama Model</label>
                            <input v-model="settings.ollama_model" required class="mt-1 appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 sm:text-sm">
                        </div>
                        <div>
                            <span class="block text-sm font-medium text-gray-700 mb-2">AI Capabilities</span>
                            <div class="flex items-center mt-2">
                                <input id="set_update_title" type="checkbox" v-model="settings.update_title" class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded">
                                <label for="set_update_title" class="ml-2 block text-sm text-gray-900">Update Title</label>
                            </div>
                            <div class="flex items-center mt-2">
                                <input id="set_update_corr" type="checkbox" v-model="settings.update_correspondent" class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded">
                                <label for="set_update_corr" class="ml-2 block text-sm text-gray-900">Update Correspondent</label>
                            </div>
                            <div class="flex items-center mt-2">
                                <input id="set_update_type" type="checkbox" v-model="settings.update_document_type" class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded">
                                <label for="set_update_type" class="ml-2 block text-sm text-gray-900">Update Document Type</label>
                            </div>
                            <div class="flex items-center mt-2">
                                <input id="set_update_tags" type="checkbox" v-model="settings.update_tags" class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded">
                                <label for="set_update_tags" class="ml-2 block text-sm text-gray-900">Update Tags</label>
                            </div>
                            <div class="flex items-center mt-2">
                                <input id="set_update_created" type="checkbox" v-model="settings.update_creation_date" class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded">
                                <label for="set_update_created" class="ml-2 block text-sm text-gray-900">Update Creation Date</label>
                            </div>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700">Custom Instructions</label>
                            <p class="text-xs text-gray-500 mb-1">Optional. Add custom instructions for the AI prompt (e.g. "Be very concise").</p>
                            <textarea v-model="settings.custom_prompt" rows="3" class="mt-1 appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 sm:text-sm"></textarea>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700">Document Word Limit</label>
                            <p class="text-xs text-gray-500 mb-1">Max words to send to AI (0 = unlimited).</p>
                            <input type="number" v-model="settings.document_word_limit" min="0" required class="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 sm:text-sm">
                        </div>

                        <div>
                            <label class="block text-sm font-medium text-gray-700">Schedule Interval (minutes)</label>
                            <p class="text-xs text-gray-500 mb-1">0 to disable.</p>
                            <input type="number" v-model="settings.schedule_interval_minutes" min="0" required class="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 sm:text-sm">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700">Query Tag</label>
                            <select v-model="settings.query_tag_id" class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md">
                                <option :value="null">None</option>
                                <option v-for="t in availableTags" :key="t.id" :value="t.id">{{ t.name }}</option>
                            </select>
                        </div>
                        <div class="flex items-center mt-2 mb-4">
                            <input id="dash_remove_query_tag" type="checkbox" v-model="settings.remove_query_tag" class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded">
                            <label for="dash_remove_query_tag" class="ml-2 block text-sm text-gray-900">Remove query tag after processing</label>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700">Force Process Tag</label>
                            <select v-model="settings.force_process_tag_id" class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md">
                                <option :value="null">None</option>
                                <option v-for="t in availableTags" :key="t.id" :value="t.id">{{ t.name }}</option>
                            </select>
                        </div>

                        <div>
                            <button type="submit" class="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700">
                                Save Settings
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </main>
    </div>`,
    components: { LoadingSpinner },
    data() {
        return { tab: 'logs', logs: [], settings: {}, availableModels: [], availableTags: [], loading: true, error: '', message: '', paperlessStatus: '', logInterval: null }
    },
    async mounted() {
        await this.loadData();
        this.logInterval = setInterval(() => {
            if (this.tab === 'logs') {
                this.refreshLogs();
            }
        }, 15000);
    },
    unmounted() {
        if (this.logInterval) {
            clearInterval(this.logInterval);
        }
    },
    methods: {
        async refreshLogs() {
            try {
                this.logs = await api.getLogs();
            } catch (e) {
                if (e.message !== 'Unauthorized') {
                    console.error('Background log refresh failed:', e);
                }
            }
        },
        async loadData() {
            try {
                this.loading = true;
                this.error = "";
                const [logData, settingData] = await Promise.all([
                    api.getLogs(),
                    api.getSettings()
                ]);
                this.logs = logData;
                this.settings = settingData;
                await this.fetchModels(false);
                if (this.settings.paperless_url && this.settings.paperless_token) {
                    await this.testPaperless(true);
                }
            } catch (e) {
                if (e.message !== 'Unauthorized') {
                    this.error = 'Failed to load data: ' + e.message;
                }
            } finally {
                this.loading = false;
            }
        },
        async testPaperless(silent = false) {
            try {
                if (!silent) {
                    this.error = '';
                    this.paperlessStatus = '';
                }
                const res = await api.testPaperless({
                    paperless_url: this.settings.paperless_url,
                    paperless_token: this.settings.paperless_token
                });
                this.availableTags = res.tags || [];
                
                let tagsMissing = false;
                if (this.settings.query_tag_id && !this.availableTags.some(t => t.id === this.settings.query_tag_id)) {
                    tagsMissing = true;
                    this.settings.query_tag_id = null;
                }
                if (this.settings.force_process_tag_id && !this.availableTags.some(t => t.id === this.settings.force_process_tag_id)) {
                    tagsMissing = true;
                    this.settings.force_process_tag_id = null;
                }
                
                if (!silent) {
                    this.paperlessStatus = `Connection successful! Found ${res.tags_count} tags.`;
                }
                
                if (tagsMissing) {
                    this.error = "Warning: One or more configured tags no longer exist in Paperless. Please update your settings.";
                }
            } catch (e) {
                if (!silent) this.error = 'Paperless connection failed: ' + e.message;
            }
        },
        async fetchModels(showError = true) {
            if (!this.settings.ollama_url) return;
            try {
                this.error = '';
                const res = await api.testOllama({ ollama_url: this.settings.ollama_url });
                this.availableModels = res.models;
            } catch (e) {
                if (showError) this.error = 'Failed to fetch models: ' + e.message;
            }
        },
        async triggerProcessing() {
            try {
                await api.triggerProcessing();
                alert('Processing triggered! Check the logs in a few moments to see results.');
            } catch (e) {
                alert('Failed to trigger processing: ' + e.message);
            }
        },
        async saveSettings() {
            try {
                this.error = '';
                this.message = '';
                await api.updateSettings(this.settings);
                this.message = 'Settings updated successfully.';
            } catch (e) {
                this.error = 'Failed to update settings: ' + e.message;
            }
        },
        logout() {
            localStorage.removeItem('token');
            this.$router.push('/login');
        }
    }
};
