import React, { createContext, useState, useContext, useCallback } from 'react';
import api from '../components/utils/axiosConfig';
import { supabaseClient } from '../components/utils/supabaseClientConfig';
import { showToast } from '../components/toast';

const ScheduledJobsContext = createContext();

export const ScheduledJobsProvider = ({ children }) => {
    const [jobs, setJobs] = useState([]);

    const fetchJobs = useCallback(async () => {
        try {
            const { data: { session } } = await supabaseClient.auth.getSession();
            if (!session) {
                console.error('No active session');
                setJobs([]);
                return;
            }

            const response = await api.get('/scheduled-jobs', {
                headers: {
                    'Authorization': `Bearer ${session.access_token}`
                }
            });
            console.log('API response:', response.data);
            setJobs(response.data);
        } catch (error) {
            console.error('Failed to fetch jobs:', error);
            setJobs([]);
            showToast('error', 'Failed to fetch scheduled jobs');
        }
    }, []);


    const scheduleJob = useCallback(async (jobData) => {
        try {
            const { data: { session } } = await supabaseClient.auth.getSession();
            if (!session) throw new Error('No active session');

            const response = await api.post('/schedule-message', jobData, {
                headers: {
                    'Authorization': `Bearer ${session.access_token}`
                }
            });
            fetchJobs();
            showToast('success', 'Message Scheduled successfully');
            return response.data;
        } catch (error) {
            console.error('Failed to schedule job:', error);
            showToast('error', 'Failed to schedule job');
            throw error;
        }
    }, [fetchJobs]);

    const cancelJob = useCallback(async (jobId) => {
        try {
            const { data: { session } } = await supabaseClient.auth.getSession();
            if (!session) throw new Error('No active session');

            await api.delete(`/cancel-schedule/${jobId}`, {
                headers: {
                    'Authorization': `Bearer ${session.access_token}`
                }
            });
            fetchJobs();
            showToast('success', 'Job cancelled successfully');
        } catch (error) {
            console.error('Failed to cancel job:', error);
            showToast('error', 'Failed to cancel job');
            throw error;
        }
    }, [fetchJobs]);

    return (
        <ScheduledJobsContext.Provider value={{ jobs, fetchJobs, scheduleJob, cancelJob }}>
            {children}
        </ScheduledJobsContext.Provider>
    );
};

export const useScheduledJobs = () => useContext(ScheduledJobsContext);