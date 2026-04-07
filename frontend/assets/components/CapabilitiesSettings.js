import VisionSettings from './VisionSettings.js';

export default {
    name: 'CapabilitiesSettings',
    components: {
        'vision-settings': VisionSettings
    },
    props: {
        modelValue: { type: Object, required: true },
        availableTags: { type: Array, default: () => [] }
    },
    emits: ['update:modelValue'],
    template: `
        <div class="space-y-4">
            <h3 class="text-lg font-medium text-gray-900 mb-4">AI Capabilities</h3>
            <div class="space-y-4">
                <p class="text-xs text-gray-500 italic mb-2">Enable or disable specific AI-powered transformations.</p>
                <div class="flex items-center">
                    <input id="set_update_title" type="checkbox" v-model="modelValue.update_title" class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded">
                    <label for="set_update_title" class="ml-2 block text-sm text-gray-900 font-medium">Update Title</label>
                </div>
                
                <div class="space-y-1">
                    <div class="flex items-center">
                        <input id="set_update_corr" type="checkbox" v-model="modelValue.update_correspondent" @change="modelValue.generate_correspondent = modelValue.update_correspondent && modelValue.generate_correspondent" class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded">
                        <label for="set_update_corr" class="ml-2 block text-sm text-gray-900 font-medium">Update Correspondent</label>
                    </div>
                    <div class="flex items-center ml-6" :class="{ 'opacity-50': !modelValue.update_correspondent }">
                        <input id="set_gen_corr" type="checkbox" v-model="modelValue.generate_correspondent" :disabled="!modelValue.update_correspondent" class="h-3 w-3 text-purple-600 focus:ring-purple-500 border-gray-300 rounded">
                        <label for="set_gen_corr" class="ml-2 block text-xs text-gray-700">Allow AI to create new correspondents</label>
                    </div>
                </div>

                <div class="space-y-1">
                    <div class="flex items-center">
                        <input id="set_update_type" type="checkbox" v-model="modelValue.update_document_type" @change="modelValue.generate_document_type = modelValue.update_document_type && modelValue.generate_document_type" class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded">
                        <label for="set_update_type" class="ml-2 block text-sm text-gray-900 font-medium">Update Document Type</label>
                    </div>
                    <div class="flex items-center ml-6" :class="{ 'opacity-50': !modelValue.update_document_type }">
                        <input id="set_gen_type" type="checkbox" v-model="modelValue.generate_document_type" :disabled="!modelValue.update_document_type" class="h-3 w-3 text-purple-600 focus:ring-purple-500 border-gray-300 rounded">
                        <label for="set_gen_type" class="ml-2 block text-xs text-gray-700">Allow AI to create new types</label>
                    </div>
                </div>

                <div class="space-y-1">
                    <div class="flex items-center">
                        <input id="set_update_tags" type="checkbox" v-model="modelValue.update_tags" @change="modelValue.generate_tags = modelValue.update_tags && modelValue.generate_tags" class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded">
                        <label for="set_update_tags" class="ml-2 block text-sm text-gray-900 font-medium">Update Tags</label>
                        <div v-show="modelValue.update_tags" class="ml-4 flex items-center">
                            <label for="set_max_tags" class="mr-2 text-xs text-gray-600">Maximum number of tags to select:</label>
                            <input id="set_max_tags" type="number" v-model="modelValue.max_tags" min="1" max="50" class="w-16 px-2 py-1 text-xs border border-gray-300 rounded-md shadow-sm">
                        </div>
                    </div>
                    <div class="flex items-center ml-6" :class="{ 'opacity-50': !modelValue.update_tags }">
                        <input id="set_gen_tags" type="checkbox" v-model="modelValue.generate_tags" :disabled="!modelValue.update_tags" class="h-3 w-3 text-purple-600 focus:ring-purple-500 border-gray-300 rounded">
                        <label for="set_gen_tags" class="ml-2 block text-xs text-gray-700">Allow AI to create new tags</label>
                    </div>
                </div>

                <div class="flex items-center">
                    <input id="set_update_created" type="checkbox" v-model="modelValue.update_creation_date" class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded">
                    <label for="set_update_created" class="ml-2 block text-sm text-gray-900 font-medium">Update Creation Date</label>
                </div>

                <!-- Vision Fallback settings -->
                <div class="border-t border-gray-100 pt-4 mt-4">
                    <vision-settings v-model="modelValue" />
                </div>
            </div>
        </div>
    `
};
