import { api } from '../api.js';

export default {
    template: `
    <div class="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div class="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-lg border border-gray-100">
            <div>
                <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">Paper Llama Login</h2>
            </div>
            <form class="mt-8 space-y-6" @submit.prevent="login">
                <div v-if="error" class="bg-red-50 text-red-500 p-3 rounded-md text-sm">{{ error }}</div>
                <div class="rounded-md shadow-sm -space-y-px">
                    <div>
                        <input v-model="username" required class="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm" placeholder="Username">
                    </div>
                    <div>
                        <input type="password" v-model="password" required class="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm" placeholder="Password">
                    </div>
                </div>
                <div>
                    <button type="submit" :disabled="loading" class="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700">
                        {{ loading ? 'Logging in...' : 'Sign in' }}
                    </button>
                </div>
            </form>
        </div>
    </div>`,
    data() { return { username: '', password: '', error: '', loading: false } },
    methods: {
        async login() {
            try {
                this.loading = true;
                const res = await api.login(this.username, this.password);
                localStorage.setItem('token', res.access_token);
                this.$router.push('/dashboard');
            } catch (e) {
                this.error = 'Login failed: ' + e.message;
            } finally {
                this.loading = false;
            }
        }
    }
};
