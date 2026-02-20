# No Fail

No Fail is a Couch to 5K training app prototype with backend-authenticated accounts.

## Current core functionality

- Server-backed account creation and login (name, username, password).
- Passwords are hashed on the server (not stored in browser storage).
- Plan creator that asks for the data needed to build a personalized plan.
- Training progression tied to the user's fitness test date.
- Bold countdown display to the test date on the main dashboard.
- Modernized default dark theme UI.
- Daily agenda generated from a master plan and shown on the main page.
- Mark daily task complete.
- Up to 3 break-day deferrals per week (task moves to next day).
- Weekly celebration banner when all 4 weekly tasks are completed.
- Automatic archiving and dashboard reset when test day arrives and training is complete.

## Local development

Install dependencies:

```bash
npm install
```

Run the app:

```bash
npm start
```

Open `http://localhost:8080`.

## Deploy to cloud.gov

This app now deploys as a Node.js app (frontend + API) using Cloud Foundry `nodejs_buildpack`.

### Deployment files

- `manifest.yml` (resource sizing, buildpack, start command, health-check, and env vars)
- `server.js` (Express server for static files + API)

### CLI deployment

```bash
cf login -a api.fr.cloud.gov --sso
cf target -o <YOUR_ORG> -s <YOUR_SPACE>
cf push
```

### cloud.gov web UI override values

- **Application Name:** `no-fail` (or your preferred unique name)
- **Number of Instances:** `1`
- **Memory Quota:** `256 MB`
- **Disk Quota:** `512 MB`
- **Stack:** leave default
- **Custom buildpack:** `nodejs_buildpack`
- **Start Command:** `npm start`
- **Health Check Type:** `port`
- **Health Check Timeout:** default
- **Docker fields:** leave blank

## Security and persistence notes

- Client browser now stores only an auth token, not user passwords.
- User records and plans are stored server-side in `DB_PATH` (manifest defaults to `/tmp/no-fail/db.json` on cloud.gov) for this phase.
- For production multi-instance durability, move persistence to a managed database service (e.g., PostgreSQL) and set a strong `JWT_SECRET` environment variable.

## If cloud.gov says “Start unsuccessful”

If staging fails with `improper constraint` for `engines.node`, use a buildpack-friendly value like `20.x` in `package.json` (not compound ranges such as `>=20 <23`).


Run:

```bash
cf logs no-fail --recent
cf events no-fail
```

Common fixes:

- Re-authenticate if your CLI token is stale:

```bash
cf logout
cf login -a api.fr.cloud.gov --sso
cf target -o <YOUR_ORG> -s <YOUR_SPACE>
```

- Confirm app env and restart:

```bash
cf set-env no-fail JWT_SECRET <strong-random-secret>
cf restage no-fail
```

- Check the startup line in logs for `Using DB_PATH=...` to verify writable storage path (should show `/tmp/no-fail/db.json` unless overridden).
