# WhatsApp Group Reminder Bot

This bot sends automated reminders to a specified WhatsApp group at scheduled times.

## Features

- **Multiple Recipients**: Send messages to up to 3 recipients (groups or individuals) at once.
- **Flexible Scheduling**: Use cron expressions to schedule messages at any frequency.
- **Image Support**: Send images along with your messages.
- **Rate Limiting**: Implemented to prevent abuse and comply with WhatsApp's guidelines.
- **Improved Error Handling**: Better validation and user-friendly error messages.
- **Enhanced UI**: React-based frontend for easy message scheduling and management.


## Prerequisites

- Node.js (v14 or later)
- npm (usually comes with Node.js)
- A WhatsApp account
- Fly.io account

## Installation

1. Clone the repository:
2. Install dependencies: `npm install`
   
## Configuration

1. Open `server.js` and modify the following variables:
- `groupName`: The name of your WhatsApp group
- `message`: The content of your reminder message
- `WELCOME_IMAGE_URL`: URL of the image to be sent with the message

2. Adjust the cron schedule in `server.js` to set your desired reminder time.

## Usage

1. Start the bot: `npm start`
2. Open the web interface in your browser
3. Authenticate by scanning the QR code with your WhatsApp
4. Use the interface to send immediate messages or schedule future messages

## API Endpoints

- POST `/send-message`: Send an immediate message
- POST `/schedule-message`: Schedule a future message
- GET `/scheduled-jobs`: Retrieve all scheduled jobs
- DELETE `/cancel-schedule/:id`: Cancel a scheduled job

## Authentication

This project uses WhatsApp Web's LocalAuth strategy to persist sessions. Here's how it works:

1. When you first run the application, it will generate a QR code.
2. Navigate to the `/qr` route in your browser to see this QR code.
3. Scan the QR code with your WhatsApp mobile app to authenticate.
4. Once authenticated, the session will be persisted, and you won't need to scan the QR code again unless you log out or clear the session data.

The authentication process uses the `whatsapp-web.js` library's LocalAuth strategy, which stores session data in the `.wwebjs_auth` directory. This data is persisted across restarts, allowing for seamless re-authentication.


## Deploy and Run on Fly.io
1. Install the Fly CLI: `curl -L https://fly.io/install.sh | sh`
2. Log in to Fly: `fly auth login`
3. Initialize your Fly app: `fly launch`
4. Create a volume for persistent storage: `fly volumes create whatsapp_auth --size 1`
5. Update your `fly.toml` file to include the volume:
```toml
[mounts]
  source="whatsapp_auth"
  destination="/app/.wwebjs_auth"
```
6. Deploy your app: `fly deploy`
7. Once deployed, you'll need to authenticate WhatsApp. You can do this by checking the logs: `fly logs`

Look for the QR code in the logs and scan it with your WhatsApp mobile app.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
