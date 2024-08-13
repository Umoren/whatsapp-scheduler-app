import React from 'react';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Button } from '@mui/material';

function ScheduledJobs({ jobs, onCancelJob }) {
    return (
        <TableContainer component={Paper}>
            <Table>
                <TableHead>
                    <TableRow>
                        <TableCell>Job ID</TableCell>
                        <TableCell>Group Name</TableCell>
                        <TableCell>Message</TableCell>
                        <TableCell>Next Run</TableCell>
                        <TableCell>Cron Expression</TableCell>
                        <TableCell>Action</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {jobs.map((job) => (
                        <TableRow key={job.id}>
                            <TableCell>{job.id}</TableCell>
                            <TableCell>{job.groupName}</TableCell>
                            <TableCell>{job.message}</TableCell>
                            <TableCell>{new Date(job.next).toLocaleString()}</TableCell>
                            <TableCell>{job.expression}</TableCell>
                            <TableCell>
                                <Button variant="contained" color="secondary" onClick={() => onCancelJob(job.id)}>
                                    Cancel
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    );
}

export default ScheduledJobs;