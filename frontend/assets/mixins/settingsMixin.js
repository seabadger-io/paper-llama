import { api } from '../api.js';

export const settingsMixin = {
    methods: {
        async fetchModels(backend, settingsObj = null) {
            const target =
                settingsObj && typeof settingsObj === 'object'
                    ? settingsObj
                    : this.settings || this.form;
            const activeBackend = backend || (target ? target.ai_backend : 'ollama');

            if (activeBackend === 'llamacpp' && !target.llamacpp_url) return;
            if (activeBackend === 'ollama' && !target.ollama_url) return;

            try {
                this.error = '';
                let res;
                if (activeBackend === 'llamacpp') {
                    res = await api.testLlamacpp({ llamacpp_url: target.llamacpp_url });
                } else {
                    res = await api.testOllama({ ollama_url: target.ollama_url });
                }
                this.availableModels = res.models;

                // Auto-select first model if none selected
                const modelKey = activeBackend === 'llamacpp' ? 'llamacpp_model' : 'ollama_model';
                if (this.availableModels.length > 0 && !target[modelKey]) {
                    target[modelKey] = this.availableModels[0];
                }
            } catch (e) {
                if (this.error !== undefined) this.error = 'Failed to fetch models: ' + e.message;
            }
        },

        async testPaperless(silent = false, settingsObj = null) {
            const target =
                settingsObj && typeof settingsObj === 'object'
                    ? settingsObj
                    : this.settings || this.form;
            try {
                if (!silent) {
                    this.error = '';
                    this.paperlessStatus = '';
                }
                const res = await api.testPaperless({
                    paperless_url: target.paperless_url,
                    paperless_token: target.paperless_token
                });
                this.availableTags = res.tags || [];
                this.availableUsers = res.users || [];
                this.availableGroups = res.groups || [];

                let tagsMissing = false;
                if (
                    target.query_tag_id &&
                    !this.availableTags.some((t) => t.id === target.query_tag_id)
                ) {
                    tagsMissing = true;
                    target.query_tag_id = null;
                }
                if (
                    target.force_process_tag_id &&
                    !this.availableTags.some((t) => t.id === target.force_process_tag_id)
                ) {
                    tagsMissing = true;
                    target.force_process_tag_id = null;
                }

                if (!silent) {
                    this.paperlessStatus = `Connection successful! Found ${res.tags_count} tags, ${this.availableUsers.length} users, ${this.availableGroups.length} groups.`;
                }

                if (tagsMissing && !silent) {
                    this.error =
                        'Warning: One or more configured tags no longer exist in Paperless. Please update your settings.';
                }
            } catch (e) {
                if (!silent) this.error = 'Paperless connection failed: ' + e.message;
            }
        },

        resolveName(type, id) {
            if (type === 'user') {
                const user = this.availableUsers.find((u) => u.id === id);
                return user ? user.username : id;
            } else if (type === 'group') {
                const group = this.availableGroups.find((g) => g.id === id);
                return group ? group.name : id;
            }
            return id;
        },

        addPermission(collection, event, settingsObj = null) {
            const target = settingsObj || this.settings || this.form;
            const id = parseInt(event.target.value);
            if (id && !target[collection].includes(id)) {
                target[collection].push(id);
            }
            event.target.value = ''; // Reset select
        },

        removePermission(collection, id, settingsObj = null) {
            const target = settingsObj || this.settings || this.form;
            target[collection] = target[collection].filter((i) => i !== id);
        },

        filteredOptions(type, currentSelection) {
            if (type === 'user') {
                return this.availableUsers.filter((u) => !currentSelection.includes(u.id));
            } else if (type === 'group') {
                return this.availableGroups.filter((g) => !currentSelection.includes(g.id));
            }
            return [];
        },

        formatDate(dateStr, timezone = 'UTC') {
            if (!dateStr) return 'None';
            try {
                // Ensure naive UTC strings (without 'Z' or '+') are interpreted as UTC
                const normalizedStr =
                    typeof dateStr === 'string' && !dateStr.includes('Z') && !dateStr.includes('+')
                        ? dateStr + 'Z'
                        : dateStr;

                const date = new Date(normalizedStr);
                // sv-SE locale uses YYYY-MM-DD HH:mm:ss format
                return new Intl.DateTimeFormat('sv-SE', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false,
                    timeZone: timezone
                }).format(date);
            } catch (e) {
                return new Date(dateStr).toLocaleString();
            }
        }
    }
};
