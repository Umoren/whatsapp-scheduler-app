import axios from 'axios';
import { supabaseClient } from './supabaseClientConfig';
import { showToast } from '../components/toast';

const instance = axios.create({
    baseURL: 'https://whatsapp-scheduler.fly.dev/api'
});

instance.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('supabase.auth.token');
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
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
        if (error.response && error.response.status === 401) {
            showToast('error', 'Your session has expired. Please log in again.');
            await supabaseClient.auth.signOut();
            window.location.href = '/';
        }
        return Promise.reject(error);
    }
);

export default instance;