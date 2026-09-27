import PaperlessSettings from './PaperlessSettings.js';
import AIBackendSettings from './AIBackendSettings.js';
import CapabilitiesSettings from './CapabilitiesSettings.js';
import MetadataPermissionsSettings from './MetadataPermissionsSettings.js';
import DocumentQuerySettings from './DocumentQuerySettings.js';
import LoggingSettings from './LoggingSettings.js';

const CATEGORIES = [
    {
        id: 'paperless',
        title: 'Paperless-ngx',
        shortTitle: 'Paperless',
        subtitle: 'Connection URL, API token, and excluded tags',
        badge: 'Integration',
        icon: 'paperless'
    },
    {
        id: 'ai',
        title: 'AI Backend & Models',
        shortTitle: 'AI Backend',
        subtitle: 'Provider, model parameters, and vision fallback',
        badge: 'AI Engine',
        icon: 'ai'
    },
    {
        id: 'capabilities',
        title: 'Capabilities & Permissions',
        shortTitle: 'Capabilities',
        subtitle: 'Allowed field changes and new metadata permissions',
        badge: 'Permissions',
        icon: 'capabilities'
    },
    {
        id: 'processing',
        title: 'Processing & Schedule',
        shortTitle: 'Schedule',
        subtitle: 'Polling intervals, query tags, and retry rules',
        badge: 'Automation',
        icon: 'processing'
    },
    {
        id: 'logging',
        title: 'Logging & Retention',
        shortTitle: 'Logging',
        subtitle: 'Prompt/response storage, limits, and log compaction',
        badge: 'Maintenance',
        icon: 'logging'
    },
    {
        id: 'all',
        title: 'All Settings',
        shortTitle: 'All Settings',
        subtitle: 'Complete configuration overview in a single view',
        badge: 'Overview',
        icon: 'all'
    }
];

export default {
    name: 'SettingsView',
    props: {
        modelValue: { type: Object, required: true },
        availableModels: { type: Array, default: () => [] },
        availableTags: { type: Array, default: () => [] },
        availableUsers: { type: Array, default: () => [] },
        availableGroups: { type: Array, default: () => [] },
        paperlessStatus: { type: String, default: '' },
        message: { type: String, default: '' },
        error: { type: String, default: '' }
    },
    emits: [
        'update:modelValue',
        'update:message',
        'update:error',
        'save',
        'test-paperless',
        'fetch-models'
    ],
    components: {
        'paperless-settings': PaperlessSettings,
        'ai-backend-settings': AIBackendSettings,
        'capabilities-settings': CapabilitiesSettings,
        'metadata-permissions-settings': MetadataPermissionsSettings,
        'document-query-settings': DocumentQuerySettings,
        'logging-settings': LoggingSettings
    },
    data() {
        return {
            internalCategory: 'paperless'
        };
    },
    computed: {
        categories() {
            return CATEGORIES;
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
        },
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
        activeCategory() {
            const route = this.routeObj;
            const param = route?.params?.category || this.internalCategory;
            const valid = ['paperless', 'ai', 'capabilities', 'processing', 'logging', 'all'];
            if (param && valid.includes(param.toLowerCase())) {
                return param.toLowerCase();
            }
            if (route?.path) {
                for (const c of valid) {
                    if (route.path.endsWith('/' + c)) return c;
                }
            }
            if (this.aiBackendError && !param) return 'ai';
            if (this.paperlessError && !param) return 'paperless';
            return 'paperless';
        },
        currentCategoryObj() {
            return this.categories.find((c) => c.id === this.activeCategory) || this.categories[0];
        },
        prevCategory() {
            if (this.activeCategory === 'all') return null;
            const mainCategories = this.categories.filter((c) => c.id !== 'all');
            const idx = mainCategories.findIndex((c) => c.id === this.activeCategory);
            return idx > 0 ? mainCategories[idx - 1] : null;
        },
        nextCategory() {
            if (this.activeCategory === 'all') return null;
            const mainCategories = this.categories.filter((c) => c.id !== 'all');
            const idx = mainCategories.findIndex((c) => c.id === this.activeCategory);
            return idx >= 0 && idx < mainCategories.length - 1 ? mainCategories[idx + 1] : null;
        }
    },
    watch: {
        error(newVal) {
            if (newVal) {
                this.$nextTick(() => {
                    const el =
                        this.$el && this.$el.querySelector
                            ? this.$el.querySelector('.error-banner')
                            : null;
                    if (el && typeof el.scrollIntoView === 'function') {
                        try {
                            el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                        } catch {
                            // ignore in environments without smooth scroll
                        }
                    }
                });
            }
        }
    },
    methods: {
        setCategory(cat) {
            this.internalCategory = cat;
            const router = this.routerObj;
            const route = this.routeObj;
            if (router && route && route.params?.category !== cat) {
                router.push('/dashboard/settings/' + cat);
            }
        },
        isCategoryActive(category) {
            if (this.activeCategory === 'all') return true;
            return this.activeCategory === category;
        }
    },
    template: `
        <div class="space-y-6 max-w-6xl mx-auto">
            <!-- Top Sticky/Floating Banners for Errors & Messages -->
            <div v-if="error" class="error-banner sticky top-4 z-20 bg-red-50 text-red-700 p-4 rounded-xl text-sm border-l-4 border-red-500 flex items-start justify-between shadow-md mb-6 transition-all duration-200">
                <div class="flex items-start space-x-2">
                    <svg class="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                    </svg>
                    <span class="font-medium break-words">{{ error }}</span>
                </div>
                <button type="button" @click="$emit('update:error', '')" class="text-red-400 hover:text-red-600 focus:outline-none ml-4 font-bold text-base leading-none" title="Dismiss error">&times;</button>
            </div>

            <div v-if="message" class="message-banner sticky top-4 z-20 bg-green-50 text-green-700 p-4 rounded-xl text-sm border-l-4 border-green-500 flex items-start justify-between shadow-md mb-6 transition-all duration-200">
                <div class="flex items-start space-x-2">
                    <svg class="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                    </svg>
                    <span class="font-medium break-words">{{ message }}</span>
                </div>
                <button type="button" @click="$emit('update:message', '')" class="text-green-400 hover:text-green-600 focus:outline-none ml-4 font-bold text-base leading-none" title="Dismiss message">&times;</button>
            </div>

            <!-- Page Title Header -->
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-2 border-b border-gray-200 gap-4">
                <div>
                    <h1 class="text-2xl font-bold text-gray-900 tracking-tight">Application Settings</h1>
                    <p class="text-xs sm:text-sm text-gray-500 mt-1">Configure your Paperless connection, AI models, automation workflows, and retention policies.</p>
                </div>
                <div class="flex items-center space-x-2">
                    <span v-if="paperlessStatus" class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                        <span class="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5"></span>
                        Paperless Connected
                    </span>
                </div>
            </div>

            <!-- Main Layout: Category Nav Rail + Content Area -->
            <div class="flex flex-col md:flex-row gap-6 items-start">
                
                <!-- Category Navigation Sidebar / Mobile Pills -->
                <aside class="w-full md:w-64 lg:w-72 flex-shrink-0">
                    <!-- Mobile horizontal pill scroll (visible on small screens) -->
                    <div class="md:hidden flex space-x-2 overflow-x-auto pb-2 mb-2">
                        <button 
                            v-for="cat in categories" 
                            :key="'mobile-' + cat.id"
                            type="button"
                            @click="setCategory(cat.id)"
                            :class="activeCategory === cat.id ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'"
                            class="px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap flex items-center space-x-1.5 transition"
                        >
                            <span>{{ cat.shortTitle }}</span>
                            <span v-if="(cat.id === 'paperless' && paperlessError) || (cat.id === 'ai' && aiBackendError)" class="h-2 w-2 rounded-full bg-red-400"></span>
                        </button>
                    </div>

                    <!-- Desktop vertical nav rail (hidden on mobile, visible md+) -->
                    <nav class="hidden md:block bg-white shadow-sm rounded-xl border border-gray-200/80 p-2 space-y-1">
                        <div class="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                            Categories
                        </div>
                        <button 
                            v-for="cat in categories" 
                            :key="cat.id"
                            type="button"
                            @click="setCategory(cat.id)"
                            :class="activeCategory === cat.id ? 'bg-blue-50 text-blue-900 font-semibold shadow-xs border-l-4 border-blue-600' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 border-l-4 border-transparent'"
                            class="w-full text-left px-3.5 py-2.5 rounded-r-lg text-sm transition-all duration-150 flex items-start space-x-3 group"
                        >
                            <!-- Category icon container -->
                            <div :class="activeCategory === cat.id ? 'text-blue-600 bg-blue-100/70' : 'text-gray-400 group-hover:text-gray-600 bg-gray-100/80'" class="p-2 rounded-lg transition-colors flex-shrink-0 mt-0.5">
                                <svg v-if="cat.icon === 'paperless'" class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                </svg>
                                <svg v-else-if="cat.icon === 'ai'" class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                                <svg v-else-if="cat.icon === 'capabilities'" class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                                </svg>
                                <svg v-else-if="cat.icon === 'processing'" class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <svg v-else-if="cat.icon === 'logging'" class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <svg v-else class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                                </svg>
                            </div>
                            <div class="flex-1 min-w-0">
                                <div class="flex items-center justify-between">
                                    <span class="truncate font-medium">{{ cat.title }}</span>
                                    <span v-if="cat.id === 'paperless' && paperlessError" class="ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">!</span>
                                    <span v-if="cat.id === 'ai' && aiBackendError" class="ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">!</span>
                                </div>
                                <p class="text-[11px] text-gray-400 line-clamp-1 mt-0.5 group-hover:text-gray-500">{{ cat.subtitle }}</p>
                            </div>
                        </button>
                    </nav>
                </aside>

                <!-- Category Content Card -->
                <div class="flex-1 min-w-0 w-full">
                    <form @submit.prevent="$emit('save')" class="bg-white shadow-sm rounded-xl border border-gray-200/80 p-6 sm:p-8">
                        
                        <!-- Active Category Header Banner -->
                        <div class="border-b border-gray-100 pb-5 mb-6">
                            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                <div>
                                    <div class="flex items-center space-x-2">
                                        <span class="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 uppercase tracking-wider">{{ currentCategoryObj.badge }}</span>
                                        <span class="text-xs text-gray-400">Section</span>
                                    </div>
                                    <h2 class="text-xl font-bold text-gray-900 mt-1">{{ currentCategoryObj.title }}</h2>
                                    <p class="text-xs sm:text-sm text-gray-500 mt-0.5">{{ currentCategoryObj.subtitle }}</p>
                                </div>
                                <div class="hidden sm:flex items-center space-x-2">
                                    <button 
                                        type="submit" 
                                        class="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition"
                                    >
                                        Save All Settings
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- 1. Paperless Integration Section -->
                        <div v-show="isCategoryActive('paperless')" class="space-y-4">
                            <paperless-settings 
                                v-model="modelValue" 
                                :paperless-status="paperlessStatus" 
                                :error="paperlessError"
                                :available-tags="availableTags"
                                @test="$emit('test-paperless')"
                            />
                        </div>

                        <!-- 2. AI Backend Section -->
                        <div v-show="isCategoryActive('ai')" class="space-y-4" :class="{ 'pt-6 mt-6 border-t border-gray-100': activeCategory === 'all' }">
                            <div v-if="activeCategory === 'all'" class="mb-4">
                                <h3 class="text-lg font-bold text-gray-900">AI Backend & Models</h3>
                                <p class="text-xs text-gray-500">Provider options, model parameters, and vision fallback</p>
                            </div>
                            <ai-backend-settings 
                                v-model="modelValue" 
                                :available-models="availableModels"
                                :error="aiBackendError"
                                @fetch-models="(b) => $emit('fetch-models', b)"
                            />
                        </div>

                        <!-- 3. Capabilities & Permissions Section -->
                        <div v-show="isCategoryActive('capabilities')" class="space-y-6" :class="{ 'pt-6 mt-6 border-t border-gray-100': activeCategory === 'all' }">
                            <div v-if="activeCategory === 'all'" class="mb-2">
                                <h3 class="text-lg font-bold text-gray-900">Capabilities & Permissions</h3>
                                <p class="text-xs text-gray-500">Allowed field changes and new metadata permissions</p>
                            </div>
                            <capabilities-settings 
                                v-model="modelValue" 
                                :available-tags="availableTags"
                            />
                            <div class="border-t border-gray-100 pt-6">
                                <metadata-permissions-settings 
                                    v-model="modelValue" 
                                    :available-users="availableUsers" 
                                    :available-groups="availableGroups"
                                />
                            </div>
                        </div>

                        <!-- 4. Processing & Schedule Section -->
                        <div v-show="isCategoryActive('processing')" class="space-y-4" :class="{ 'pt-6 mt-6 border-t border-gray-100': activeCategory === 'all' }">
                            <div v-if="activeCategory === 'all'" class="mb-4">
                                <h3 class="text-lg font-bold text-gray-900">Processing & Schedule</h3>
                                <p class="text-xs text-gray-500">Polling intervals, query tags, and retry rules</p>
                            </div>
                            <document-query-settings 
                                v-model="modelValue" 
                                :available-tags="availableTags"
                            />
                        </div>

                        <!-- 5. Logging & Retention Section -->
                        <div v-show="isCategoryActive('logging')" class="space-y-4" :class="{ 'pt-6 mt-6 border-t border-gray-100': activeCategory === 'all' }" id="logging-settings">
                            <div v-if="activeCategory === 'all'" class="mb-4">
                                <h3 class="text-lg font-bold text-gray-900">Logging & Retention</h3>
                                <p class="text-xs text-gray-500">Prompt/response storage, limits, and log compaction</p>
                            </div>
                            <logging-settings 
                                v-model="modelValue" 
                            />
                        </div>

                        <!-- Bottom feedback for general / save actions -->
                        <div v-if="error && !paperlessError && !aiBackendError" class="mt-6 bg-red-50 text-red-500 p-3 rounded-md text-sm border border-red-200 flex justify-between items-center">
                            <span>{{ error }}</span>
                            <button type="button" @click="$emit('update:error', '')" class="text-red-400 hover:text-red-600 focus:outline-none ml-2 font-bold">&times;</button>
                        </div>

                        <!-- Footer Navigation & Save Actions -->
                        <div class="mt-8 pt-6 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                            <button 
                                v-if="prevCategory" 
                                type="button" 
                                @click="setCategory(prevCategory.id)" 
                                class="inline-flex items-center text-xs font-semibold text-gray-600 hover:text-gray-900 transition"
                            >
                                <svg class="h-3.5 w-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
                                Previous: {{ prevCategory.shortTitle }}
                            </button>
                            <div v-else class="hidden sm:block"></div>

                            <div class="w-full sm:w-auto flex justify-center">
                                <button 
                                    type="submit" 
                                    class="w-full sm:w-auto inline-flex justify-center items-center py-2.5 px-6 border border-transparent shadow-sm text-sm font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 uppercase tracking-wide transition shadow-blue-500/20"
                                >
                                    Save All Settings
                                </button>
                            </div>

                            <button 
                                v-if="nextCategory" 
                                type="button" 
                                @click="setCategory(nextCategory.id)" 
                                class="inline-flex items-center text-xs font-semibold text-blue-600 hover:text-blue-800 transition"
                            >
                                Next: {{ nextCategory.shortTitle }}
                                <svg class="h-3.5 w-3.5 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
                            </button>
                            <div v-else class="hidden sm:block"></div>
                        </div>

                    </form>
                </div>
            </div>
        </div>
    `
};
