# WhatsApp Message Scheduler

## Table of Contents
- [WhatsApp Message Scheduler](#whatsapp-message-scheduler)
  - [Table of Contents](#table-of-contents)
  - [Introduction](#introduction)
  - [Features](#features)
  - [Getting Started](#getting-started)
  - [API Endpoints](#api-endpoints)
  - [Key Concepts](#key-concepts)
  - [Future Updates](#future-updates)

## Introduction

The WhatsApp Message Scheduler is a web application that allows users to schedule and send messages via WhatsApp. It provides a user-friendly interface for composing messages, selecting recipients, and setting up scheduling using cron expressions.

## Features

- **WhatsApp Authentication**: Secure login using QR code scanning.
- **Immediate Messaging**: Send messages to individuals or groups instantly.
- **Message Scheduling**: Schedule messages to be sent at a later time using cron expressions.
- **Multiple Recipients**: Send messages to up to 3 recipients at once.
- **Image Support**: Include images in your messages by providing an image URL.
- **Flexible Scheduling**: Use cron expressions for complex scheduling patterns.
- **Job Management**: View and cancel scheduled jobs.
- **Error Handling**: Robust error handling with user-friendly notifications.
- **Rate Limiting**: Prevents abuse by limiting the number of requests per user.

## Getting Started

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up environment variables (refer to `.env.example`)
4. Start the development server: `npm run dev`
5. Open the application in your browser and scan the QR code with WhatsApp to authenticate

## API Endpoints

- `GET /qr`: Retrieve the QR code for WhatsApp authentication
- `GET /auth-status`: Check the current authentication status
- `POST /send-message`: Send an immediate message
- `POST /schedule-message`: Schedule a message for later delivery
- `GET /scheduled-jobs`: Retrieve a list of all scheduled jobs
- `DELETE /cancel-schedule/:id`: Cancel a specific scheduled job

## Key Concepts

1. **WhatsApp Client**: The application uses the `whatsapp-web.js` library to interact with WhatsApp.

2. **Message Scheduling**: We use the `node-schedule` library to handle job scheduling based on cron expressions.

3. **Validation**: Input validation is performed both on the client-side and server-side using Zod schemas.

4. **Error Handling**: The application uses custom error classes and a centralized error handling middleware for consistent error responses.

5. **Logging**: Winston is used for logging, providing detailed insights into application behavior and issues.

6. **Rate Limiting**: Express-rate-limit is implemented to prevent API abuse.

## Future Updates

- Implement user accounts for managing multiple WhatsApp sessions
- Add support for sending files and documents
- Develop a mobile app version for on-the-go scheduling
- Integrate with popular calendar applications for easier scheduling
- Implement message templates for quick scheduling of common messages

Feel free to contribute to the project by submitting pull requests or reporting issues on the GitHub repository.