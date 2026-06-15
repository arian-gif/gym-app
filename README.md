# Gym Tracker

A mobile-first PWA to log your **Upper A / Lower A / Upper B / Lower B** workouts and chart
strength gains over time. Data is stored on your phone (instant + offline) and synced to **MongoDB**
through a single **Netlify Function** — no separate server to run.

## Features
- Password login screen (single user — your `APP_TOKEN`, verified server-side)
- 4 preloaded workouts (from your spreadsheet), 2 sets each by default — add/remove sets per session
- Date-based session logging; shows last session's weight×reps as a placeholder so you can beat it
- Progress tab: estimated 1-rep-max chart (Epley) per exercise, with change + top-weight stats
- History tab: view / edit / delete past sessions
- Installable on iPhone home screen, works offline; cloud backup via MongoDB
- JSON export/import backup

---

## Deploy to Netlify (≈5 min)

### 1. Get a MongoDB connection string
- Create a free cluster at [mongodb.com/atlas](https://www.mongodb.com/atlas) (or use your existing one).
- **Database Access** → add a user with a password.
- **Network Access** → add IP `0.0.0.0/0` (allow from anywhere — Netlify functions use dynamic IPs).
- **Connect → Drivers** → copy the URI, e.g.
  `mongodb+srv://USER:PASSWORD@cluster0.xxxx.mongodb.net/?retryWrites=true&w=majority`

### 2. Push this folder to a Git repo (GitHub/GitLab) **or** drag-and-drop deploy
Either connect the repo in Netlify, or use the Netlify CLI (below).

### 3. Set environment variables in Netlify
Netlify dashboard → **Site settings → Environment variables**:

| Key | Value | Required |
|-----|-------|----------|
| `MONGODB_URI` | your Atlas connection string | ✅ yes |
| `APP_TOKEN`   | **your login password** | ✅ yes (this is your login) |
| `MONGODB_DB`  | `gymtracker` (or any name) | optional |

**`APP_TOKEN` is your password.** The app shows a login screen on launch; whatever you type is
checked against `APP_TOKEN` by the server before any data is returned. Pick something only you know.

> ⚠️ If you leave `APP_TOKEN` unset, the data endpoint is public and the login screen can't actually
> protect anything (any password is accepted). Always set it.

### 4. Deploy
- **Git method:** Netlify auto-detects `netlify.toml`, runs `npm install` (pulls the `mongodb`
  driver), bundles the function, and publishes. Done.
- **CLI method:**
  ```bash
  npm install
  npm install -g netlify-cli
  netlify deploy --prod
  ```

### 5. Install on your iPhone
Open the site in **Safari** → Share → **Add to Home Screen**. Launches full-screen like a native app.

---

## How sync works
- Every change saves to `localStorage` instantly (works offline).
- Changes are pushed to MongoDB ~0.7s later via `PUT /api/data`.
- On launch the app pulls from MongoDB; the newer of {cloud, device} wins (last-write timestamp).
- The whole dataset is one document: `{ _id: "default", sessions: [...], updatedAt }`.

## Local development
```bash
npm install
netlify dev      # serves the site + function at http://localhost:8888
```
Without Netlify CLI you can open `index.html` directly, but `/api/data` won't exist —
the app still works fully offline on-device; it just shows "Offline" for sync.

## Files
| File | Purpose |
|------|---------|
| `index.html` `styles.css` `app.js` | the app (frontend) |
| `workouts.js` | your 4 workout templates |
| `netlify/functions/data.js` | serverless MongoDB read/write |
| `netlify.toml` | routes `/api/data` → the function |
| `manifest.json` `sw.js` `icon.svg` | PWA install + offline shell |
