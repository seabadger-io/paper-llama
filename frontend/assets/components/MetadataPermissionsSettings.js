import { settingsMixin } from '../mixins/settingsMixin.js';

export default {
    name: 'MetadataPermissionsSettings',
    props: {
        modelValue: { type: Object, required: true },
        availableUsers: { type: Array, default: () => [] },
        availableGroups: { type: Array, default: () => [] }
    },
    emits: ['update:modelValue'],
    mixins: [settingsMixin],
    template: `
        <div class="space-y-4">
            <h4 class="text-sm font-semibold text-gray-900 mb-4">Metadata Permissions</h4>
            <p class="text-xs text-gray-500 mb-4 italic">Applies to newly created Tags, Correspondents, or Document Types if AI generated metadata is enabled.</p>
            
            <div class="flex items-center mb-4">
                <input id="set_use_defaults" type="checkbox" v-model="modelValue.metadata_use_system_defaults" class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded">
                <label for="set_use_defaults" class="ml-2 block text-sm text-gray-900">Use System Defaults</label>
            </div>
            
            <div v-if="!modelValue.metadata_use_system_defaults">
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-2">New Metadata Owner</label>
                    <select v-model="modelValue.metadata_owner_id" class="block w-full pl-3 pr-10 py-2 text-sm border-gray-300 focus:outline-none focus:ring-blue-500 rounded-md">
                        <option :value="null">None (Public)</option>
                        <option :value="-1">Document Owner</option>
                        <optgroup label="Specific User">
                            <option v-for="user in availableUsers" :key="user.id" :value="user.id">{{ user.username }}</option>
                        </optgroup>
                    </select>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <!-- View Permissions -->
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">View Permissions</label>
                        <div class="mb-4">
                            <label class="text-[10px] uppercase font-bold text-gray-500 block mb-1">Users</label>
                            <select @change="addPermission('metadata_view_users', $event, modelValue)" class="block w-full text-xs border-gray-300 rounded-md">
                                <option value="">Add User...</option>
                                <option v-for="user in filteredOptions('user', modelValue.metadata_view_users)" :key="user.id" :value="user.id">{{ user.username }}</option>
                            </select>
                            <div class="flex flex-wrap gap-1 mt-2">
                                <span v-for="id in modelValue.metadata_view_users" :key="id" class="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 flex items-center">
                                    {{ resolveName('user', id) }}
                                    <button type="button" @click="removePermission('metadata_view_users', id, modelValue)" class="ml-1 text-blue-400 hover:text-blue-600">×</button>
                                </span>
                            </div>
                        </div>
                        <div>
                            <label class="text-[10px] uppercase font-bold text-gray-500 block mb-1">Groups</label>
                            <select @change="addPermission('metadata_view_groups', $event, modelValue)" class="block w-full text-xs border-gray-300 rounded-md">
                                <option value="">Add Group...</option>
                                <option v-for="group in filteredOptions('group', modelValue.metadata_view_groups)" :key="group.id" :value="group.id">{{ group.name }}</option>
                            </select>
                            <div class="flex flex-wrap gap-1 mt-2">
                                <span v-for="id in modelValue.metadata_view_groups" :key="id" class="px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 flex items-center">
                                    {{ resolveName('group', id) }}
                                    <button type="button" @click="removePermission('metadata_view_groups', id, modelValue)" class="ml-1 text-purple-400 hover:text-purple-600">×</button>
                                </span>
                            </div>
                        </div>
                    </div>

                    <!-- Edit Permissions -->
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">Edit Permissions</label>
                        <div class="mb-4">
                            <label class="text-[10px] uppercase font-bold text-gray-500 block mb-1">Users</label>
                            <select @change="addPermission('metadata_edit_users', $event, modelValue)" class="block w-full text-xs border-gray-300 rounded-md">
                                <option value="">Add User...</option>
                                <option v-for="user in filteredOptions('user', modelValue.metadata_edit_users)" :key="user.id" :value="user.id">{{ user.username }}</option>
                            </select>
                            <div class="flex flex-wrap gap-1 mt-2">
                                <span v-for="id in modelValue.metadata_edit_users" :key="id" class="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 flex items-center">
                                    {{ resolveName('user', id) }}
                                    <button type="button" @click="removePermission('metadata_edit_users', id, modelValue)" class="ml-1 text-blue-400 hover:text-blue-600">×</button>
                                </span>
                            </div>
                        </div>
                        <div>
                            <label class="text-[10px] uppercase font-bold text-gray-500 block mb-1">Groups</label>
                            <select @change="addPermission('metadata_edit_groups', $event, modelValue)" class="block w-full text-xs border-gray-300 rounded-md">
                                <option value="">Add Group...</option>
                                <option v-for="group in filteredOptions('group', modelValue.metadata_edit_groups)" :key="group.id" :value="group.id">{{ group.name }}</option>
                            </select>
                            <div class="flex flex-wrap gap-1 mt-2">
                                <span v-for="id in modelValue.metadata_edit_groups" :key="id" class="px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 flex items-center">
                                    {{ resolveName('group', id) }}
                                    <button type="button" @click="removePermission('metadata_edit_groups', id, modelValue)" class="ml-1 text-purple-400 hover:text-purple-600">×</button>
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `
};
