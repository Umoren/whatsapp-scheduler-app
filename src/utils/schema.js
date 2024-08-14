const { z } = require('zod');

// Updated regex to allow for spaces in phone numbers
const phoneRegex = /^\+?[1-9][\d\s]{7,14}\d$/;

const MessageSchema = z.object({
    recipientType: z.enum(['individual', 'group']),
    recipientName: z.string().refine((val) => {
        if (val.includes(',')) {
            const recipients = val.split(',').map(name => name.trim());
            if (recipients.length > 3) {
                return false; // More than 3 recipients (individuals or groups)
            }
            // For individuals, check phone numbers. For groups, just check if names are not empty
            return recipients.every(name =>
                (phoneRegex.test(name) && name.length > 0) || // For individuals
                (!phoneRegex.test(name) && name.length > 0)   // For groups
            );
        }
        return phoneRegex.test(val.trim()) || val.length > 0;
    }, {
        message: "Invalid recipient(s). Provide up to 3 valid phone numbers or group names, separated by commas.",
    }),
    message: z.string().min(1, "Message is required"),
    imageUrl: z.string().url().optional().or(z.literal('')),
    cronExpression: z.string().optional(),
});

module.exports = { MessageSchema };