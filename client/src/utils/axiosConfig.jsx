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
            console.log('Request with token:', config.url);
        } else {
            console.log('Request without token:', config.url);
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
        console.log('Response received:', response.config.url, response.status);
        return response;
    },
    async (error) => {
        console.error('Response error:', error.response?.status, error.response?.data);
        if (error.response && error.response.status === 401 && !error.config._retry) {
            error.config._retry = true;
            try {
                const { data: { session }, error: refreshError } = await supabaseClient.auth.refreshSession();
                if (refreshError) throw refreshError;
                error.config.headers['Authorization'] = `Bearer ${session.access_token}`;
                return instance(error.config);
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