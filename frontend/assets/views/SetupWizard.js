import { api } from '../api.js';

export default {
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
                <div class="border-b border-gray-200 pb-4">
                    <h3 class="text-lg font-medium text-gray-900 mb-4">Admin Account</h3>
                    <div class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700">Username</label>
                            <input v-model="form.username" required class="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700">Password</label>
                            <input type="password" v-model="form.password" required class="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700">Confirm Password</label>
                            <input type="password" v-model="confirm_password" required class="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm">
                            <p v-if="form.password !== confirm_password && confirm_password" class="mt-1 text-sm text-red-600">Passwords do not match.</p>
                        </div>
                    </div>
                </div>

                <!-- Paperless Config -->
                <div class="border-b border-gray-200 pb-4">
                    <h3 class="text-lg font-medium text-gray-900 mb-4">Paperless NGX</h3>
                    <div class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700">Base URL (e.g. http://192.168.1.100:8000)</label>
                            <input v-model="form.paperless_url" required class="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700">API Token</label>
                            <input type="password" v-model="form.paperless_token" required class="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm">
                        </div>
                        <button type="button" @click="testPaperless" class="w-full justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none">Test Paperless Connection</button>
                        <div v-if="paperlessStatus" class="text-sm text-green-600">{{ paperlessStatus }}</div>
                    </div>
                </div>

                <!-- AI Backend Selection -->
                <div class="border-b border-gray-200 pb-4">
                    <h3 class="text-lg font-medium text-gray-900 mb-4">AI Backend</h3>
                    <div class="flex space-x-4 mb-4">
                        <label class="flex items-center">
                            <input type="radio" v-model="form.ai_backend" value="ollama" class="text-blue-600 focus:ring-blue-500">
                            <span class="ml-2 text-sm text-gray-700">Ollama</span>
                        </label>
                        <label class="flex items-center">
                            <input type="radio" v-model="form.ai_backend" value="llamacpp" class="text-blue-600 focus:ring-blue-500">
                            <span class="ml-2 text-sm text-gray-700">Llama.cpp</span>
                        </label>
                    </div>

                    <!-- Ollama Config -->
                    <div v-if="form.ai_backend === 'ollama'" class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700">Ollama API URL (e.g. http://localhost:11434)</label>
                            <input v-model="form.ollama_url" required class="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700">API Timeout (seconds)</label>
                            <p class="text-xs text-gray-500 mb-1">Maximum time to wait for the AI to respond.</p>
                            <input type="number" v-model="form.ollama_timeout" required min="30" class="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700">Max Retries</label>
                            <p class="text-xs text-gray-500 mb-1">Number of retries per cycle if saving fails.</p>
                            <input type="number" v-model="form.max_retries" required min="1" max="10" class="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm">
                        </div>
                        <button type="button" @click="fetchModels('ollama')" class="w-full justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none">Test & Fetch Models</button>
                        
                        <div v-if="availableModels.length > 0">
                            <label class="block text-sm font-medium text-gray-700">Select Model</label>
                            <select v-model="form.ollama_model" required class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md">
                                <option v-for="m in availableModels" :key="m" :value="m">{{ m }}</option>
                            </select>
                        </div>
                    </div>

                    <!-- Llama.cpp Config -->
                    <div v-if="form.ai_backend === 'llamacpp'" class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700">Llama.cpp API URL (e.g. http://localhost:8080)</label>
                            <input v-model="form.llamacpp_url" required class="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700">API Timeout (seconds)</label>
                            <p class="text-xs text-gray-500 mb-1">Maximum time to wait for the AI to respond.</p>
                            <input type="number" v-model="form.llamacpp_timeout" required min="30" class="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700">Max Retries</label>
                            <p class="text-xs text-gray-500 mb-1">Number of retries per cycle if saving fails.</p>
                            <input type="number" v-model="form.max_retries" required min="1" max="10" class="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm">
                        </div>
                        <button type="button" @click="fetchModels('llamacpp')" class="w-full justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none">Test & Fetch Models</button>
                        
                        <div v-if="availableModels.length > 0">
                            <label class="block text-sm font-medium text-gray-700">Select Model</label>
                            <select v-model="form.llamacpp_model" required class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md">
                                <option v-for="m in availableModels" :key="m" :value="m">{{ m }}</option>
                            </select>
                        </div>
                    </div>
                </div>

                <!-- App Config -->
                <div>
                    <h3 class="text-lg font-medium text-gray-900 mb-4">Processing Settings</h3>
                    <div class="space-y-4">
                        <div>
                            <span class="block text-sm font-medium text-gray-700 mb-2">AI Capabilities</span>
                            <div class="flex items-center mt-2">
                                <input id="wiz_update_title" type="checkbox" v-model="form.update_title" class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded">
                                <label for="wiz_update_title" class="ml-2 block text-sm text-gray-900">Update Title</label>
                            </div>
                            <div class="flex items-center mt-2">
                                <input id="wiz_update_corr" type="checkbox" v-model="form.update_correspondent" class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded">
                                <label for="wiz_update_corr" class="ml-2 block text-sm text-gray-900">Update Correspondent</label>
                            </div>
                            <div class="flex items-center mt-2">
                                <input id="wiz_update_type" type="checkbox" v-model="form.update_document_type" class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded">
                                <label for="wiz_update_type" class="ml-2 block text-sm text-gray-900">Update Document Type</label>
                            </div>
                            <div class="flex items-center mt-2">
                                <input id="wiz_update_tags" type="checkbox" v-model="form.update_tags" class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded">
                                <label for="wiz_update_tags" class="ml-2 block text-sm text-gray-900">Update Tags</label>
                                <div v-if="form.update_tags" class="ml-4 flex items-center">
                                    <label for="wiz_max_tags" class="mr-2 text-xs text-gray-600">Maximum number of tags to assign:</label>
                                    <input id="wiz_max_tags" type="number" v-model="form.max_tags" min="1" max="50" class="w-16 px-2 py-1 text-xs border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500">
                                </div>
                            </div>
                            <div class="flex items-center mt-2">
                                <input id="wiz_update_created" type="checkbox" v-model="form.update_creation_date" class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded">
                                <label for="wiz_update_created" class="ml-2 block text-sm text-gray-900">Update Creation Date</label>
                            </div>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700">Custom Instructions</label>
                            <p class="text-xs text-gray-500 mb-1">Optional. Add custom instructions for the AI prompt (e.g. "Be very concise").</p>
                            <textarea v-model="form.custom_prompt" rows="3" class="mt-1 appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 sm:text-sm"></textarea>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700">Document Word Limit</label>
                            <p class="text-xs text-gray-500 mb-1">Max words to send to AI (0 = unlimited).</p>
                            <input type="number" v-model="form.document_word_limit" required min="0" class="appearance-none rounded-md flex-1 block w-full px-3 py-2 border border-gray-300 sm:text-sm">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700">Schedule Interval (minutes)</label>
                            <p class="text-xs text-gray-500 mb-1">Set to 0 to disable background scheduling (trigger processing manually or via webhook only).</p>
                            <input type="number" v-model="form.schedule_interval_minutes" required min="0" class="appearance-none rounded-md flex-1 block w-full px-3 py-2 border border-gray-300 sm:text-sm">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700">Query Tag</label>
                            <p class="text-xs text-gray-500 mb-1">Tag used to poll for unprocessed documents.</p>
                            <select v-model="form.query_tag_id" class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md">
                                <option :value="null">None</option>
                                <option v-for="t in availableTags" :key="t.id" :value="t.id">{{ t.name }}</option>
                            </select>
                        </div>
                        <div class="flex items-center mt-2 mb-4">
                            <input id="wiz_remove_query_tag" type="checkbox" v-model="form.remove_query_tag" class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded">
                            <label for="wiz_remove_query_tag" class="ml-2 block text-sm text-gray-900">Remove query tag after processing</label>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700">Force Process Tag</label>
                            <p class="text-xs text-gray-500 mb-1">Tag that forces processing of a document even if it was previously processed.</p>
                            <select v-model="form.force_process_tag_id" class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md">
                                <option :value="null">None</option>
                                <option v-for="t in availableTags" :key="t.id" :value="t.id">{{ t.name }}</option>
                            </select>
                        </div>
                    </div>
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
            form: {
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
                update_creation_date: false,
                custom_prompt: '',
                document_word_limit: 1500,
                schedule_interval_minutes: 5,
                remove_query_tag: true
            },
            confirm_password: '',
            availableModels: [],
            availableTags: [],
            paperlessStatus: '',
            error: '',
            loading: false
        };
    },
    computed: {
        passwordMismatch() {
            return this.form.password !== this.confirm_password && this.confirm_password !== '';
        }
    },
    methods: {
        async fetchModels(backend) {
            try {
                this.error = '';
                this.availableModels = [];
                let res;
                if (backend === 'llamacpp') {
                    res = await api.testLlamacpp({ llamacpp_url: this.form.llamacpp_url });
                    this.availableModels = res.models;
                    if (this.availableModels.length > 0) {
                        this.form.llamacpp_model = this.availableModels[0];
                    }
                } else {
                    res = await api.testOllama({ ollama_url: this.form.ollama_url });
                    this.availableModels = res.models;
                    if (this.availableModels.length > 0) {
                        this.form.ollama_model = this.availableModels[0];
                    }
                }
            } catch (e) {
                this.error = 'Failed to fetch models: ' + e.message;
            }
        },
        async testPaperless() {
            try {
                this.error = '';
                this.paperlessStatus = '';
                const res = await api.testPaperless({
                    paperless_url: this.form.paperless_url,
                    paperless_token: this.form.paperless_token
                });
                this.availableTags = res.tags || [];
                this.paperlessStatus = `Connection successful! Found ${res.tags_count} tags.`;
            } catch (e) {
                this.error = 'Paperless connection failed: ' + e.message;
            }
        },
        async submitSetup() {
            if (this.passwordMismatch) return;
            try {
                this.loading = true;
                this.error = '';
                await api.runSetup(this.form);
                this.$router.push('/login');
            } catch (e) {
                this.error = 'Setup failed: ' + e.message;
            } finally {
                this.loading = false;
            }
        }
    }
};
