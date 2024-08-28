import { supabaseClient } from './supabaseClientConfig';

export const refreshSession = async () => {
    const { data, error } = await supabaseClient.auth.refreshSession();
    if (error) {
        console.error("Failed to refresh session:", error);
        throw error;
    }
    return data.session;
};