import axios from 'axios';
import { supabaseClient } from './supabaseClientConfig';
import { showToast } from '../components/toast';

const instance = axios.create({
    baseURL: '/api'
});

instance.interceptors.response.use(
    (response) => response,
    async (error) => {
        if (error.response && error.response.status === 401) {
            showToast('error', 'Your session has expired. Please log in again.');
            await supabaseClient.auth.signOut();
            window.location.href = '/';
        }
        return Promise.reject(error);
    }
);

export default instance;