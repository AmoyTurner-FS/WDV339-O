# WDV339‑O Project

## 📌 Project Overview

This project is the starting point for a full-stack web application that will be developed over the next 4 weeks. The purpose of this repository is to organize the codebase, document technical requirements, and track development progress.

### 🔧 Planned Features:

- A simple backend API using Node.js and Express
- Frontend interface (HTML/CSS/JS or React — to be decided)
- Data stored in a database (MongoDB or MySQL)
- .env-based environment variable setup for secure configs
- User interaction and basic CRUD operations

## 🧪 Prerequisites

To run this project locally, make sure you have the following installed:

- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher (comes with Node.js)
- **Git**: For cloning the repo and version control
- **A web browser**: Chrome (latest) recommended
- **Code editor**: VS Code or any other text editor
- (Optional) **Postman**: For testing API endpoints

## 🚀 Getting Started

Follow these steps to clone and run the project on your local machine.

### 1. Clone the repository

git clone https://github.com/AmoyTurner-FS/WDV339-O.git
cd WDV339-O
Install dependencies

npm install

Set up your environment variables
Create a .env file in the /server folder and add:

PORT=3000

Run the server

npm start

Test the server
Open your browser and go to:
http://localhost:3000/health

You should see:

{
"ok": true,
"port": 3000,
"envLoaded": true
}

## 🔗 Links

Local API http://localhost:3000/health

GitHub Repo https://github.com/AmoyTurner-FS/WDV339-O

Staging (Optional) Coming soon
Live Site (Optional) Coming soon

### Week 2 Update: Spotify Integration

Spotify Developer Setup

Go to the Spotify Developer Dashboard
and create a new app.

Under your app’s settings, add this Redirect URI:

http://127.0.0.1:3000/callback

Copy your Client ID and Client Secret from the dashboard.

Add them to your .env file (as shown above).

Available Routes

GET /login – Redirects users to Spotify’s login page.

GET /callback – Handles the Spotify redirect, saves tokens, and returns a JWT.

GET /me – Retrieves your stored Spotify profile info (requires JWT).

POST /refresh_token – Refreshes Spotify access tokens (requires JWT).

GET /health – Basic route to confirm the server is running.

## 🔗 Links

Localhost: http://127.0.0.1:3000

Example API endpoint: http://127.0.0.1:3000/me

Spotify Developer Dashboard: https://developer.spotify.com/dashboard

## Week 3 Progress

- Added custom backend routes for Spotify API.
- Implemented JWT refresh logic to automatically renew expired tokens.
- Added /auth/status route to check if a user's token is still valid.
- Created /spotify/playlists and /spotify/search endpoints that fetch data using the user's Spotify access token.
- Verified all routes locally using curl commands.
