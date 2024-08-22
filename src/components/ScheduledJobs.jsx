import React, { useEffect, useState } from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    Typography,
    Box
} from '@mui/material';
import { useScheduledJobs } from '../contexts/ScheduledJobsContext';
import { showToast } from './toast';
import EventBusyIcon from '@mui/icons-material/EventBusy';

function ScheduledJobs() {
    const { jobs, fetchJobs, cancelJob } = useScheduledJobs();
    const [openDialog, setOpenDialog] = useState(false);
    const [jobToDelete, setJobToDelete] = useState(null)

    console.log('Jobs in ScheduledJobs component:', jobs);

    const handleCancelClick = (job) => {
        setJobToDelete(job);
        setOpenDialog(true);
    };

    const handleConfirmDelete = async () => {
        if (jobToDelete) {
            try {
                await cancelJob(jobToDelete.id);
                setOpenDialog(false);
                setJobToDelete(null);
                showToast('success', 'Job deleted! It\'s like it never existed.');
            } catch (error) {
                showToast('error', error.message || 'Uh-oh! Job decided to stay. Wanna try ghosting it again?');
            }
        }
    }

    const handleCloseDialog = () => {
        setOpenDialog(false);
        setJobToDelete(null);
    };

    useEffect(() => {
        fetchJobs();
    }, [fetchJobs]);


    if (!jobs || jobs.length === 0) {
        return (
            <Box
                display="flex"
                flexDirection="column"
                alignItems="center"
                justifyContent="center"
                height="50vh"
            >
                <EventBusyIcon sx={{ fontSize: 100, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" color="text.secondary">
                    No scheduled jobs found
                </Typography>
                <Typography variant="body2" color="text.secondary" mt={1}>
                    Create a new scheduled message to get started
                </Typography>
            </Box>
        );
    }


    return (
        <>
            <TableContainer component={Paper} sx={{ boxShadow: 'none', width: '100%' }}>
                <Table sx={{ minWidth: 650 }}>
                    <TableHead>
                        <TableRow>
                            <TableCell>Job ID</TableCell>
                            <TableCell>Recipient</TableCell>
                            <TableCell>Message</TableCell>
                            <TableCell>Next Run</TableCell>
                            <TableCell>Cron Expression</TableCell>
                            <TableCell>Action</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {jobs.map((job) => (
                            <TableRow key={job.id}>
                                <TableCell sx={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {job.id}
                                </TableCell>
                                <TableCell>{job.recipient_name}</TableCell>
                                <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {job.message}
                                </TableCell>
                                <TableCell>{new Date(job.next_run_at).toLocaleString()}</TableCell>
                                <TableCell>{job.cron_expression}</TableCell>
                                <TableCell>
                                    <Button
                                        variant="outlined"
                                        color="secondary"
                                        onClick={() => handleCancelClick(job)}
                                        sx={{ minWidth: 'auto', padding: '6px 12px' }}
                                    >
                                        Delete
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
            <Dialog
                open={openDialog}
                onClose={handleCloseDialog}
                aria-labelledby="alert-dialog-title"
                aria-describedby="alert-dialog-description"
            >
                <DialogTitle id="alert-dialog-title">{"Confirm Deletion"}</DialogTitle>
                <DialogContent>
                    <DialogContentText id="alert-dialog-description">
                        Are you sure you want to delete this scheduled message? This action is permanent and cannot be undone.
                    </DialogContentText>
                    <DialogContentText sx={{ mt: 2, color: 'text.secondary' }}>
                        Note: This will only remove the scheduled job. If the message has already been sent, it will not be deleted from WhatsApp.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseDialog} color="primary">
                        Cancel
                    </Button>
                    <Button onClick={handleConfirmDelete} color="error" autoFocus>
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
}

export default ScheduledJobs;