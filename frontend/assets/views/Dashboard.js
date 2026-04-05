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
                    <div v-if="processingDocs.length > 0" class="mb-6">
                        <h2 class="text-lg leading-6 font-medium text-blue-800 mb-2 flex items-center">
                            <svg class="animate-spin -ml-1 mr-2 h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Currently Processing
                        </h2>
                        <ul class="divide-y divide-blue-200 border border-blue-200 rounded-md bg-blue-50">
                            <li v-for="doc in processingDocs" :key="doc.document_id" class="px-4 py-3 flex justify-between items-center">
                                <span class="text-sm font-medium text-blue-900">Document ID: {{ doc.document_id }}</span>
                                <span class="text-xs text-blue-700">Started: {{ formatDate(doc.started_at) }}</span>
                            </li>
                        </ul>
                    </div>

                    <h2 class="text-lg leading-6 font-medium text-gray-900 mb-4">Recent Processing Activity</h2>
                    <div v-if="logs.length === 0" class="text-gray-500 text-sm py-4">No documents processed yet.</div>
                    <ul v-else class="divide-y divide-gray-200">
                        <li v-for="log in logs" :key="log.id" class="py-4">
                            <div class="flex space-x-3">
                                <div class="flex-1 space-y-1">
                                    <div class="flex items-center justify-between">
                                        <h3 class="text-sm font-semibold text-gray-900">
                                            {{ log.original_state?.title || 'Document ' + log.document_id }}
                                            <span class="text-[10px] font-normal text-gray-400 ml-2">#{{ log.document_id }}</span>
                                        </h3>
                                        <p class="text-xs text-gray-500 font-medium">{{ formatDate(log.changed_at) }}</p>
                                    </div>
                                    <div class="text-sm text-gray-500 flex flex-col space-y-1">
                                        <!-- Success State: Before/After Grid -->
                                        <div v-if="!log.new_state?.error" class="grid grid-cols-2 gap-4 bg-gray-50 p-3 rounded mt-2 text-xs sm:text-sm border-l-4 border-blue-400">
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
                                                <div class="truncate" :title="log.new_state?.correspondent">
                                                    <strong>Corr: </strong>
                                                    <span :class="{ 'text-green-600 bg-green-50 px-1 rounded': log.new_state?.ai_generated?.correspondent }">
                                                        {{ log.new_state?.correspondent || 'None' }}
                                                    </span>
                                                    <span v-if="log.new_state?.ai_generated?.correspondent" title="AI Generated" class="ml-1 text-xs">✨</span>
                                                </div>
                                                <div class="truncate mt-1" :title="log.new_state?.document_type">
                                                    <strong>Type: </strong>
                                                    <span :class="{ 'text-green-600 bg-green-50 px-1 rounded': log.new_state?.ai_generated?.document_type }">
                                                        {{ log.new_state?.document_type || 'None' }}
                                                    </span>
                                                    <span v-if="log.new_state?.ai_generated?.document_type" title="AI Generated" class="ml-1 text-xs">✨</span>
                                                </div>
                                                <div class="truncate mt-1" :title="log.new_state?.created"><strong>Date:</strong> {{ log.new_state?.created || 'None' }}</div>
                                                <div class="mt-1 line-clamp-2" :title="(log.new_state?.tags || []).join(', ')">
                                                    <strong>Tags: </strong>
                                                    <span v-if="log.new_state?.tags?.length">
                                                        <span v-for="(tag, index) in log.new_state.tags" :key="index">
                                                            <span :class="{ 'text-green-600 bg-green-50 px-1 rounded': log.new_state.ai_generated?.tags?.some(g => String(g) === tag.split(' (')[0]) }">
                                                                {{ tag }}
                                                            </span>
                                                            <span v-if="log.new_state.ai_generated?.tags?.some(g => String(g) === tag.split(' (')[0])" title="AI Generated" class="text-[10px] ml-0.5">✨</span>
                                                            {{ index < log.new_state.tags.length - 1 ? ', ' : '' }}
                                                        </span>
                                                    </span>
                                                    <span v-else>None</span>
                                                </div>
                                                <div v-if="log.new_state?.ai_processing_time_ms != null" class="mt-1 text-xs text-indigo-500 font-medium whitespace-nowrap"><strong>AI Time:</strong> {{ (log.new_state.ai_processing_time_ms / 1000).toFixed(1) }}s</div>
                                            </div>
                                        </div>

                                        <!-- Error State: Specialized Error Card -->
                                        <div v-if="log.new_state?.error" class="bg-red-50 p-3 rounded mt-2 text-xs sm:text-sm border-l-4 border-red-500">
                                            <div class="font-semibold text-[10px] uppercase text-red-600 mb-2 flex items-center">
                                                <svg class="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                                Processing Failed
                                            </div>
                                            <div class="bg-white/50 p-2 rounded border border-red-100 font-mono text-red-700 break-words mb-2">
                                                {{ log.new_state.error }}
                                            </div>
                                            <div class="flex items-center justify-between text-[10px] text-gray-500 font-medium">
                                                <span>Total Attempts: {{ log.new_state.attempts }}</span>
                                                <span class="bg-red-100 text-red-700 px-1.5 py-0.5 rounded uppercase">Retry Limit Reached</span>
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
                            <span class="block text-sm font-medium text-gray-700 mb-2">AI Backend</span>
                            <div class="flex space-x-4 mb-4">
                                <label class="flex items-center">
                                    <input type="radio" v-model="settings.ai_backend" value="ollama" class="text-blue-600 focus:ring-blue-500">
                                    <span class="ml-2 text-sm text-gray-700">Ollama</span>
                                </label>
                                <label class="flex items-center">
                                    <input type="radio" v-model="settings.ai_backend" value="llamacpp" class="text-blue-600 focus:ring-blue-500">
                                    <span class="ml-2 text-sm text-gray-700">Llama.cpp</span>
                                </label>
                            </div>
                        </div>

                        <!-- Ollama Config -->
                        <div v-if="settings.ai_backend === 'ollama'">
                            <div>
                                <label class="block text-sm font-medium text-gray-700">Ollama API URL</label>
                                <div class="flex space-x-2">
                                    <input v-model="settings.ollama_url" required class="mt-1 appearance-none rounded-md flex-1 block w-full px-3 py-2 border border-gray-300 sm:text-sm">
                                    <button type="button" @click="fetchModels(true, 'ollama')" class="mt-1 px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">Fetch Models</button>
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
                                <label class="block text-sm font-medium text-gray-700">API Timeout (seconds)</label>
                                <p class="text-xs text-gray-500 mb-1">Maximum time to wait for the AI to respond.</p>
                                <input type="number" v-model="settings.ollama_timeout" required min="30" class="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 sm:text-sm">
                            </div>
                        </div>

                        <!-- Llama.cpp Config -->
                        <div v-if="settings.ai_backend === 'llamacpp'">
                            <div>
                                <label class="block text-sm font-medium text-gray-700">Llama.cpp API URL</label>
                                <div class="flex space-x-2">
                                    <input v-model="settings.llamacpp_url" required class="mt-1 appearance-none rounded-md flex-1 block w-full px-3 py-2 border border-gray-300 sm:text-sm">
                                    <button type="button" @click="fetchModels(true, 'llamacpp')" class="mt-1 px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">Fetch Models</button>
                                </div>
                            </div>
                            <div v-if="availableModels.length > 0">
                                <label class="block text-sm font-medium text-gray-700">Llama.cpp Model</label>
                                <select v-model="settings.llamacpp_model" required class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md">
                                    <option v-for="m in availableModels" :key="m" :value="m">{{ m }}</option>
                                </select>
                            </div>
                            <div v-else>
                                <label class="block text-sm font-medium text-gray-700">Llama.cpp Model</label>
                                <input v-model="settings.llamacpp_model" required class="mt-1 appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 sm:text-sm">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700">API Timeout (seconds)</label>
                                <p class="text-xs text-gray-500 mb-1">Maximum time to wait for the AI to respond.</p>
                                <input type="number" v-model="settings.llamacpp_timeout" required min="30" class="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 sm:text-sm">
                            </div>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700">Max Retries</label>
                            <p class="text-xs text-gray-500 mb-1">Number of retries per processing cycle if the AI query or saving the document fails.</p>
                            <input type="number" v-model="settings.max_retries" required min="1" max="10" class="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 sm:text-sm">
                        </div>
                        <div>
                            <span class="block text-sm font-medium text-gray-700 mb-2">AI Capabilities</span>
                            <div class="flex items-center mt-2">
                                <input id="set_update_title" type="checkbox" v-model="settings.update_title" class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded">
                                <label for="set_update_title" class="ml-2 block text-sm text-gray-900">Update Title</label>
                            </div>
                            <div class="flex items-center mt-2">
                                <input id="set_update_corr" type="checkbox" v-model="settings.update_correspondent" @change="settings.generate_correspondent = settings.update_correspondent && settings.generate_correspondent" class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded">
                                <label for="set_update_corr" class="ml-2 block text-sm text-gray-900">Update Correspondent</label>
                            </div>
                            <div class="flex items-center mt-1 ml-6" :class="{ 'opacity-50': !settings.update_correspondent }">
                                <input id="set_gen_corr" type="checkbox" v-model="settings.generate_correspondent" :disabled="!settings.update_correspondent" class="h-3 w-3 text-purple-600 focus:ring-purple-500 border-gray-300 rounded">
                                <label for="set_gen_corr" class="ml-2 block text-xs text-gray-700">Allow AI generation</label>
                            </div>

                            <div class="flex items-center mt-2">
                                <input id="set_update_type" type="checkbox" v-model="settings.update_document_type" @change="settings.generate_document_type = settings.update_document_type && settings.generate_document_type" class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded">
                                <label for="set_update_type" class="ml-2 block text-sm text-gray-900">Update Document Type</label>
                            </div>
                            <div class="flex items-center mt-1 ml-6" :class="{ 'opacity-50': !settings.update_document_type }">
                                <input id="set_gen_type" type="checkbox" v-model="settings.generate_document_type" :disabled="!settings.update_document_type" class="h-3 w-3 text-purple-600 focus:ring-purple-500 border-gray-300 rounded">
                                <label for="set_gen_type" class="ml-2 block text-xs text-gray-700">Allow AI generation</label>
                            </div>

                            <div class="flex flex-col mt-2">
                                <div class="flex items-center">
                                    <input id="set_update_tags" type="checkbox" v-model="settings.update_tags" @change="settings.generate_tags = settings.update_tags && settings.generate_tags" class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded">
                                    <label for="set_update_tags" class="ml-2 block text-sm text-gray-900">Update Tags</label>
                                    <div v-if="settings.update_tags" class="ml-4 flex items-center">
                                        <label for="set_max_tags" class="mr-2 text-xs text-gray-600">Maximum tags:</label>
                                        <input id="set_max_tags" type="number" v-model="settings.max_tags" min="1" max="50" class="w-16 px-2 py-1 text-xs border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500">
                                    </div>
                                </div>
                                <div class="flex items-center mt-1 ml-6" :class="{ 'opacity-50': !settings.update_tags }">
                                    <input id="set_gen_tags" type="checkbox" v-model="settings.generate_tags" :disabled="!settings.update_tags" class="h-3 w-3 text-purple-600 focus:ring-purple-500 border-gray-300 rounded">
                                    <label for="set_gen_tags" class="ml-2 block text-xs text-gray-700">Allow AI generation</label>
                                </div>
                            </div>
                            <div class="flex items-center mt-2">
                                <input id="set_update_created" type="checkbox" v-model="settings.update_creation_date" class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded">
                                <label for="set_update_created" class="ml-2 block text-sm text-gray-900">Update Creation Date</label>
                            </div>
                        </div>

                        <!-- Metadata Permissions -->
                        <div class="border-t pt-4 mt-4">
                            <h4 class="text-sm font-semibold text-gray-900 mb-4">Metadata Permissions</h4>
                            <p class="text-xs text-gray-500 mb-4 italic">Applied ONLY when Paperless Llama creates new Tags, Correspondents, or Document Types.</p>
                            
                            <div class="flex items-center mb-4">
                                <input id="set_use_defaults" type="checkbox" v-model="settings.metadata_use_system_defaults" class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded">
                                <label for="set_use_defaults" class="ml-2 block text-sm text-gray-900">Use System Defaults</label>
                            </div>
                            <div v-if="!settings.metadata_use_system_defaults">
                                <div class="mb-4">
                                    <label class="block text-sm font-medium text-gray-700 mb-2">New Metadata Owner</label>
                                    <select v-model="settings.metadata_owner_id" class="block w-full pl-3 pr-10 py-2 text-sm border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md">
                                        <option :value="null">None (Public)</option>
                                        <option :value="-1">Document Owner</option>
                                        <optgroup label="Specific User">
                                            <option v-for="user in availableUsers" :key="user.id" :value="user.id">{{ user.username }} ({{ user.full_name || 'No name' }})</option>
                                        </optgroup>
                                    </select>
                                </div>

                                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <!-- View Permissions -->
                                <div>
                                    <label class="block text-sm font-semibold text-gray-700 mb-2">View Permissions</label>
                                    
                                    <!-- View Users -->
                                    <div class="mb-4">
                                        <label class="text-[10px] uppercase font-bold text-gray-500 block mb-1">View Users</label>
                                        <select @change="addPermission('metadata_view_users', $event)" class="block w-full pl-3 pr-10 py-1.5 text-xs border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md bg-white shadow-sm">
                                            <option value="">Add User...</option>
                                            <option v-for="user in filteredOptions('user', settings.metadata_view_users)" :key="user.id" :value="user.id">{{ user.username }}</option>
                                        </select>
                                        <div class="flex flex-wrap gap-1.5 mt-2">
                                            <span v-for="id in settings.metadata_view_users" :key="id" class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                                                {{ resolveName('user', id) }}
                                                <button type="button" @click="removePermission('metadata_view_users', id)" class="ml-1 inline-flex items-center p-0.5 hover:bg-blue-200 rounded-full text-blue-400 hover:text-blue-600 focus:outline-none">
                                                    <svg class="h-3 w-3" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
                                                </button>
                                            </span>
                                        </div>
                                    </div>

                                    <!-- View Groups -->
                                    <div>
                                        <label class="text-[10px] uppercase font-bold text-gray-500 block mb-1">View Groups</label>
                                        <select @change="addPermission('metadata_view_groups', $event)" class="block w-full pl-3 pr-10 py-1.5 text-xs border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md bg-white shadow-sm">
                                            <option value="">Add Group...</option>
                                            <option v-for="group in filteredOptions('group', settings.metadata_view_groups)" :key="group.id" :value="group.id">{{ group.name }}</option>
                                        </select>
                                        <div class="flex flex-wrap gap-1.5 mt-2">
                                            <span v-for="id in settings.metadata_view_groups" :key="id" class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200">
                                                {{ resolveName('group', id) }}
                                                <button type="button" @click="removePermission('metadata_view_groups', id)" class="ml-1 inline-flex items-center p-0.5 hover:bg-purple-200 rounded-full text-purple-400 hover:text-purple-600 focus:outline-none">
                                                    <svg class="h-3 w-3" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
                                                </button>
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <!-- Edit Permissions -->
                                <div>
                                    <label class="block text-sm font-semibold text-gray-700 mb-2">Edit Permissions</label>
                                    
                                    <!-- Edit Users -->
                                    <div class="mb-4">
                                        <label class="text-[10px] uppercase font-bold text-gray-500 block mb-1">Edit Users</label>
                                        <select @change="addPermission('metadata_edit_users', $event)" class="block w-full pl-3 pr-10 py-1.5 text-xs border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md bg-white shadow-sm">
                                            <option value="">Add User...</option>
                                            <option v-for="user in filteredOptions('user', settings.metadata_edit_users)" :key="user.id" :value="user.id">{{ user.username }}</option>
                                        </select>
                                        <div class="flex flex-wrap gap-1.5 mt-2">
                                            <span v-for="id in settings.metadata_edit_users" :key="id" class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                                                {{ resolveName('user', id) }}
                                                <button type="button" @click="removePermission('metadata_edit_users', id)" class="ml-1 inline-flex items-center p-0.5 hover:bg-blue-200 rounded-full text-blue-400 hover:text-blue-600 focus:outline-none">
                                                    <svg class="h-3 w-3" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
                                                </button>
                                            </span>
                                        </div>
                                    </div>

                                    <!-- Edit Groups -->
                                    <div>
                                        <label class="text-[10px] uppercase font-bold text-gray-500 block mb-1">Edit Groups</label>
                                        <select @change="addPermission('metadata_edit_groups', $event)" class="block w-full pl-3 pr-10 py-1.5 text-xs border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md bg-white shadow-sm">
                                            <option value="">Add Group...</option>
                                            <option v-for="group in filteredOptions('group', settings.metadata_edit_groups)" :key="group.id" :value="group.id">{{ group.name }}</option>
                                        </select>
                                        <div class="flex flex-wrap gap-1.5 mt-2">
                                            <span v-for="id in settings.metadata_edit_groups" :key="id" class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200">
                                                {{ resolveName('group', id) }}
                                                <button type="button" @click="removePermission('metadata_edit_groups', id)" class="ml-1 inline-flex items-center p-0.5 hover:bg-purple-200 rounded-full text-purple-400 hover:text-purple-600 focus:outline-none">
                                                    <svg class="h-3 w-3" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
                                                </button>
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
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

                        <div v-if="message" class="bg-green-50 text-green-700 p-3 rounded-md text-sm border border-green-200 flex justify-between">
                            {{ message }}
                            <button type="button" @click="message=''">x</button>
                        </div>
                        <div v-if="error" class="bg-red-50 text-red-500 p-3 rounded-md text-sm">{{ error }}</div>

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
        return {
            tab: 'logs',
            logs: [],
            processingDocs: [],
            settings: {},
            serverTimezone: 'UTC',
            availableModels: [],
            availableTags: [],
            loading: true,
            error: '',
            message: '',
            paperlessStatus: '',
            availableUsers: [],
            availableGroups: [],
            logInterval: null
        };
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
                const [logData, processingData] = await Promise.all([
                    api.getLogs(),
                    api.getProcessing()
                ]);
                this.logs = logData;
                this.processingDocs = processingData;
            } catch (e) {
                if (e.message !== 'Unauthorized') {
                    console.error('Background log refresh failed:', e);
                }
            }
        },
        async loadData() {
            try {
                this.loading = true;
                this.error = '';
                const [logData, processingData, settingData] = await Promise.all([
                    api.getLogs(),
                    api.getProcessing(),
                    api.getSettings()
                ]);
                this.logs = logData;
                this.processingDocs = processingData;
                this.settings = settingData;
                this.serverTimezone = settingData.server_timezone || 'UTC';

                if (this.settings.paperless_url && this.settings.paperless_token) {
                    const [userData, groupData] = await Promise.all([
                        api.getPaperlessUsers(),
                        api.getPaperlessGroups()
                    ]);
                    this.availableUsers = userData;
                    this.availableGroups = groupData;
                }

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
                if (
                    this.settings.query_tag_id &&
                    !this.availableTags.some((t) => t.id === this.settings.query_tag_id)
                ) {
                    tagsMissing = true;
                    this.settings.query_tag_id = null;
                }
                if (
                    this.settings.force_process_tag_id &&
                    !this.availableTags.some((t) => t.id === this.settings.force_process_tag_id)
                ) {
                    tagsMissing = true;
                    this.settings.force_process_tag_id = null;
                }

                if (!silent) {
                    this.paperlessStatus = `Connection successful! Found ${res.tags_count} tags.`;
                }

                if (tagsMissing) {
                    this.error =
                        'Warning: One or more configured tags no longer exist in Paperless. Please update your settings.';
                }
            } catch (e) {
                if (!silent) this.error = 'Paperless connection failed: ' + e.message;
            }
        },
        async fetchModels(showError = true, backend = null) {
            const activeBackend = backend || this.settings.ai_backend || 'ollama';
            if (activeBackend === 'llamacpp' && !this.settings.llamacpp_url) return;
            if (activeBackend === 'ollama' && !this.settings.ollama_url) return;

            try {
                this.error = '';
                let res;
                if (activeBackend === 'llamacpp') {
                    res = await api.testLlamacpp({ llamacpp_url: this.settings.llamacpp_url });
                } else {
                    res = await api.testOllama({ ollama_url: this.settings.ollama_url });
                }
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
        },
        resolveName(type, id) {
            if (type === 'user') {
                const user = this.availableUsers.find((u) => u.id === id);
                return user ? user.username : id;
            } else if (type === 'group') {
                const group = this.availableGroups.find((g) => g.id === id);
                return group ? group.name : id;
            }
            return id;
        },
        addPermission(collection, event) {
            const id = parseInt(event.target.value);
            if (id && !this.settings[collection].includes(id)) {
                this.settings[collection].push(id);
            }
            event.target.value = ''; // Reset select
        },
        removePermission(collection, id) {
            this.settings[collection] = this.settings[collection].filter((i) => i !== id);
        },
        filteredOptions(type, currentSelection) {
            if (type === 'user') {
                return this.availableUsers.filter((u) => !currentSelection.includes(u.id));
            } else if (type === 'group') {
                return this.availableGroups.filter((g) => !currentSelection.includes(g.id));
            }
            return [];
        },
        formatDate(dateStr) {
            if (!dateStr) return 'None';
            try {
                // Ensure naive UTC strings (without 'Z' or '+') are interpreted as UTC
                const normalizedStr =
                    typeof dateStr === 'string' && !dateStr.includes('Z') && !dateStr.includes('+')
                        ? dateStr + 'Z'
                        : dateStr;

                const date = new Date(normalizedStr);
                // sv-SE locale uses YYYY-MM-DD HH:mm:ss format
                return new Intl.DateTimeFormat('sv-SE', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false,
                    timeZone: this.serverTimezone
                }).format(date);
            } catch (e) {
                return new Date(dateStr).toLocaleString();
            }
        }
    }
};
