import React, { useState } from 'react';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Cron from 'react-cron-generator'

function MessageForm({ onSubmit, isScheduled = false }) {
    const [formData, setFormData] = useState({
        groupName: '',
        message: '',
        imageUrl: '',
        cronExpression: '0 0 * * *',
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prevData => ({ ...prevData, [name]: value }));
    };

    const handleCronChange = (cronExpression) => {
        setFormData(prevData => ({ ...prevData, cronExpression }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit(formData);
    };

    return (
        <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
            <TextField
                fullWidth
                margin="normal"
                label="Group Name"
                name="groupName"
                value={formData.groupName}
                onChange={handleChange}
                required
            />
            <TextField
                fullWidth
                margin="normal"
                label="Message"
                name="message"
                value={formData.message}
                onChange={handleChange}
                multiline
                rows={4}
                required
            />
            <TextField
                fullWidth
                margin="normal"
                label="Image URL (optional)"
                name="imageUrl"
                value={formData.imageUrl}
                onChange={handleChange}
            />
            {isScheduled && (
                <Box sx={{ mt: 2, mb: 2 }}>
                    <Cron
                        onChange={handleCronChange}
                        value={formData.cronExpression}
                        showResultText={true}
                        showResultCron={true}
                    />
                </Box>
            )}
            <Button type="submit" variant="contained" color="primary" sx={{ mt: 2 }}>
                {isScheduled ? 'Schedule Message' : 'Send Message'}
            </Button>
        </Box>
    );
}

export default MessageForm;