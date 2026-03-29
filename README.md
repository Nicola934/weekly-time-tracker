# Weekly Execution Intelligence

Weekly Execution Intelligence is a FastAPI plus Expo/Electron app for planning work sessions, tracking execution quality, syncing data locally and remotely, and generating weekly behavioral reporting.

## Current capabilities
- Email/password accounts with per-user task, schedule, session, sync, notification, and reporting data.
- Offline-capable frontend storage with queued writes that flush when connectivity returns.
- Desktop runtime API configuration for packaged Electron builds.
- Weekly reporting, advisory feedback, goal-context settings, and notification voice readout support.

## Repo layout
- `backend/`: FastAPI app, database models, and service layer.
- `frontend/`: Expo web/mobile frontend plus Electron packaging scripts.
- `tests/`: Python backend tests.

## Local setup
1. Install backend dependencies:
   ```bash
   python -m pip install -r requirements.txt
   ```
2. Install frontend dependencies:
   ```bash
   npm --prefix frontend install
   ```
3. Start the backend:
   ```bash
   python -m backend.app.dev
   ```
4. Start the frontend:
   ```bash
   npm --prefix frontend run start
   ```

## Packaging notes
- Desktop builds require `DESKTOP_API_BASE_URL`.
- Expo web/mobile builds use `EXPO_PUBLIC_API_BASE_URL`.
- Local env files such as `frontend/.env` are intentionally not tracked.

## Verification
- Backend tests:
  ```bash
  python -m pytest tests
  ```
- Frontend tests:
  ```bash
  node --test frontend/tests/*.test.js
  ```
- Web build:
  ```bash
  npm --prefix frontend run build:web
  ```
