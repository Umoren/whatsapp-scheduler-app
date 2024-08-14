import React, { useState } from 'react';
import { Button, TextField, Box, MenuItem } from '@mui/material';
import Cron from 'react-cron-generator';

function MessageForm({ onSubmit, isScheduled = false }) {
    const [formData, setFormData] = useState({
        recipientType: 'group',
        recipientName: '',
        message: '',
        imageUrl: '',
        cronExpression: isScheduled ? '0 0 * * *' : ''
    });

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleCronChange = (cronExpression) => {
        setFormData(prev => ({ ...prev, cronExpression }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        await onSubmit(formData);
    };

    return (
        <Box component="form" onSubmit={handleSubmit}>
            <TextField
                select
                name="recipientType"
                label="Recipient Type"
                value={formData.recipientType}
                onChange={handleInputChange}
                fullWidth
                margin="normal"
            >
                <MenuItem value="group">Group</MenuItem>
                <MenuItem value="individual">Individual</MenuItem>
            </TextField>
            <TextField
                name="recipientName"
                label={formData.recipientType === 'group' ? "Group Name" : "Phone Number"}
                value={formData.recipientName}
                onChange={handleInputChange}
                fullWidth
                margin="normal"
            />
            <TextField
                name="message"
                label="Message"
                multiline
                rows={4}
                value={formData.message}
                onChange={handleInputChange}
                fullWidth
                margin="normal"
            />

            <TextField
                name="imageUrl"
                label="Image URL (optional)"
                value={formData.imageUrl}
                onChange={handleInputChange}
                fullWidth
                margin="normal"
                helperText="You can upload your image to services like Imgur or Cloudinary and paste the URL here."
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


            <Button type="submit" variant="contained" color="primary">
                {isScheduled ? 'Schedule Message' : 'Send Message'}
            </Button>
        </Box>
    );
}

export default MessageForm;