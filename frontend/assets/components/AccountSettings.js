import { api } from '../api.js';

export default {
    name: 'AccountSettings',
    props: {
        adminAccount: { type: Object, required: true }
    },
    emits: ['update:adminAccount', 'logout'],
    template: `
        <div class="bg-white shadow sm:rounded-md p-6 max-w-2xl">
            <h2 class="text-lg leading-6 font-medium text-gray-900 mb-4">Account Settings</h2>
            <form @submit.prevent="updateAccount" class="space-y-6">
                <!-- Username -->
                <div>
                    <label class="block text-sm font-medium text-gray-700">Username</label>
                    <input v-model="form.new_username" required type="text" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm">
                    <p class="mt-1 text-xs text-gray-500 italic">Changing your username will require you to log in again.</p>
                </div>

                <div class="border-t border-gray-100 pt-6">
                    <h3 class="text-md font-medium text-gray-900 mb-4">Change Password</h3>
                    <div class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700">New Password</label>
                            <input v-model="form.new_password" type="password" placeholder="Leave blank to keep current" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm">
                        </div>
                        <div v-if="form.new_password">
                            <label class="block text-sm font-medium text-gray-700">Confirm New Password</label>
                            <input v-model="confirm_password" type="password" required class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm">
                            <p v-if="form.new_password !== confirm_password && confirm_password" class="mt-1 text-xs text-red-600">Passwords do not match.</p>
                        </div>
                    </div>
                </div>

                <!-- Authorization -->
                <div class="border-t border-gray-100 pt-6">
                    <div class="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
                        <div class="flex">
                            <div class="flex-shrink-0">
                                <svg class="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                    <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                                </svg>
                            </div>
                            <div class="ml-3">
                                <p class="text-sm text-yellow-700 font-medium">Verify Identity</p>
                                <p class="text-xs text-yellow-600">Please provide your current password to authorize these changes.</p>
                            </div>
                        </div>
                    </div>
                    <label class="block text-sm font-medium text-gray-700">Current Password</label>
                    <input v-model="form.current_password" type="password" required class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm">
                </div>

                <!-- Messages -->
                <div v-if="message" class="bg-green-50 text-green-700 p-3 rounded-md text-sm border border-green-200">{{ message }}</div>
                <div v-if="error" class="bg-red-50 text-red-500 p-3 rounded-md text-sm border border-red-200">{{ error }}</div>

                <div class="pt-4 flex justify-center">
                    <button type="submit" :disabled="loading || (form.new_password && form.new_password !== confirm_password)" class="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none disabled:bg-blue-300 font-bold uppercase tracking-wide">
                        {{ loading ? 'Saving...' : 'Update Account' }}
                    </button>
                </div>
            </form>
        </div>
    `,
    data() {
        return {
            form: {
                new_username: this.adminAccount.username,
                new_password: '',
                current_password: ''
            },
            confirm_password: '',
            loading: false,
            message: '',
            error: ''
        };
    },
    methods: {
        async updateAccount() {
            try {
                this.loading = true;
                this.error = '';
                this.message = '';

                await api.updateAdminAccount(this.form);

                this.message = 'Account updated successfully. Redirecting to login...';

                // Clear password fields
                this.form.new_password = '';
                this.form.current_password = '';
                this.confirm_password = '';

                // If it was a success, standard practice is to log out since session might be tied to old username/password
                setTimeout(() => {
                    this.$emit('logout');
                }, 2000);
            } catch (e) {
                this.error = 'Failed to update account: ' + e.message;
            } finally {
                this.loading = false;
            }
        }
    }
};
