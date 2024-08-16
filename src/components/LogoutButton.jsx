import React from 'react';
import { Button } from '@mui/material';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';

function LogoutButton({ onLogout }) {
    return (
        <Button
            variant="outlined"
            color="secondary"
            onClick={onLogout}
            startIcon={<ExitToAppIcon />}
        >
            Logout
        </Button>
    );
}

export default LogoutButton;