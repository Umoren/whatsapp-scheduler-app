import React, { useEffect } from 'react';
import { Box, Typography, Avatar, Button, Paper, Grow } from '@mui/material';
import { styled, keyframes } from '@mui/material/styles';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import InfoIcon from '@mui/icons-material/Info';
import WarningIcon from '@mui/icons-material/Warning';
import CloseIcon from '@mui/icons-material/Close';

const slideIn = keyframes`
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
`;

const StyledPaper = styled(Paper)(({ theme }) => ({
    maxWidth: '400px',
    width: '100%',
    backgroundColor: theme.palette.background.paper,
    boxShadow: theme.shadows[5],
    borderRadius: theme.shape.borderRadius,
    display: 'flex',
    overflow: 'hidden',
    animation: `${slideIn} 0.3s ease-out`,
    transition: 'all 0.3s ease-in-out',
    '&:hover': {
        transform: 'scale(1.02)',
    },
}));

const ContentBox = styled(Box)({
    flexGrow: 1,
    padding: '16px',
});

const CloseButton = styled(Button)(({ theme }) => ({
    borderLeft: `1px solid ${theme.palette.divider}`,
    borderRadius: '0 4px 4px 0',
    padding: '16px',
    color: theme.palette.primary.main,
    transition: 'all 0.2s',
    '&:hover': {
        backgroundColor: theme.palette.action.hover,
        transform: 'scale(1.1)',
    },
}));

const getIcon = (type) => {
    switch (type) {
        case 'success':
            return <CheckCircleIcon color="success" />;
        case 'error':
            return <ErrorIcon color="error" />;
        case 'info':
            return <InfoIcon color="info" />;
        case 'warning':
            return <WarningIcon color="warning" />;
        default:
            return null;
    }
};

const getGenZMessage = (type, message) => {
    switch (type) {
        case 'success':
            return `Yasss! ${message}`;
        case 'error':
            return `Oof! ${message}`;
        case 'info':
            return `FYI: ${message}`;
        case 'warning':
            return `Heads up! ${message}`;
        default:
            return message;
    }
};

const CustomToast = ({ t, type, title, message, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose(t.id);
        }, 6000);

        return () => clearTimeout(timer);
    }, [t.id, onClose]);

    return (
        <Grow in={t.visible}>
            <StyledPaper>
                <ContentBox>
                    <Box display="flex" alignItems="center">
                        <Avatar sx={{ mr: 2, animation: 'pulse 2s infinite' }}>{getIcon(type)}</Avatar>
                        <Box>
                            <Typography variant="subtitle1" component="p">
                                {title}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {getGenZMessage(type, message)}
                            </Typography>
                        </Box>
                    </Box>
                </ContentBox>
                <CloseButton onClick={() => onClose(t.id)}>
                    <CloseIcon />
                </CloseButton>
            </StyledPaper>
        </Grow>
    );
};

export default CustomToast;