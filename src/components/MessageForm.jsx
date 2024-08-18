import React, { useState } from 'react';
import { Button, TextField, Box, MenuItem, CircularProgress, IconButton } from '@mui/material';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import Cron from 'react-cron-generator';
import { trackEvent } from '../utils/analytics';

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
            trackEvent(isScheduled ? 'schedule_message' : 'send_message', {
                recipientType: formData.recipientType,
                hasImage: !!formData.imageUrl
            });
        } catch (error) {
            console.error(error);
            trackEvent('message_error', {
                isScheduled,
                error: error.message
            });
        } finally {
            setIsLoading(false);
        }
    };


    const validateForm = () => {
        const newErrors = {};
        if (!formData.message) {
            newErrors.message = 'Message is required';
        }
        if (!formData.recipientName) {
            newErrors.recipientName = 'Recipient is required';
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handlePaste = async () => {
        try {
            const text = await navigator.clipboard.readText();
            setFormData(prev => ({ ...prev, recipientName: text }));
        } catch (err) {
            console.error('Failed to read clipboard contents: ', err);
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
            <Box display="flex" alignItems="center">
                <TextField
                    name="recipientName"
                    label={formData.recipientType === 'group' ? "Group Name" : "Phone Number"}
                    value={formData.recipientName}
                    onChange={handleInputChange}
                    fullWidth
                    margin="normal"
                    error={!!errors.recipientName}
                    helperText={errors.recipientName}
                />
                <IconButton onClick={handlePaste} sx={{ ml: 1 }}>
                    <ContentPasteIcon />
                </IconButton>
            </Box>
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