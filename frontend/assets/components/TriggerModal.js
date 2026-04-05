import LoadingSpinner from './LoadingSpinner.js';

export default {
    name: 'TriggerModal',
    props: {
        show: { type: Boolean, required: true },
        isFetchingStats: { type: Boolean, default: false },
        pendingCount: { type: Number, default: 0 }
    },
    emits: ['close', 'confirm'],
    components: { LoadingSpinner },
    template: `
        <div v-if="show" class="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            <div class="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" @click="$emit('close')"></div>

                <span class="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
                <div class="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6 border border-gray-100">
                    <div>
                        <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full" :class="pendingCount > 0 ? 'bg-blue-100' : 'bg-gray-100'">
                            <svg v-if="pendingCount > 0" class="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                            </svg>
                            <svg v-else class="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path>
                            </svg>
                        </div>
                        <div class="mt-3 text-center sm:mt-5">
                            <h3 class="text-lg leading-6 font-medium text-gray-900" id="modal-title">Trigger Manual Processing</h3>
                            <div class="mt-4">
                                <div v-if="isFetchingStats" class="flex flex-col items-center py-4">
                                    <loading-spinner />
                                    <p class="text-sm text-gray-500 mt-2">Checking for pending documents...</p>
                                </div>
                                <div v-else class="py-2">
                                    <div v-if="pendingCount > 0" class="space-y-3">
                                        <p class="text-sm text-gray-600">
                                            Found <span class="font-bold text-blue-600 text-base">{{ pendingCount }}</span> document{{ pendingCount === 1 ? '' : 's' }} waiting to be processed.
                                        </p>
                                        <p class="text-[11px] text-gray-400 bg-gray-50 p-2 rounded">
                                            This will start the AI analysis for all unprocessed documents matching your filter criteria.
                                        </p>
                                    </div>
                                    <div v-else class="space-y-3">
                                        <p class="text-sm text-gray-500 italic">No pending documents found at this time.</p>
                                        <p class="text-[11px] text-gray-400">If you want to re-process documents, make sure they have the "Force Process Tag" assigned.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="mt-8 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
                        <button v-if="pendingCount > 0" @click="$emit('confirm')" type="button" class="modal-confirm w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-sm font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-offset-2 focus:ring-green-500 sm:col-start-2">
                            Start Processing
                        </button>
                        <button v-else @click="$emit('close')" type="button" class="modal-close w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-offset-2 focus:ring-blue-500 sm:col-start-2">
                            Close
                        </button>
                        <button v-if="pendingCount > 0" @click="$emit('close')" type="button" class="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:col-start-1 sm:text-sm">
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `
};
