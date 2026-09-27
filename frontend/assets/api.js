const API_BASE = '/api';

export const api = {
    async request(endpoint, method = 'GET', data = null, needsAuth = false) {
        const headers = { 'Content-Type': 'application/json' };
        if (needsAuth) {
            const token = localStorage.getItem('token');
            if (token) headers['Authorization'] = `Bearer ${token}`;
        }

        const config = { method, headers };
        if (data) config.body = JSON.stringify(data);

        const response = await fetch(`${API_BASE}${endpoint}`, config);

        if (response.status === 401) {
            localStorage.removeItem('token');
            window.location.href = '/login';
            throw new Error('Unauthorized');
        }

        const jsonData = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(jsonData.detail || 'Request failed');
        return jsonData;
    },

    // Status
    getStatus() {
        return this.request('/admin/status', 'GET');
    },

    // Wizard
    runSetup(data) {
        return this.request('/wizard', 'POST', data);
    },
    testOllama(data) {
        return this.request('/test-ollama', 'POST', data);
    },
    testLlamacpp(data) {
        return this.request('/test-llamacpp', 'POST', data);
    },
    testPaperless(data) {
        return this.request('/test-paperless', 'POST', data);
    },

    // Auth & Admin
    login(username, password) {
        return this.request('/auth/login', 'POST', { username, password });
    },
    getSettings() {
        return this.request('/admin/settings', 'GET', null, true);
    },
    updateSettings(data) {
        return this.request('/admin/settings', 'PUT', data, true);
    },
    getLogs(limit = 20, offset = 0) {
        return this.request(`/admin/logs?limit=${limit}&offset=${offset}`, 'GET', null, true);
    },
    getLogDetails(logId) {
        return this.request(`/admin/logs/${logId}/details`, 'GET', null, true);
    },
    runLogCleanup() {
        return this.request('/admin/logs/cleanup', 'POST', null, true);
    },
    getProcessing() {
        return this.request('/admin/processing', 'GET', null, true);
    },
    getPaperlessUsers() {
        return this.request('/admin/paperless/users', 'GET', null, true);
    },
    getPaperlessGroups() {
        return this.request('/admin/paperless/groups', 'GET', null, true);
    },
    triggerProcessing() {
        return this.request('/admin/trigger', 'POST', null, true);
    },
    reprocessDocument(documentId) {
        return this.request(`/admin/documents/${documentId}/reprocess`, 'POST', null, true);
    },
    retryDocument(documentId) {
        return this.reprocessDocument(documentId);
    },
    getTriggerStats() {
        return this.request('/admin/trigger/stats', 'GET', null, true);
    },
    getAdminAccount() {
        return this.request('/admin/account', 'GET', null, true);
    },
    updateAdminAccount(data) {
        return this.request('/admin/account', 'PUT', data, true);
    },
    createEventSource(onEvent, onError) {
        const token = localStorage.getItem('token');
        if (!token || typeof EventSource === 'undefined') return null;
        const url = `${API_BASE}/admin/events?token=${encodeURIComponent(token)}`;
        const es = new EventSource(url);

        const eventTypes = [
            'connected',
            'document_started',
            'document_completed',
            'workflow_started',
            'workflow_completed'
        ];

        eventTypes.forEach((type) => {
            es.addEventListener(type, (e) => {
                try {
                    const data = JSON.parse(e.data);
                    if (onEvent) onEvent({ type, ...data });
                } catch (err) {
                    console.error(`Failed to parse SSE event (${type}):`, err);
                }
            });
        });

        es.onmessage = (e) => {
            try {
                const data = JSON.parse(e.data);
                if (onEvent) onEvent(data);
            } catch (err) {
                console.error('Failed to parse SSE message:', err);
            }
        };

        if (onError) {
            es.onerror = onError;
        }

        return es;
    }
};
