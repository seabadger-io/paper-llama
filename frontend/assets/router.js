import SetupWizard from './views/SetupWizard.js';
import Login from './views/Login.js';
import Dashboard from './views/Dashboard.js';
import { api } from './api.js';

const routes = [
    {
        path: '/',
        component: SetupWizard,
        beforeEnter: async (to, from, next) => {
            try {
                const status = await api.getStatus();
                if (status.is_setup) {
                    const token = localStorage.getItem('token');
                    if (token) next('/dashboard');
                    else next('/login');
                } else {
                    next();
                }
            } catch {
                next();
            }
        }
    },
    {
        path: '/login',
        component: Login,
        beforeEnter: async (to, from, next) => {
            const token = localStorage.getItem('token');
            if (token) next('/dashboard');
            else next();
        }
    },
    {
        path: '/dashboard',
        component: Dashboard,
        beforeEnter: (to, from, next) => {
            const token = localStorage.getItem('token');
            if (!token) next('/login');
            else next();
        }
    }
];

export const router = VueRouter.createRouter({
    history: VueRouter.createWebHistory(),
    routes
});
