import axios from 'axios';
import { supabaseClient } from './supabaseClientConfig';
import { showToast } from '../components/toast';

const instance = axios.create({
    baseURL: 'https://whatsapp-scheduler.fly.dev/api'
});

instance.interceptors.request.use(
    async (config) => {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session?.access_token) {
            config.headers['Authorization'] = `Bearer ${session.access_token}`;
        }
        return config;
    },
    (error) => {
        console.error('Request interceptor error:', error);
        return Promise.reject(error);
    }
);

instance.interceptors.response.use(
    (response) => {
        if (response.headers['x-new-token']) {
            supabaseClient.auth.setSession({
                access_token: response.headers['x-new-token'],
                refresh_token: supabaseClient.auth.session()?.refresh_token
            });
        }
        return response;
    },
    async (error) => {
        const originalRequest = error.config;
        if (error.response.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;
            try {
                const { data, error: refreshError } = await supabaseClient.auth.refreshSession();
                if (refreshError) throw refreshError;

                originalRequest.headers['Authorization'] = `Bearer ${data.session.access_token}`;
                return instance(originalRequest);
            } catch (refreshError) {
                showToast('error', 'Your session has expired. Please log in again.');
                await supabaseClient.auth.signOut();
                window.location.href = '/';
                return Promise.reject(refreshError);
            }
        }
        return Promise.reject(error);
    }
);

export default instance;