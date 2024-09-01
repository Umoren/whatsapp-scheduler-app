import axios from 'axios';
import { supabaseClient } from './supabaseClientConfig';
import { showToast } from '../components/toast';

const instance = axios.create({
    baseURL: 'https://whatsapp-scheduler.fly.dev/api',
    timeout: 10000, // 10 seconds timeout
});

// Retry configuration
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second

const retryDelay = (retryCount) => {
    return Math.min(INITIAL_RETRY_DELAY * Math.pow(2, retryCount), 10000); // Max delay of 10 seconds
};

instance.interceptors.request.use(
    async (config) => {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session?.access_token) {
            config.headers['Authorization'] = `Bearer ${session.access_token}`;
            // console.log('Request with token:', config.url);
        } else {
            // console.log('Request without token:', config.url);
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
        const originalRequest = error.config;
        originalRequest.retryCount = originalRequest.retryCount || 0;

        if (axios.isCancel(error)) {
            return Promise.reject(error);
        }

        // Implement retry logic for network errors or 5xx server errors
        if ((error.response && error.response.status >= 500) || error.code === 'ECONNABORTED' || !error.response) {
            if (originalRequest.retryCount < MAX_RETRIES) {
                originalRequest.retryCount += 1;
                const delay = retryDelay(originalRequest.retryCount);
                console.log(`Retrying request (${originalRequest.retryCount}/${MAX_RETRIES}) after ${delay}ms`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return instance(originalRequest);
            } else {
                showToast('error', 'Network error. Please try again later.');
            }
        }

        // Handle 401 errors and token refresh
        if (error.response && error.response.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;
            try {
                const { data: { session }, error: refreshError } = await supabaseClient.auth.refreshSession();
                if (refreshError) throw refreshError;
                originalRequest.headers['Authorization'] = `Bearer ${session.access_token}`;
                return instance(originalRequest);
            } catch (refreshError) {
                showToast('error', 'Your session has expired. Please log in again.');
                await supabaseClient.auth.signOut();
                window.location.href = '/';
                return Promise.reject(refreshError);
            }
        }

        console.error('Response error:', error.response?.status, error.response?.data);
        return Promise.reject(error);
    }
);

export default instance;