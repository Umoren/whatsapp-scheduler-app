# WhatsApp Group Reminder Bot

This bot sends automated reminders to a specified WhatsApp group at scheduled times.

## Features

- Sends customizable messages to a WhatsApp group
- Includes an image with the message
- Scheduled messaging using cron jobs
- Image caching for improved performance

## Prerequisites

- Node.js (v14 or later)
- npm (usually comes with Node.js)
- A WhatsApp account
- (Optional) Termux if running on Android

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
2. Scan the QR code with your WhatsApp mobile app to authenticate.
3. The bot will now send reminders according to the set schedule.

## Running on Android (Termux)

1. Install Termux from the Google Play Store
2. In Termux, install Node.js: `pkg install nodejs`
3. Install git: `pkg install git`
4. Clone this repository and follow the installation steps above
5. Run the bot using `npm start`

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
