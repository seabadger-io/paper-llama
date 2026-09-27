import { settingsMixin } from '../mixins/settingsMixin.js';
import { api } from '../api.js';

export default {
    props: {
        logs: { type: Array, required: true },
        logsTotal: { type: Number, required: true },
        logsLimit: { type: Number, required: true },
        logsOffset: { type: Number, required: true },
        processingDocs: { type: Array, required: true },
        serverTimezone: { type: String, default: 'UTC' }
    },
    mixins: [settingsMixin],
    data() {
        return {
            selectedLog: null,
            activeLogDetails: null,
            loadingDetails: false,
            detailsError: '',
            copiedPrompt: false,
            copiedResponse: false,
            activeTab: 'prompt'
        };
    },
    computed: {
        startRange() {
            return this.logsTotal === 0 ? 0 : this.logsOffset + 1;
        },
        endRange() {
            return Math.min(this.logsOffset + this.logsLimit, this.logsTotal);
        },
        totalPages() {
            return Math.ceil(this.logsTotal / this.logsLimit);
        },
        currentPage() {
            return Math.floor(this.logsOffset / this.logsLimit) + 1;
        }
    },
    methods: {
        async openAiDetails(log) {
            this.selectedLog = log;
            this.activeLogDetails = null;
            this.detailsError = '';
            this.loadingDetails = true;
            this.copiedPrompt = false;
            this.copiedResponse = false;
            this.activeTab = 'prompt';
            try {
                this.activeLogDetails = await api.getLogDetails(log.id);
            } catch (e) {
                this.detailsError = 'Failed to load AI details: ' + e.message;
            } finally {
                this.loadingDetails = false;
            }
        },
        closeAiDetails() {
            this.selectedLog = null;
            this.activeLogDetails = null;
            this.detailsError = '';
        },
        async copyToClipboard(text, type) {
            if (!text) return;
            try {
                await navigator.clipboard.writeText(text);
                if (type === 'prompt') {
                    this.copiedPrompt = true;
                    setTimeout(() => {
                        this.copiedPrompt = false;
                    }, 2000);
                } else if (type === 'response') {
                    this.copiedResponse = true;
                    setTimeout(() => {
                        this.copiedResponse = false;
                    }, 2000);
                }
            } catch {
                // Ignore clipboard write failures in unsupported contexts
            }
        }
    },
    template: `
        <div class="bg-white shadow overflow-hidden sm:rounded-md p-6">
            <!-- Currently Processing Section -->
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
                        <span class="text-xs text-blue-700">Started: {{ formatDate(doc.started_at, serverTimezone) }}</span>
                    </li>
                </ul>
            </div>

            <!-- Recent Processing Activity Section -->
            <div class="flex items-center justify-between mb-4">
                <h2 class="text-lg leading-6 font-medium text-gray-900">Recent Processing Activity</h2>
                <button type="button" @click="$router ? $router.push('/dashboard/settings') : null" class="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none">
                    <svg class="h-3.5 w-3.5 mr-1 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Log Settings
                </button>
            </div>
            
            <div v-if="logs.length === 0" class="text-gray-500 text-sm py-4">No documents processed yet.</div>
            <ul v-else class="divide-y divide-gray-200">
                <li v-for="log in logs" :key="log.id" class="py-4">
                    <div class="flex space-x-3">
                        <div class="flex-1 space-y-1">
                            <div class="flex items-center justify-between">
                                <h3 class="text-sm font-semibold text-gray-900">
                                    {{ log.original_state?.title || 'Document ' + log.document_id }}
                                    <span class="text-[10px] font-normal text-gray-400 ml-2">#{{ log.document_id }}</span>
                                    <span v-if="log.new_state?.used_vision_fallback" title="AI Vision Fallback" class="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 uppercase tracking-tighter">
                                        ✨ AI-Vision
                                    </span>
                                </h3>
                                <p class="text-xs text-gray-500 font-medium">{{ formatDate(log.changed_at, serverTimezone) }}</p>
                            </div>
                            
                            <!-- Success State -->
                            <div v-if="!log.new_state?.error" class="bg-gray-50 p-3 rounded mt-2 border-l-4 border-blue-400 text-xs sm:text-sm">
                                <div class="grid grid-cols-2 gap-4">
                                    <div class="min-w-0">
                                        <div class="font-semibold text-[10px] uppercase text-gray-400 mb-1">Before</div>
                                        <div class="truncate"><strong>Title:</strong> {{ log.original_state?.title || 'None' }}</div>
                                        <div class="truncate"><strong>Date:</strong> {{ log.original_state?.created || 'None' }}</div>
                                        <div class="truncate"><strong>Corr:</strong> {{ log.original_state?.correspondent || 'None' }}</div>
                                        <div class="truncate"><strong>Type:</strong> {{ log.original_state?.document_type || 'None' }}</div>
                                        <div class="mt-1 line-clamp-2"><strong>Tags:</strong> {{ (log.original_state?.tags || []).join(', ') || 'None' }}</div>
                                    </div>
                                    <div class="min-w-0">
                                        <div class="font-semibold text-[10px] uppercase text-blue-400 mb-1">After</div>
                                        <div class="truncate"><strong>Title:</strong> {{ log.new_state?.title || 'None' }}</div>
                                        <div class="truncate"><strong>Date:</strong> {{ log.new_state?.created || 'None' }}</div>
                                        <div class="truncate">
                                            <strong>Corr: </strong>
                                            <span :class="{ 'text-green-600 bg-green-50 px-1 rounded': log.new_state?.ai_generated?.correspondent }">
                                                {{ log.new_state?.correspondent || 'None' }}
                                            </span>
                                            <span v-if="log.new_state?.ai_generated?.correspondent" title="AI Generated" class="ml-1 text-xs">✨</span>
                                        </div>
                                        <div class="truncate">
                                            <strong>Type: </strong>
                                            <span :class="{ 'text-green-600 bg-green-50 px-1 rounded': log.new_state?.ai_generated?.document_type }">
                                                {{ log.new_state?.document_type || 'None' }}
                                            </span>
                                            <span v-if="log.new_state?.ai_generated?.document_type" title="AI Generated" class="ml-1 text-xs">✨</span>
                                        </div>
                                        <div class="mt-1 line-clamp-2">
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
                                        <div v-if="log.new_state?.ai_processing_time_ms != null || log.new_state?.token_usage" class="mt-2 pt-2 border-t border-gray-100 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                                            <div v-if="log.new_state?.ai_processing_time_ms != null" class="text-indigo-600 font-medium">
                                                <strong>AI Time:</strong> {{ (log.new_state.ai_processing_time_ms / 1000).toFixed(1) }}s
                                            </div>
                                            <div v-if="log.new_state?.token_usage" class="text-gray-600">
                                                <strong>Tokens:</strong>
                                                <span class="font-medium text-gray-800 ml-0.5">{{ log.new_state.token_usage.total_tokens != null ? log.new_state.token_usage.total_tokens.toLocaleString() : '—' }}</span>
                                                <span class="text-gray-500 text-[11px] ml-1">
                                                    ({{ log.new_state.token_usage.prompt_tokens != null ? log.new_state.token_usage.prompt_tokens.toLocaleString() : '0' }} prompt, {{ log.new_state.token_usage.completion_tokens != null ? log.new_state.token_usage.completion_tokens.toLocaleString() : '0' }} completion<span v-if="log.new_state.token_usage.reasoning_tokens">, {{ log.new_state.token_usage.reasoning_tokens.toLocaleString() }} reasoning</span>)
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div class="mt-2 pt-2 border-t border-gray-200 flex items-center justify-end">
                                    <button 
                                        type="button" 
                                        @click="openAiDetails(log)"
                                        class="inline-flex items-center text-xs font-medium text-blue-600 hover:text-blue-800 transition"
                                    >
                                        <svg class="h-3.5 w-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                        Inspect AI Prompt & Response
                                    </button>
                                </div>
                            </div>

                            <!-- Error State -->
                            <div v-if="log.new_state?.error" class="bg-red-50 p-3 rounded mt-2 text-xs sm:text-sm border-l-4 border-red-500">
                                <div class="font-semibold text-[10px] uppercase text-red-600 mb-2">Processing Failed</div>
                                <div class="font-mono text-red-700 break-words mb-2">{{ log.new_state.error }}</div>
                                <div class="flex flex-wrap items-center justify-between gap-y-2 pt-1 border-t border-red-100">
                                    <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-gray-500">
                                        <div>Attempts: {{ log.new_state.attempts }}</div>
                                        <div v-if="log.new_state?.token_usage">
                                            Tokens: {{ log.new_state.token_usage.total_tokens != null ? log.new_state.token_usage.total_tokens.toLocaleString() : '—' }} ({{ log.new_state.token_usage.prompt_tokens != null ? log.new_state.token_usage.prompt_tokens.toLocaleString() : '0' }} prompt, {{ log.new_state.token_usage.completion_tokens != null ? log.new_state.token_usage.completion_tokens.toLocaleString() : '0' }} completion<span v-if="log.new_state.token_usage.reasoning_tokens">, {{ log.new_state.token_usage.reasoning_tokens.toLocaleString() }} reasoning</span>)
                                        </div>
                                    </div>
                                    <button 
                                        type="button" 
                                        @click="openAiDetails(log)"
                                        class="inline-flex items-center text-xs font-medium text-red-700 hover:text-red-900 transition"
                                    >
                                        <svg class="h-3.5 w-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                        Inspect AI Prompt & Response
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </li>
            </ul>

            <!-- Pagination Section -->
            <div v-if="logsTotal > 0" class="mt-8 pt-6 border-t border-gray-100 flex items-center justify-between">
                <div class="text-sm text-gray-700">
                    Showing <span class="font-medium">{{ startRange }}</span> to <span class="font-medium">{{ endRange }}</span> of <span class="font-medium">{{ logsTotal }}</span> entries
                </div>
                <div class="flex-1 flex justify-end space-x-3">
                    <button 
                        @click="$emit('change-page', Math.max(0, logsOffset - logsLimit))"
                        :disabled="logsOffset === 0"
                        class="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm"
                    >
                        Previous
                    </button>
                    <button 
                        @click="$emit('change-page', logsOffset + logsLimit)"
                        :disabled="currentPage >= totalPages"
                        class="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm"
                    >
                        Next
                    </button>
                </div>
            </div>

            <!-- AI Details Modal -->
            <div v-if="selectedLog" class="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
                <div class="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                    <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" @click="closeAiDetails"></div>
                    <span class="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>
                    
                    <div class="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-3xl sm:w-full">
                        <div class="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4 border-b border-gray-200">
                            <div class="flex justify-between items-start">
                                <div>
                                    <h3 class="text-lg leading-6 font-semibold text-gray-900">
                                        AI Interaction — Document #{{ selectedLog.document_id }}
                                    </h3>
                                    <p class="text-xs text-gray-500 mt-1">
                                        {{ selectedLog.original_state?.title || 'Document ' + selectedLog.document_id }} • {{ formatDate(selectedLog.changed_at, serverTimezone) }}
                                    </p>
                                </div>
                                <button type="button" @click="closeAiDetails" class="text-gray-400 hover:text-gray-600 text-2xl font-bold p-1 leading-none">&times;</button>
                            </div>
                        </div>

                        <div class="px-4 py-5 sm:p-6 max-h-[70vh] overflow-y-auto">
                            <div v-if="loadingDetails" class="flex justify-center py-12">
                                <div class="text-sm text-gray-500 flex items-center">
                                    <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Loading prompt and response...
                                </div>
                            </div>
                            <div v-else-if="detailsError" class="p-3 bg-red-50 text-red-700 text-sm rounded border border-red-200">
                                {{ detailsError }}
                            </div>
                            <div v-else-if="!activeLogDetails?.prompt_used && !activeLogDetails?.ai_response" class="p-4 bg-yellow-50 text-yellow-800 text-sm rounded border border-yellow-200">
                                <p class="font-medium">No AI interaction stored for this document.</p>
                                <p class="text-xs mt-1 text-yellow-700">The prompt and response may have been compacted according to your retention policy, or prompt logging was disabled when this document was processed.</p>
                            </div>
                            <div v-else class="space-y-4">
                                <!-- Tabs Navigation -->
                                <div class="flex space-x-2 border-b border-gray-200 pb-2">
                                    <button 
                                        type="button" 
                                        @click="activeTab = 'prompt'" 
                                        :class="activeTab === 'prompt' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'"
                                        class="px-3 py-1.5 text-xs font-semibold rounded-md transition"
                                    >
                                        Prompt Sent to AI ({{ (activeLogDetails.prompt_used || '').length.toLocaleString() }} chars)
                                    </button>
                                    <button 
                                        type="button" 
                                        @click="activeTab = 'response'" 
                                        :class="activeTab === 'response' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'"
                                        class="px-3 py-1.5 text-xs font-semibold rounded-md transition"
                                    >
                                        Raw AI Response ({{ (activeLogDetails.ai_response || '').length.toLocaleString() }} chars)
                                    </button>
                                </div>

                                <!-- Prompt Tab -->
                                <div v-if="activeTab === 'prompt'" class="space-y-2">
                                    <div class="flex justify-between items-center">
                                        <span class="text-xs font-medium text-gray-500 uppercase tracking-wide">Full Prompt</span>
                                        <button 
                                            type="button" 
                                            @click="copyToClipboard(activeLogDetails.prompt_used, 'prompt')"
                                            class="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded bg-blue-50 hover:bg-blue-100 transition"
                                        >
                                            {{ copiedPrompt ? '✓ Copied!' : 'Copy Prompt' }}
                                        </button>
                                    </div>
                                    <pre class="bg-gray-900 text-gray-100 p-4 rounded-md text-xs font-mono overflow-x-auto max-h-96 whitespace-pre-wrap select-all">{{ activeLogDetails.prompt_used || '(empty prompt)' }}</pre>
                                </div>

                                <!-- Response Tab -->
                                <div v-if="activeTab === 'response'" class="space-y-2">
                                    <div class="flex justify-between items-center">
                                        <span class="text-xs font-medium text-gray-500 uppercase tracking-wide">AI Response</span>
                                        <button 
                                            type="button" 
                                            @click="copyToClipboard(activeLogDetails.ai_response, 'response')"
                                            class="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded bg-blue-50 hover:bg-blue-100 transition"
                                        >
                                            {{ copiedResponse ? '✓ Copied!' : 'Copy Response' }}
                                        </button>
                                    </div>
                                    <pre class="bg-gray-900 text-gray-100 p-4 rounded-md text-xs font-mono overflow-x-auto max-h-96 whitespace-pre-wrap select-all">{{ activeLogDetails.ai_response || '(empty response)' }}</pre>
                                </div>
                            </div>
                        </div>

                        <div class="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse border-t border-gray-200">
                            <button 
                                type="button" 
                                @click="closeAiDetails"
                                class="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `
};
