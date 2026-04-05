export default {
    name: 'DocumentQuerySettings',
    props: {
        modelValue: { type: Object, required: true },
        availableTags: { type: Array, default: () => [] }
    },
    emits: ['update:modelValue'],
    template: `
        <div class="space-y-4">
            <h3 class="text-lg font-medium text-gray-900 mb-4">Processing & Scheduling</h3>
            <div class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700">Document Word Limit</label>
                    <input type="number" v-model="modelValue.document_word_limit" min="0" required class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md sm:text-sm">
                    <p class="mt-1 text-xs text-gray-500 italic">Limits the number of words sent to the AI for analysis (0 = no limit).</p>
                </div>

                <div>
                    <label class="block text-sm font-medium text-gray-700">Schedule Interval (minutes)</label>
                    <input type="number" v-model="modelValue.schedule_interval_minutes" min="0" required class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md sm:text-sm">
                    <p class="mt-1 text-xs text-gray-500 italic">How often the application checks for new documents (0 = manual/webhook only).</p>
                </div>

                <div>
                    <label class="block text-sm font-medium text-gray-700">Query Tag</label>
                    <select v-model="modelValue.query_tag_id" class="mt-1 block w-full pl-3 pr-10 py-2 border-gray-300 rounded-md sm:text-sm">
                        <option :value="null">None (Process all documents)</option>
                        <option v-for="t in availableTags" :key="t.id" :value="t.id">{{ t.name }}</option>
                    </select>
                    <p class="mt-1 text-xs text-gray-500 italic">Only process documents with this tag. If none is selected all existing documents will be processed.</p>
                </div>

                <div class="flex items-center mt-2">
                    <input id="dash_remove_query_tag" type="checkbox" v-model="modelValue.remove_query_tag" class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded">
                    <label for="dash_remove_query_tag" class="ml-2 block text-sm text-gray-900">Remove query tag after processing</label>
                </div>

                <div>
                    <label class="block text-sm font-medium text-gray-700">Force Process Tag</label>
                    <select v-model="modelValue.force_process_tag_id" class="mt-1 block w-full pl-3 pr-10 py-2 border-gray-300 rounded-md sm:text-sm">
                        <option :value="null">None</option>
                        <option v-for="t in availableTags" :key="t.id" :value="t.id">{{ t.name }}</option>
                    </select>
                    <p class="mt-1 text-xs text-gray-500 italic">The application keeps track of processed documents and will filter them out unless this tag is added.
                    Query tag still applies, if configured both tags must be present to re-process a document.</p>
                </div>
            </div>
        </div>
    `
};
