export default {
    name: 'VisionSettings',
    props: {
        modelValue: { type: Object, required: true }
    },
    emits: ['update:modelValue'],
    template: `
        <div class="space-y-4">
            <h3 class="text-lg font-medium text-gray-900 mb-2">AI Vision Fallback</h3>

            <!-- Vision model notice -->
            <div class="bg-amber-50 border-l-4 border-amber-400 p-4 rounded-md">
                <div class="flex items-start">
                    <div class="flex-shrink-0">
                        <svg class="h-5 w-5 text-amber-400 mt-0.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                        </svg>
                    </div>
                    <div class="ml-3">
                        <p class="text-sm font-medium text-amber-800">Requires a vision-capable model</p>
                        <p class="mt-1 text-xs text-amber-700">
                            Vision Fallback sends document pages as images to the AI backend.
                            This will only work if you are using a model with image-to-text capability.
                            Using a text-only model will result in errors or empty output.
                        </p>
                    </div>
                </div>
            </div>

            <!-- Vision Mode -->
            <div>
                <label class="block text-sm font-medium text-gray-700">AI Vision Fallback</label>
                <select v-model="modelValue.vision_fallback" class="mt-1 block w-full pl-3 pr-10 py-2 border-gray-300 rounded-md sm:text-sm">
                    <option value="off">Off</option>
                    <option value="on">On — fallback if content is empty or AI flags poor quality text</option>
                    <option value="force">Force — always use AI vision</option>
                </select>
                <p class="mt-1 text-xs text-gray-500 italic">
                    <span v-if="modelValue.vision_fallback === 'off'">Vision fallback is disabled. Documents are processed using their existing Paperless content.</span>
                    <span v-else-if="modelValue.vision_fallback === 'on'">If Paperless OCR didn't extract any text or the AI deems the text unreadable, it will download and analyze the document using AI vision.</span>
                    <span v-else>Every document will be analyzed using AI vision, ignoring the Paperless extracted content entirely.</span>
                </p>
            </div>

            <!-- Pages to read — only shown when Vision is enabled -->
            <div v-if="modelValue.vision_fallback !== 'off'">
                <label class="block text-sm font-medium text-gray-700">Pages to Analyze</label>
                <input type="number" v-model="modelValue.vision_pages" min="1" max="20" required
                    class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md sm:text-sm">
                <p class="mt-1 text-xs text-gray-500 italic">Number of pages (starting from the first) to send to the AI as images.</p>
            </div>
        </div>
    `
};
