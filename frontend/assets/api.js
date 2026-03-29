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
    getStatus() { return this.request('/admin/status', 'GET'); },
    
    // Wizard
    runSetup(data) { return this.request('/wizard', 'POST', data); },
    testOllama(data) { return this.request('/test-ollama', 'POST', data); },
    testPaperless(data) { return this.request('/test-paperless', 'POST', data); },
    
    // Auth & Admin
    login(username, password) { return this.request('/admin/login', 'POST', { username, password }); },
    getSettings() { return this.request('/admin/settings', 'GET', null, true); },
    updateSettings(data) { return this.request('/admin/settings', 'PUT', data, true); },
    getLogs(limit=50) { return this.request(`/admin/logs?limit=${limit}`, 'GET', null, true); },
    getProcessing() { return this.request('/admin/processing', 'GET', null, true); },
    triggerProcessing() { return this.request('/admin/trigger', 'POST', null, true); }
};
