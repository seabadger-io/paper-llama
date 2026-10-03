import { api } from '../api.js';
import { settingsMixin } from '../mixins/settingsMixin.js';
import PaperlessSettings from '../components/PaperlessSettings.js';
import AIBackendSettings from '../components/AIBackendSettings.js';
import CapabilitiesSettings from '../components/CapabilitiesSettings.js';
import MetadataPermissionsSettings from '../components/MetadataPermissionsSettings.js';
import DocumentQuerySettings from '../components/DocumentQuerySettings.js';
import LoggingSettings from '../components/LoggingSettings.js';

const STEPS = [
    {
        id: 'account',
        number: 1,
        title: 'Admin Account',
        shortTitle: 'Account',
        subtitle: 'Create initial administrator credentials'
    },
    {
        id: 'paperless',
        number: 2,
        title: 'Paperless Integration',
        shortTitle: 'Paperless',
        subtitle: 'Connect to your Paperless-ngx instance'
    },
    {
        id: 'ai',
        number: 3,
        title: 'AI Backend & Models',
        shortTitle: 'AI Backend',
        subtitle: 'Configure LLM provider and select a model'
    },
    {
        id: 'capabilities',
        number: 4,
        title: 'Capabilities & Permissions',
        shortTitle: 'Capabilities',
        subtitle: 'Allowed transformations and metadata permissions'
    },
    {
        id: 'processing',
        number: 5,
        title: 'Processing & Schedule',
        shortTitle: 'Processing',
        subtitle: 'Background schedule, word limits, and query tags'
    },
    {
        id: 'logging',
        number: 6,
        title: 'Logging & Finish',
        shortTitle: 'Finish',
        subtitle: 'Retention policies, review configuration, and finalize'
    }
];

function generateWebhookToken() {
    const bytes = new Uint8Array(32);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        crypto.getRandomValues(bytes);
    } else {
        for (let i = 0; i < 32; i++) {
            bytes[i] = Math.floor(Math.random() * 256);
        }
    }
    return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}

export default {
    components: {
        'paperless-settings': PaperlessSettings,
        'ai-backend-settings': AIBackendSettings,
        'capabilities-settings': CapabilitiesSettings,
        'metadata-permissions-settings': MetadataPermissionsSettings,
        'document-query-settings': DocumentQuerySettings,
        'logging-settings': LoggingSettings
    },
    mixins: [settingsMixin],
    data() {
        return {
            internalStep: 'account',
            steps: STEPS,
            settings: {
                username: 'admin',
                password: '',
                paperless_url: '',
                paperless_token: '',
                ai_backend: 'ollama',
                ollama_url: 'http://localhost:11434',
                ollama_model: '',
                ollama_timeout: 300,
                ollama_api_key: '',
                ollama_temperature: 0.0,
                ollama_context_size: 4096,
                ollama_extra_params: '',
                llamacpp_url: 'http://localhost:8080',
                llamacpp_model: '',
                llamacpp_timeout: 300,
                llamacpp_api_key: '',
                llamacpp_temperature: 0.0,
                llamacpp_max_tokens: null,
                llamacpp_extra_params: '',
                max_retries: 3,
                update_title: true,
                update_correspondent: true,
                update_document_type: true,
                update_tags: true,
                max_tags: 5,
                generate_correspondent: false,
                generate_document_type: false,
                generate_tags: false,
                update_creation_date: false,
                custom_prompt: '',
                metadata_use_system_defaults: true,
                document_word_limit: 1500,
                schedule_interval_minutes: 5,
                webhook_tokens: generateWebhookToken(),
                remove_query_tag: true,
                metadata_owner_id: null,
                metadata_view_users: [],
                metadata_view_groups: [],
                metadata_edit_users: [],
                metadata_edit_groups: [],
                vision_fallback: 'off',
                vision_pages: 3,
                log_ai_interactions: true,
                log_max_ai_chars: 0,
                log_retention_days: 0,
                log_compact_after_days: 30
            },
            confirm_password: '',
            availableModels: [],
            availableTags: [],
            availableUsers: [],
            availableGroups: [],
            paperlessStatus: '',
            error: '',
            loading: false
        };
    },
    computed: {
        routeObj() {
            return (
                this.$.ctx?.$route || this.$.appContext?.config?.globalProperties?.$route || null
            );
        },
        routerObj() {
            return (
                this.$.ctx?.$router || this.$.appContext?.config?.globalProperties?.$router || null
            );
        },
        currentStep() {
            const route = this.routeObj;
            const param = route?.params?.step || route?.query?.step || this.internalStep;
            const valid = ['account', 'paperless', 'ai', 'capabilities', 'processing', 'logging'];
            if (param && valid.includes(param.toLowerCase())) {
                return param.toLowerCase();
            }
            if (route?.path) {
                for (const s of valid) {
                    if (route.path.endsWith('/' + s)) return s;
                }
            }
            return 'account';
        },
        currentStepObj() {
            return this.steps.find((s) => s.id === this.currentStep) || this.steps[0];
        },
        currentStepIndex() {
            return this.steps.findIndex((s) => s.id === this.currentStep);
        },
        prevStep() {
            const idx = this.currentStepIndex;
            return idx > 0 ? this.steps[idx - 1] : null;
        },
        nextStep() {
            const idx = this.currentStepIndex;
            return idx >= 0 && idx < this.steps.length - 1 ? this.steps[idx + 1] : null;
        },
        passwordMismatch() {
            return this.settings.password !== this.confirm_password && this.confirm_password !== '';
        },
        paperlessError() {
            if (!this.error) return '';
            const lower = this.error.toLowerCase();
            if (lower.includes('paperless') || lower.includes('tags no longer exist')) {
                return this.error;
            }
            return '';
        },
        aiBackendError() {
            if (!this.error) return '';
            const lower = this.error.toLowerCase();
            if (lower.includes('models') || lower.includes('ollama') || lower.includes('llama')) {
                return this.error;
            }
            return '';
        }
    },
    methods: {
        setStep(stepId) {
            this.internalStep = stepId;
            const router = this.routerObj;
            const route = this.routeObj;
            if (router) {
                if (!route || route.params?.step !== stepId) {
                    router.push('/setup/' + stepId);
                }
            }
        },
        goToNextStep() {
            if (this.currentStep === 'account' && this.passwordMismatch) {
                this.error = 'Passwords do not match.';
                return;
            }
            this.error = '';
            if (this.nextStep) {
                this.setStep(this.nextStep.id);
            }
        },
        goToPrevStep() {
            this.error = '';
            if (this.prevStep) {
                this.setStep(this.prevStep.id);
            }
        },
        isStepActive(stepId) {
            return this.currentStep === stepId;
        },
        isStepCompleted(stepId) {
            const idx = this.steps.findIndex((s) => s.id === stepId);
            return idx >= 0 && idx < this.currentStepIndex;
        },
        async submitSetup() {
            if (this.passwordMismatch) return;
            try {
                this.loading = true;
                this.error = '';
                await api.runSetup(this.settings);
                const router = this.routerObj;
                if (router) {
                    router.push('/login');
                }
            } catch (e) {
                this.error = 'Setup failed: ' + e.message;
            } finally {
                this.loading = false;
            }
        }
    },
    template: `
    <div class="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 py-10 px-4 sm:px-6 lg:px-8 flex flex-col justify-center items-center">
        <div class="max-w-4xl w-full space-y-8 bg-white p-6 sm:p-10 rounded-2xl shadow-xl border border-gray-100">
            
            <!-- Header Brand Banner -->
            <div class="flex flex-col items-center text-center pb-2">
                <img src="/assets/logo.png" alt="Paper Llama Logo" class="w-20 h-20 object-contain mb-2 drop-shadow-sm">
                <div class="flex items-center space-x-2">
                    <h1 class="text-3xl font-extrabold text-gray-900 tracking-tight">Initial Setup</h1>
                    <span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 tracking-wide uppercase">Wizard</span>
                </div>
                <p class="mt-1 text-sm text-gray-500 max-w-lg">Follow the step-by-step wizard to connect Paperless-ngx, configure your AI backend, and set up metadata rules.</p>
            </div>

            <!-- Stepper Progress Bar -->
            <div>
                <!-- Desktop Stepper (md+) -->
                <div class="hidden md:flex items-center justify-between relative px-2">
                    <div class="absolute left-6 right-6 top-4 h-0.5 bg-gray-200 -z-0">
                        <div 
                            class="h-0.5 bg-blue-600 transition-all duration-300"
                            :style="{ width: (currentStepIndex / (steps.length - 1) * 100) + '%' }"
                        ></div>
                    </div>
                    
                    <div 
                        v-for="(step, idx) in steps" 
                        :key="step.id"
                        class="flex flex-col items-center relative z-10 cursor-pointer group"
                        @click="setStep(step.id)"
                    >
                        <div 
                            :class="[
                                isStepActive(step.id) 
                                    ? 'bg-blue-600 text-white ring-4 ring-blue-100 shadow-md font-bold' 
                                    : (isStepCompleted(step.id) 
                                        ? 'bg-green-600 text-white font-bold shadow-sm' 
                                        : 'bg-white text-gray-500 border-2 border-gray-300 group-hover:border-gray-400')
                            ]"
                            class="w-8 h-8 rounded-full flex items-center justify-center text-xs transition-all duration-200"
                        >
                            <span v-if="isStepCompleted(step.id)">✓</span>
                            <span v-else>{{ step.number }}</span>
                        </div>
                        <span 
                            :class="[
                                isStepActive(step.id) 
                                    ? 'text-blue-600 font-semibold' 
                                    : (isStepCompleted(step.id) ? 'text-gray-800 font-medium' : 'text-gray-400 font-normal')
                            ]"
                            class="mt-2 text-xs text-center transition-colors whitespace-nowrap"
                        >
                            {{ step.shortTitle }}
                        </span>
                    </div>
                </div>

                <!-- Mobile Stepper (< md) -->
                <div class="block md:hidden">
                    <div class="flex items-center justify-between text-xs text-gray-600 mb-1 font-medium">
                        <span>Step {{ currentStepIndex + 1 }} of {{ steps.length }}</span>
                        <span class="text-blue-600 font-semibold">{{ currentStepObj.title }}</span>
                    </div>
                    <div class="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                        <div 
                            class="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            :style="{ width: ((currentStepIndex + 1) / steps.length * 100) + '%' }"
                        ></div>
                    </div>
                </div>
            </div>
            
            <form class="space-y-6 pt-2" @submit.prevent="submitSetup">
                
                <!-- Error Banner -->
                <div v-if="error" class="bg-red-50 text-red-700 p-4 rounded-xl text-sm border-l-4 border-red-500 flex items-start justify-between shadow-sm">
                    <div class="flex items-start space-x-2">
                        <svg class="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                        </svg>
                        <span class="font-medium break-words">{{ error }}</span>
                    </div>
                    <button type="button" @click="error = ''" class="text-red-400 hover:text-red-600 focus:outline-none ml-4 font-bold text-base leading-none" title="Dismiss error">&times;</button>
                </div>

                <!-- Active Step Header -->
                <div class="border-b border-gray-100 pb-4">
                    <div class="flex items-center space-x-2">
                        <span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 uppercase tracking-wider">Step {{ currentStepIndex + 1 }}</span>
                        <span class="text-xs text-gray-400">•</span>
                        <span class="text-xs text-gray-500 font-medium">{{ currentStepObj.subtitle }}</span>
                    </div>
                    <h2 class="text-xl font-bold text-gray-900 mt-1">{{ currentStepObj.title }}</h2>
                </div>
                
                <!-- Step 1: Admin Credentials -->
                <div v-show="isStepActive('account')" class="space-y-4 py-2">
                    <p class="text-xs text-gray-500">Create the primary administrator account used to log in to the Paper Llama dashboard.</p>
                    <div class="grid grid-cols-1 gap-4 max-w-lg">
                        <div>
                            <label class="block text-sm font-medium text-gray-700">Administrator Username</label>
                            <input v-model="settings.username" required class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm sm:text-sm focus:ring-blue-500 focus:border-blue-500">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700">Password</label>
                            <input type="password" v-model="settings.password" required class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm sm:text-sm focus:ring-blue-500 focus:border-blue-500">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700">Confirm Password</label>
                            <input type="password" v-model="confirm_password" required class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm sm:text-sm focus:ring-blue-500 focus:border-blue-500">
                            <p v-if="settings.password !== confirm_password && confirm_password" class="mt-1 text-xs text-red-600 font-medium">Passwords do not match.</p>
                        </div>
                    </div>
                </div>

                <!-- Step 2: Paperless Section -->
                <div v-show="isStepActive('paperless')" class="py-2">
                    <paperless-settings 
                        v-model="settings" 
                        :paperless-status="paperlessStatus" 
                        :error="paperlessError" 
                        :available-tags="availableTags"
                        @test="testPaperless(false)"
                    />
                </div>
                
                <!-- Step 3: AI Backend Section -->
                <div v-show="isStepActive('ai')" class="py-2">
                    <ai-backend-settings 
                        v-model="settings" 
                        :available-models="availableModels" 
                        :error="aiBackendError"
                        @fetch-models="(b) => fetchModels(b)"
                    />
                </div>
                
                <!-- Step 4: AI Capabilities & Permissions Section -->
                <div v-show="isStepActive('capabilities')" class="space-y-6 py-2">
                    <capabilities-settings 
                        v-model="settings" 
                        :available-tags="availableTags"
                    />
                    <div class="border-t border-gray-100 pt-6">
                        <metadata-permissions-settings 
                            v-model="settings" 
                            :available-users="availableUsers" 
                            :available-groups="availableGroups"
                        />
                    </div>
                </div>

                <!-- Step 5: Document Query & Scheduling Section -->
                <div v-show="isStepActive('processing')" class="py-2">
                    <document-query-settings 
                        v-model="settings" 
                        :available-tags="availableTags"
                    />
                </div>

                <!-- Step 6: Logging & Review Finalize -->
                <div v-show="isStepActive('logging')" class="space-y-6 py-2">
                    <logging-settings 
                        v-model="settings" 
                    />

                    <!-- Summary Overview Card -->
                    <div class="bg-gray-50 border border-gray-200 rounded-xl p-5 space-y-3">
                        <h4 class="text-xs font-bold uppercase tracking-wider text-gray-500">Configuration Summary</h4>
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                            <div><strong class="text-gray-700">Admin Account:</strong> {{ settings.username }}</div>
                            <div><strong class="text-gray-700">Paperless URL:</strong> {{ settings.paperless_url || '(not set)' }}</div>
                            <div><strong class="text-gray-700">AI Backend:</strong> {{ settings.ai_backend === 'ollama' ? 'Ollama' : 'Llama.cpp' }} ({{ (settings.ai_backend === 'ollama' ? settings.ollama_model : settings.llamacpp_model) || 'none selected' }})</div>
                            <div><strong class="text-gray-700">Polling Interval:</strong> {{ settings.schedule_interval_minutes }} minutes</div>
                            <div><strong class="text-gray-700">Log AI Interactions:</strong> {{ settings.log_ai_interactions ? 'Enabled' : 'Disabled' }}</div>
                            <div><strong class="text-gray-700">Retention / Compaction:</strong> {{ settings.log_retention_days }}d retention / {{ settings.log_compact_after_days }}d compaction</div>
                        </div>
                    </div>
                </div>

                <!-- Stepper Navigation Footer -->
                <div class="pt-6 border-t border-gray-100 flex items-center justify-between gap-4">
                    <button 
                        v-if="prevStep" 
                        type="button" 
                        @click="goToPrevStep" 
                        class="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-xs sm:text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none transition"
                    >
                        <svg class="h-4 w-4 mr-1 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
                        Back: {{ prevStep.shortTitle }}
                    </button>
                    <div v-else class="hidden sm:block"></div>

                    <div class="flex items-center space-x-3">
                        <!-- Next Step Button (Steps 1 to 5) -->
                        <button 
                            v-if="nextStep"
                            type="button" 
                            @click="goToNextStep" 
                            class="inline-flex items-center px-5 py-2.5 border border-transparent text-xs sm:text-sm font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition shadow-sm hover:shadow"
                        >
                            Continue to {{ nextStep.shortTitle }}
                            <svg class="h-4 w-4 ml-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
                        </button>

                        <!-- Final Step Submit Button (Step 6) -->
                        <button 
                            v-else
                            type="submit" 
                            :disabled="loading || passwordMismatch" 
                            class="inline-flex items-center px-6 py-2.5 border border-transparent text-xs sm:text-sm font-bold uppercase tracking-wider rounded-lg text-white disabled:bg-indigo-300 bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition shadow-md hover:shadow-lg"
                        >
                            <span v-if="loading">Completing Setup...</span>
                            <span v-else>Complete Setup & Launch 🚀</span>
                        </button>
                    </div>
                </div>

            </form>
        </div>
    </div>`
};
