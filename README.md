<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
# Weekly Time Tracker

This project is a time tracking tool designed to help users log and manage their weekly tasks and sessions. It is built using a combination of Python and frontend technologies.

## Features
- Plan weekly sessions for each day.
- Track start, end times, and status.
- Streamlined user interface with minimal complexity.

## Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
````

2. Install dependencies:

   ```bash
   pip install -r requirements.txt
   npm install
   ```

3. Run the application:

   ```bash
   python -m backend.app.dev
   npm run web
   ```

## Usage

* Open the app, and plan your sessions for each day of the week.
* Monitor the status of your tasks in a single interface.

## Contributing

Feel free to submit issues or pull requests. Contributions are welcome!

## License

This project is licensed under the MIT License.

```
=======
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
# Weekly Execution & Behavior Intelligence System

A full-stack project for planning, session execution, behavior intelligence, and weekly advisory across Android and Windows/browser.

## Known limitations
- Android reminders are strongest while the app has been opened recently; late-check behavior is not guaranteed after long background or terminated states.
- Web/browser reminders depend on browser notification permission, active-tab behavior, and local browser timer policies.
- This project is prepared for a real 7-day local trial, but it is still a single-user local/dev setup without authentication or production deployment hardening.

## First-run checklist
1. Copy `.env.example` to `.env`.
2. Install backend dependencies.
3. Seed the database with sample data.
4. Start the backend.
5. Verify `GET /health` returns `{"status":"ok"}`.
6. Install frontend dependencies.
7. Start Expo.
8. Confirm the app shows **Backend: connected** and a visible notification permission state.
9. Grant reminder permission on your device/browser before testing reminders.

## Sample commands
### Backend startup
```bash
python -m backend.app.dev
```

### Database seeding
```bash
python -m backend.app.seed
```

### Frontend startup
```bash
npm --prefix frontend run start
```

### Backend health verification
```bash
curl http://localhost:8000/health
```

## Quick local start
### 1) Backend (one command)
```bash
python -m backend.app.dev
```
This starts the FastAPI app with reload using `BACKEND_HOST` and `BACKEND_PORT` from the environment, and exposes the health endpoint at `GET /health`.

### 2) Frontend (one command)
```bash
npm --prefix frontend run start
```
For direct web testing on Windows you can also run:
```bash
npm --prefix frontend run web
```
For Android Expo testing you can also run:
```bash
npm --prefix frontend run android
```

## Seed / demo bootstrap
1. Copy `.env.example` to `.env` and adjust values if needed.
2. Install backend dependencies.
3. Run the seed loader:
```bash
python -m backend.app.seed
```
4. Start the backend with `python -m backend.app.dev`.
5. Start Expo with `npm --prefix frontend run start`.

## Environment variables
See `.env.example` for defaults:
- `BACKEND_HOST`
- `BACKEND_PORT`
- `EXPO_PUBLIC_API_BASE_URL`
- `EXPO_PUBLIC_ENABLE_DEV_FALLBACK`
- `EXPO_PUBLIC_DISPLAY_NAME`

## What is truly working now
- Backend-backed task/session loading in the frontend.
- Frontend session actions for **Start session**, **End session**, and **Mark missed**.
- A visible **Current session** panel and backend connection status indicator.
- Notification debug visibility plus a developer action to reset local app notification state.
- On-device reminder scheduling and speech delivery using Expo on Android, with browser notification/speech fallbacks where supported.

## What is still not implemented
- Full offline mutation replay for execution actions.
- Production-grade authentication and multi-user separation.
- End-to-end mobile/background reliability validation across OS sleep states.
- Desktop-native Windows packaging beyond browser/web usage.

## Stack
- **Backend:** FastAPI + SQLModel + SQLite
- **Frontend:** Expo / React Native Web
- **Android notifications:** `expo-notifications` + `expo-speech`
- **Browser/Windows fallback:** Web Notifications API + Web Speech API
- **Sync:** Central API + client-side offline queue

## Minimal smoke-test checklist
- **Start session:** open the app, tap **Start** on a planned session, and confirm the **Current session** panel updates immediately.
- **End session:** tap **End** on the active session and confirm it disappears from the active panel.
- **Mark missed:** tap **Mark missed**, choose a reason, save it, and confirm the prompt closes successfully.
- **Reminder permission:** verify the app shows the current permission state and that permission is granted.
- **Voice reminder:** wait for a scheduled reminder and confirm speech plays on Android or browser fallback where supported.
- **Late reminder:** leave a planned session inactive past the grace window and confirm a late reminder is delivered only once.
- **Weekly report:** open `http://localhost:8000/reports/weekly/json` in a browser and confirm the API returns report data.

## Notification implementation
### Packages used
- `expo-notifications` for local notification scheduling on Android/native.
- `expo-speech` for on-device text-to-speech on Android/native.
- `@react-native-async-storage/async-storage` for persisted reminder identifiers and delivered late-reminder state.
- Browser fallback uses the built-in Web Notifications API and Web Speech API when available.

### Where notifications are scheduled
- `frontend/services/notificationRuntime.js` schedules pre-session and at-start reminders in `scheduleDeviceReminders()`.
- `frontend/App.tsx` fetches backend config/session data and activates scheduling in the main `useEffect`.

### Where late checks are triggered
- `frontend/services/notificationRuntime.js` runs `startLateCheckLoop()` with a 60-second interval to detect overdue sessions on-device.
- `frontend/App.tsx` starts that loop after permissions are granted and sessions are loaded.

### Where text-to-speech is invoked
- `frontend/services/notificationRuntime.js` invokes Expo speech in `deliverSpeech()` on Android/native.
- The same file invokes Web Speech API via `speechSynthesis` on browser/Windows when available.

## Notification reliability
### Android
- Local reminders are scheduled with `expo-notifications`.
- Reminder identifiers are persisted and reconciled so duplicate pre/start reminders are not re-armed on every refresh.
- Delivered late reminders are persisted so they are not repeated after reload/resume until the session starts, ends, or is marked missed.
- On app resume, the client reconciles stored reminder state, clears stale entries, and re-arms only valid future reminders.

### Web / browser
- The app uses Web Notifications API and Web Speech API when the browser exposes them and permission is granted.
- Reminder state and delivered-late suppression are persisted through local storage on web.
- Resume/reload reconciliation works for reminder state and duplicate suppression, but browser timer/background behavior still depends on the tab and browser policy.

### Not reliably supported in background / terminated states
- Web reminders are not reliable when the tab is suspended, closed, or the browser is terminated.
- Expo-managed background execution is not guaranteed to run arbitrary late-check loops after the app is fully backgrounded or terminated.
- Because of those platform limits, late reminders are most reliable while the app is foregrounded or resumed regularly.

## Windows + Android Expo local run guide
### Windows web/browser path
1. Copy `.env.example` to `.env`.
2. Set `EXPO_PUBLIC_API_BASE_URL` to your backend URL, usually `http://localhost:8000`.
3. Start the backend with `python -m backend.app.dev`.
4. Start the frontend with `npm --prefix frontend run web`.
5. Open the browser app and verify the **Backend** status card reports `connected`.

### Android Expo device path
1. Make sure your phone and development machine are on the same network.
2. Copy `.env.example` to `.env`.
3. Set `EXPO_PUBLIC_API_BASE_URL` to the backend machine IP, for example `http://192.168.1.50:8000`.
4. Start the backend with `python -m backend.app.dev`.
5. Start Expo with `npm --prefix frontend run start` or `npm --prefix frontend run android`.
6. Open the project in Expo Go or on an Android emulator.
7. Confirm the frontend shows `Backend: connected` before testing reminders.

## Troubleshooting
### Notification permissions
- If reminders do not appear, confirm the app or browser was granted notification permission.
- Use the in-app **Notification debug** panel to verify the current permission state.

### Backend connection failures
- If the app shows `Backend: offline`, confirm `GET /health` responds at your configured `EXPO_PUBLIC_API_BASE_URL`.
- Re-check `BACKEND_HOST`, `BACKEND_PORT`, and the frontend API base URL in `.env`.

### Expo Android device testing
- For a physical Android device, `localhost` usually points to the phone itself, not your computer.
- Use your computer's LAN IP in `EXPO_PUBLIC_API_BASE_URL` instead.

### Browser fallback behavior
- Browser notifications and speech depend on the browser, permission state, and whether the tab stays active.
- If reminder timing looks inconsistent on web, test again with the tab active and notifications explicitly allowed.

## Dev fallback policy
- Demo fallback data is **off by default**.
- To enable it intentionally for local UI development, set `EXPO_PUBLIC_ENABLE_DEV_FALLBACK=true` before starting the Expo app.

## Stub audit
The following files from the previous scaffold were temporary sandbox stubs and also shadowed real packages if left in the repository:
- `fastapi/`
- `sqlmodel.py`
- `pydantic.py`
- `openpyxl/`

They have been removed from the repo so real dependencies resolve correctly from the Python environment.

## Tests
### Backend
```bash
pytest
```

### Frontend helper tests
```bash
cd frontend
npm test
```
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
