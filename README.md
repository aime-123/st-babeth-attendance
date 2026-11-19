# St Babeth TSS Attendance Management System

This repository contains the initial project scaffold for the St Babeth TSS student attendance management system.

## Phase 1 completed

- Created the React + Vite frontend in `client/`
- Created the Express + MongoDB backend in `server/`
- Installed the required Phase 1 dependencies
- Configured Tailwind CSS for the frontend
- Added environment example files and project structure

## Run the apps

From the project root, start both the backend and frontend with:

```powershell
npm run dev
```

The frontend is available at `http://localhost:5173` and the API at
`http://localhost:5000`. Stop both services with `Ctrl+C`.

To run only the frontend, use:

```powershell
npm run dev:client
```

Install dependencies once if needed by running `npm install` in the project root,
`server`, and `client`.

## Administrator setup

The server no longer creates demo accounts automatically. To create the first
administrator for a new database, run `npm --prefix server run create-admin`
from an interactive terminal. The command securely prompts for account details
and refuses to run when an administrator already exists.

## Notes

- The frontend is configured with Vite and Tailwind.
- The backend is configured with Express, Mongoose, JWT, and security middleware.
- Add your MongoDB connection string in `server/.env` before Phase 2 and beyond.
"# st-babeth-attendance" 
