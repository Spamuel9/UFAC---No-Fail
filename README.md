# No Fail

No Fail is a lightweight Couch to 5K training web app prototype.

## Current core functionality

- User account creation and login (name, username, password).
- Plan creator that asks for the data needed to build a personalized plan.
- Training progression tied to the user's fitness test date.
- Bold countdown display to the test date on the main dashboard.
- Modernized default dark theme UI for a more polished look and feel.
- Daily agenda generated from a master plan and shown on the main page.
- Mark daily task complete.
- Up to 3 break-day deferrals per week (task moves to next day).
- Weekly celebration banner when all 4 weekly tasks are completed.
- Automatic archiving and dashboard reset when test day arrives and training is complete.

## Run locally

Open `index.html` directly in a browser, or serve with:

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173`.

## Deploy to cloud.gov

This repository is now configured for static deployment using the Cloud Foundry `staticfile_buildpack`.

### Files used for deployment

- `manifest.yml` (app name, memory, instances, disk quota, buildpack)
- `Staticfile` (serve repo root, force HTTPS)

### CLI deployment

```bash
cf login -a api.fr.cloud.gov --sso
cf target -o <YOUR_ORG> -s <YOUR_SPACE>
cf push
```

### cloud.gov web UI values (matching your Overrides screen)

Use these values in **Overrides (Optional)** if you are editing manually:

- **Application Name:** `no-fail` (or your preferred unique name)
- **Number of Instances:** `1`
- **Memory Quota:** `64 MB`
- **Disk Quota:** `256 MB`
- **Stack:** leave default
- **Custom buildpack:** `staticfile_buildpack`
- **Docker Image / Docker Username:** leave blank
- **Route:**
  - Keep route enabled
  - **Host:** `no-fail` (or unique hostname)
  - **Domain:** select your allowed cloud.gov domain
  - **Path:** blank
- **Start Command:** blank
- **Health Check Type:** `port`
- **Health Check Timeout:** default is fine

After deploy, open the generated route URL.

## Current data-storage behavior (important)

User login data and plan data are currently stored in browser `localStorage` on each device/browser profile.
This is fine for prototype use but is **not** production-grade account storage yet. The next step is adding a backend + database for real accounts.
