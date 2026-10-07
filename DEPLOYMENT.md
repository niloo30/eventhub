# Deployment Guide

This project is split into two deployable apps:

- `backend` on Render
- `frontend` on Vercel

## 1. Deploy the backend on Render

1. Push the repository to GitHub.
2. In Render, create a new **Web Service** from the repo.
3. Set the **Root Directory** to `backend`.
4. Use these commands:
   - Build: `npm install`
   - Start: `npm start`
5. Add the environment variables from `backend/.env.example`.
6. Make sure `CLIENT_URL` and `CLIENT_URLS` contain your Vercel domain.
7. Deploy the service and copy the Render URL.

## 2. Deploy the frontend on Vercel

1. Import the same repo into Vercel.
2. Set the **Root Directory** to `frontend`.
3. Add these environment variables:
   - `VITE_API_URL` = your Render backend URL
   - `VITE_SOCKET_URL` = your Render backend URL
4. Deploy the project.
5. The `frontend/vercel.json` file handles React Router refreshes.

## 3. Final checks

- Confirm `https://your-backend.onrender.com/api/health` returns `{ "status": "ok" }`.
- Open the Vercel app and verify login, event loading, and Socket.IO updates.
- If you use preview deployments, add their URL pattern to `CLIENT_URLS`.

## Notes

- Do not use `localhost` in production env vars.
- If you change environment variables on Render or Vercel, redeploy the affected service.
