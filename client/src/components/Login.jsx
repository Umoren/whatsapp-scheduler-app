import React, { useState } from 'react';
import { Button, Typography, Box, Container, Paper } from '@mui/material';
import { Google as GoogleIcon } from '@mui/icons-material';
import { supabaseClient } from '../utils/supabaseClientConfig';
import { showToast } from './toast';

function Login() {
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = async () => {
        setIsLoading(true);
        try {
            const { error } = await supabaseClient.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: window.location.origin
                }
            });
            if (error) throw error;
        } catch (error) {
            console.error('Login error:', error);
            showToast('error', 'Failed to log in. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Container component="main" maxWidth="xs">
            <Box
                sx={{
                    marginTop: 8,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                }}
            >
                <Paper elevation={3} sx={{ padding: 4, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <Typography component="h1" variant="h6">
                        Welcome to WhatsApp Scheduler
                    </Typography>
                    <Typography variant="body1" component="p" sx={{ mt: 2, mb: 2, textAlign: 'center', fontSize: '0.85rem' }}>
                        Sign in or sign up with your Google account to start scheduling your WhatsApp messages.
                    </Typography>
                    <Button
                        fullWidth
                        variant="contained"
                        color="primary"
                        startIcon={<GoogleIcon />}
                        onClick={handleLogin}
                        disabled={isLoading}
                    >
                        {isLoading ? 'Connecting...' : 'Continue with Google'}
                    </Button>

                </Paper>
            </Box>
        </Container>
    );
}

export default Login;