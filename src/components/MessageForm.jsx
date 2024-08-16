import React, { useState } from 'react';
import { Button, TextField, Box, MenuItem, CircularProgress } from '@mui/material';
import Cron from 'react-cron-generator';

const phoneRegex = /^\+?[1-9][\d\s]{7,14}\d$/;

function MessageForm({ onSubmit, isScheduled = false }) {
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        recipientType: 'group',
        recipientName: '',
        message: '',
        imageUrl: '',
        cronExpression: isScheduled ? '0 0 * * *' : ''
    });
    const [errors, setErrors] = useState({});

    const validateForm = () => {
        const newErrors = {};
        if (!formData.message) {
            newErrors.message = 'Message is required';
        }

        const recipients = formData.recipientName.split(',').map(r => r.trim());
        if (recipients.length > 3) {
            newErrors.recipientName = 'Maximum of 3 recipients allowed';
        } else if (formData.recipientType === 'individual') {
            const invalidNumbers = recipients.filter(r => !phoneRegex.test(r));
            if (invalidNumbers.length > 0) {
                newErrors.recipientName = `Invalid phone number(s): ${invalidNumbers.join(', ')}`;
            }
        } else if (formData.recipientType === 'group' && !formData.recipientName) {
            newErrors.recipientName = 'Group name is required';
        }

        if (formData.imageUrl && !/^https?:\/\/.+/.test(formData.imageUrl)) {
            newErrors.imageUrl = 'Invalid URL';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        setErrors(prev => ({ ...prev, [name]: '' }));
    };

    const handleCronChange = (cronExpression) => {
        setFormData(prev => ({ ...prev, cronExpression }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!validateForm()) return;

        setIsLoading(true);
        try {
            await onSubmit(formData);
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
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
                label={formData.recipientType === 'group' ? "Group Name" : "Phone Number(s)"}
                value={formData.recipientName}
                onChange={handleInputChange}
                fullWidth
                margin="normal"
                error={!!errors.recipientName}
                helperText={errors.recipientName || (formData.recipientType === 'individual' ? 'Enter up to 3 phone numbers, separated by commas' : '')}
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
                error={!!errors.message}
                helperText={errors.message}
            />
            <TextField
                name="imageUrl"
                label="Image URL (optional)"
                value={formData.imageUrl}
                onChange={handleInputChange}
                fullWidth
                margin="normal"
                error={!!errors.imageUrl}
                helperText={errors.imageUrl || "You can upload your image to services like Imgur or Cloudinary and paste the URL here."}
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
            <Button
                type="submit"
                variant="contained"
                color="primary"
                disabled={isLoading}
                startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : null}
            >
                {isLoading
                    ? (isScheduled ? 'Scheduling...' : 'Sending...')
                    : (isScheduled ? 'Schedule Message' : 'Send Message')}
            </Button>
        </Box>
    );
}

export default MessageForm;