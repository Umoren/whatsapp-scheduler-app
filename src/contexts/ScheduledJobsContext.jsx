import React, { createContext, useState, useContext, useCallback } from 'react';
import axios from 'axios';
import { showToast } from '../components/toast';

const ScheduledJobsContext = createContext();

export const ScheduledJobsProvider = ({ children }) => {
    const [jobs, setJobs] = useState([]);

    const fetchJobs = useCallback(async () => {
        try {
            const response = await axios.get('/scheduled-jobs');
            console.log('API response:', response.data);
            setJobs(response.data);
        } catch (error) {
            console.error('Failed to fetch jobs:', error);
            setJobs([]);
        }
    }, []);


    const scheduleJob = useCallback(async (jobData) => {
        try {
            const response = await axios.post('/schedule-message', jobData);
            fetchJobs();
            showToast('success', 'Yaaay!', 'Message Scheduled successfully');
            return response.data;
        } catch (error) {
            console.error('Failed to schedule job:', error);
            // showToast('error', 'Error', error?.message);
            throw error;
        }
    }, [fetchJobs]);

    const cancelJob = useCallback(async (jobId) => {
        try {
            await axios.delete(`/cancel-schedule/${jobId}`);
            fetchJobs();
        } catch (error) {
            console.error('Failed to cancel job:', error);
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