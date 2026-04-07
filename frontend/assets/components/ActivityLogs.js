import { settingsMixin } from '../mixins/settingsMixin.js';

export default {
    props: {
        logs: { type: Array, required: true },
        processingDocs: { type: Array, required: true },
        serverTimezone: { type: String, default: 'UTC' }
    },
    mixins: [settingsMixin],
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
                                    <span v-if="log.new_state?.used_vision_fallback" title="AI Vision Fallback" class="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 uppercase tracking-tighter">
                                        ✨ AI-Vision
                                    </span>
                                </h3>
                                <p class="text-xs text-gray-500 font-medium">{{ formatDate(log.changed_at, serverTimezone) }}</p>
                            </div>
                            
                            <!-- Success State -->
                            <div v-if="!log.new_state?.error" class="grid grid-cols-2 gap-4 bg-gray-50 p-3 rounded mt-2 text-xs sm:text-sm border-l-4 border-blue-400">
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
                                    <div v-if="log.new_state?.ai_processing_time_ms != null" class="mt-1 text-xs text-indigo-500 font-medium"><strong>AI Time:</strong> {{ (log.new_state.ai_processing_time_ms / 1000).toFixed(1) }}s</div>
                                </div>
                            </div>

                            <!-- Error State -->
                            <div v-if="log.new_state?.error" class="bg-red-50 p-3 rounded mt-2 text-xs sm:text-sm border-l-4 border-red-500">
                                <div class="font-semibold text-[10px] uppercase text-red-600 mb-2">Processing Failed</div>
                                <div class="font-mono text-red-700 break-words mb-2">{{ log.new_state.error }}</div>
                                <div class="text-[10px] text-gray-500">Attempts: {{ log.new_state.attempts }}</div>
                            </div>
                        </div>
                    </div>
                </li>
            </ul>
        </div>
    `
};
