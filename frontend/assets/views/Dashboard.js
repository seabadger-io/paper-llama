import { api } from '../api.js';
import { settingsMixin } from '../mixins/settingsMixin.js';
import LoadingSpinner from '../components/LoadingSpinner.js';
import ActivityLogs from '../components/ActivityLogs.js';
import SettingsView from '../components/SettingsView.js';
import TriggerModal from '../components/TriggerModal.js';
import AccountSettings from '../components/AccountSettings.js';

export default {
    components: {
        'loading-spinner': LoadingSpinner,
        'activity-logs': ActivityLogs,
        'settings-view': SettingsView,
        'trigger-modal': TriggerModal,
        'account-settings': AccountSettings
    },
    mixins: [settingsMixin],
    template: `
    <div class="min-h-screen bg-gray-100">
        <nav class="bg-white border-b border-gray-200 shadow-sm">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex justify-between h-16">
                    <div class="flex">
                        <div class="flex-shrink-0 flex items-center font-bold text-blue-600 text-xl tracking-tight">
                            Paper Llama
                        </div>
                        <div class="ml-10 flex items-center space-x-4">
                            <button @click="openTriggerModal" class="px-4 py-2 bg-green-600 text-white rounded-md text-sm font-bold uppercase tracking-wide hover:bg-green-700 transition shadow-sm">Trigger Processing</button>
                            <div class="h-8 w-px bg-gray-200 mx-2"></div>
                            <button @click="$router.push('/dashboard/logs')" :class="$route.path.includes('/logs') ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'" class="px-4 py-2 rounded-t-md text-sm font-semibold transition-all h-16 flex items-center">Activity Logs</button>
                            <button @click="$router.push('/dashboard/settings')" :class="$route.path.includes('/settings') ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'" class="px-4 py-2 rounded-t-md text-sm font-semibold transition-all h-16 flex items-center">Settings</button>
                            <button @click="$router.push('/dashboard/account')" :class="$route.path.includes('/account') ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'" class="px-4 py-2 rounded-t-md text-sm font-semibold transition-all h-16 flex items-center">Account</button>
                        </div>
                    </div>
                    <div class="flex items-center">
                        <button @click="logout" class="text-gray-500 hover:text-red-600 transition px-3 py-2 rounded-md text-sm font-medium">Logout</button>
                    </div>
                </div>
            </div>
        </nav>

        <main class="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
            <div v-if="loading" class="flex justify-center py-12"><loading-spinner/></div>
            <div v-else>
                <router-view v-slot="{ Component }">
                    <component 
                        :is="Component"
                        :logs="logs"
                        :processing-docs="processingDocs"
                        :server-timezone="serverTimezone"
                        :modelValue="settings"
                        @update:modelValue="settings = $event"
                        :message="message"
                        @update:message="message = $event"
                        :available-models="availableModels"
                        :available-tags="availableTags"
                        :available-users="availableUsers"
                        :available-groups="availableGroups"
                        :paperless-status="paperlessStatus"
                        :error="error"
                        :admin-account="adminAccount"
                        @save="saveSettings"
                        @test-paperless="testPaperless(false)"
                        @fetch-models="(b) => fetchModels(b)"
                        @logout="logout"
                    />
                </router-view>
            </div>
        </main>

        <!-- Modals -->
        <trigger-modal 
            :show="showTriggerModal"
            :is-fetching-stats="isFetchingStats"
            :pending-count="pendingCount"
            @close="showTriggerModal = false"
            @confirm="confirmTrigger"
        />
    </div>`,
    data() {
        return {
            logs: [],
            processingDocs: [],
            settings: {},
            adminAccount: { username: '' },
            serverTimezone: 'UTC',
            availableModels: [],
            availableTags: [],
            loading: true,
            error: '',
            message: '',
            paperlessStatus: '',
            availableUsers: [],
            availableGroups: [],
            logInterval: null,
            showTriggerModal: false,
            pendingCount: 0,
            isFetchingStats: false
        };
    },
    async mounted() {
        await this.loadData();
        this.logInterval = setInterval(() => {
            if (this.$route.path.includes('/logs')) {
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
        async loadData() {
            try {
                this.loading = true;
                this.error = '';
                const [logData, processingData, settingData, accountData] = await Promise.all([
                    api.getLogs(),
                    api.getProcessing(),
                    api.getSettings(),
                    api.getAdminAccount()
                ]);
                this.logs = logData;
                this.processingDocs = processingData;
                this.settings = settingData;
                this.adminAccount = accountData;
                this.serverTimezone = settingData.server_timezone || 'UTC';

                await this.fetchModels(null);
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
        async openTriggerModal() {
            try {
                this.showTriggerModal = true;
                this.isFetchingStats = true;
                this.pendingCount = 0;
                const stats = await api.getTriggerStats();
                this.pendingCount = stats.count;
            } catch (e) {
                console.error('Failed to fetch processing stats:', e);
                this.error = 'Failed to fetch processing statistics: ' + e.message;
            } finally {
                this.isFetchingStats = false;
            }
        },
        async confirmTrigger() {
            try {
                this.showTriggerModal = false;
                await api.triggerProcessing();
                this.message =
                    'Processing triggered successfully! Documents will appear in logs as they are processed.';
                setTimeout(() => this.refreshLogs(), 1000);
            } catch (e) {
                this.error = 'Failed to trigger processing: ' + e.message;
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
        }
    }
};
