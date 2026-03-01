# Google Cloud Storage Guide

Reference for the S2PX GCS architecture, authentication, and file management.

---

## 1. Bucket Architecture

S2PX uses 4 GCS buckets in the `s2p-migration` Google Cloud project:

| Bucket | Env Variable | Purpose |
|--------|-------------|---------|
| `s2p-core-vault` | `GCS_BUCKET` | Generated PDFs (proposals, reports) and scoping file uploads |
| `s2p-active-projects` | `GCS_ACTIVE_BUCKET` / `GCS_PROJECT_BUCKET` | Active project folders — production files, sidecars, deliverables |
| `s2p-incoming-staging` | `GCS_STAGING_BUCKET` | Temporary staging for field technician uploads via share tokens |
| `s2p-quarantine` | (hardcoded) | Quarantine / archival bucket |

---

## 2. Authentication

### Server-Side (Node.js)

The server uses `@google-cloud/storage` with **Application Default Credentials (ADC)**. No service account JSON is needed in `.env`.

**Local development:**

```bash
# Install the gcloud CLI: https://cloud.google.com/sdk/docs/install
gcloud auth login
gcloud auth application-default login
gcloud config set project s2px-production
```

This creates credentials at `~/.config/gcloud/application_default_credentials.json` which the SDK discovers automatically.

**Production (Cloud Run):**

Auth is automatic via the Cloud Run service account. No configuration needed.

### Client-Side (Firebase SDK)

The client uses the Firebase JS SDK for read-only storage browsing. Auth is handled by 6 environment variables:

```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
```

These are provided in the `.env` file (see `.env.example` for the template).

---

## 3. Folder Structure

### Core Vault (`s2p-core-vault`)

```
scoping/
  {upid}/
    {fieldName}/
      {filename}            # e.g. insurance-cert.pdf

proposals/
  {upid}/
    proposal-v1-{timestamp}.pdf
```

### Active Projects (`s2p-active-projects`)

```
{Project Folder}/            # e.g. "Acme-Corp-2025-12-15/"
  project.json               # Auto-generated sidecar with full project context
  {Subfolder}/
    Point Cloud/             # .e57, .las, .laz, .pts, .rcp, .rcs
    BIM-CAD/                 # .rvt, .dwg, .ifc, .nwd
    Photos/                  # .jpg, .png, .heic
    Documents/               # .pdf, .docx, .xlsx
```

### Staging (`s2p-incoming-staging`)

```
{upid}/                      # e.g. "S2P-0042-2026/"
  {uploaded-filename}        # Field tech uploads via share tokens
```

---

## 4. How Uploads Work

All uploads go through the Express API. The client never writes directly to GCS.

| Endpoint | Auth | Target Bucket | Path Pattern |
|----------|------|---------------|-------------|
| `POST /api/uploads` | Firebase Bearer token | `s2p-core-vault` | `scoping/{upid}/{fieldName}/{filename}` |
| `POST /api/public/upload/{token}` | Share token (no Firebase) | `s2p-incoming-staging` | `{upid}/{filename}` |
| Scantech photo uploads | Firebase Bearer token | `s2p-active-projects` | `{projectFolder}/Photos/{filename}` |

Upload middleware: `multer` with memory storage, 50MB per-file limit.

---

## 5. How Downloads Work

The server generates **signed URLs** (v4) for secure time-limited downloads:

| Endpoint | Expiry | Use Case |
|----------|--------|----------|
| `GET /api/projects/gcs/browse?bucket=X&path=Y` | N/A | List files and folders in a bucket path |
| `GET /api/projects/gcs/download?bucket=X&path=Y` | 15 min | Download a file from the project browser |
| `GET /api/production/:id/assets/:assetId/download?path=Y` | 1 hour | Download a file linked to a production project |

The client-side Firebase SDK also provides read-only browsing via `listFiles()` and `getFileDownloadUrl()` in `client/src/services/storage.ts`.

---

## 6. Key Code Files

| File | Role |
|------|------|
| `server/routes/uploads.ts` | Scoping file uploads to core vault |
| `server/routes/proposals.ts` | Save/download proposal PDFs from core vault |
| `server/routes/projects-browse.ts` | Browse GCS folders, download files, bucket analytics |
| `server/routes/assets.ts` | Link GCS paths to production projects, browse/download assets |
| `server/routes/upload-shares.ts` | Create share tokens, handle public uploads to staging |
| `server/routes/scantech.ts` | Field ops file uploads to active projects |
| `server/routes/scantech-public.ts` | Token-validated field ops (no Firebase auth) |
| `server/lib/sidecarWriter.ts` | Write `project.json` sidecars to active projects |
| `client/src/services/storage.ts` | Client-side Firebase SDK bucket access |
| `client/src/services/firebase.ts` | Firebase app init + `getStorageBucket()` helper |

---

## 7. File Categories

Used across the codebase for organizing and classifying project files:

| Category | Extensions |
|----------|-----------|
| Point Cloud | `.e57` `.las` `.laz` `.pts` `.ptx` `.xyz` `.ply` `.pcd` `.rcp` `.rcs` |
| BIM / CAD | `.rvt` `.rfa` `.rte` `.rft` `.dwg` `.dxf` `.ifc` `.nwd` `.nwc` `.nwf` `.skp` `.3dm` |
| Realworks | `.rwp` `.rlp` `.rwi` |
| Photos | `.jpg` `.jpeg` `.png` `.tif` `.tiff` `.bmp` `.heic` `.raw` `.cr2` `.nef` |
| Archives | `.zip` `.rar` `.7z` `.tar` `.gz` |
| Documents | `.pdf` `.doc` `.docx` `.xls` `.xlsx` `.csv` `.txt` `.rtf` |

---

## 8. Downloading Projects to Synology NAS

Use these instructions to download all active project files from GCS to your local Synology network-attached storage device.

### Prerequisites

1. **Install the gcloud CLI** (if not already installed):
   ```bash
   # macOS
   brew install --cask google-cloud-sdk

   # Or download directly: https://cloud.google.com/sdk/docs/install
   ```

2. **Authenticate:**
   ```bash
   gcloud auth login
   gcloud config set project s2px-production
   ```

3. **Mount your Synology NAS** as a volume on your Mac (via Finder → Go → Connect to Server, or in System Settings → General → Login Items → mount at login). Note the mount path — it's typically something like:
   ```
   /Volumes/SynologyNAS/shared-folder/
   ```

### Download All Active Projects

```bash
# Replace /Volumes/YourNAS/S2PX-Backup with your actual NAS mount path

# Active project files (this is the big one — all production project data)
gcloud storage cp -r gs://s2p-active-projects/* /Volumes/YourNAS/S2PX-Backup/active-projects/

# Core vault (proposals, scoping uploads)
gcloud storage cp -r gs://s2p-core-vault/* /Volumes/YourNAS/S2PX-Backup/core-vault/

# Staging (field tech uploads — may be empty if files were already moved)
gcloud storage cp -r gs://s2p-incoming-staging/* /Volumes/YourNAS/S2PX-Backup/staging/

# Quarantine (archival)
gcloud storage cp -r gs://s2p-quarantine/* /Volumes/YourNAS/S2PX-Backup/quarantine/
```

### Tips

- **Parallel downloads** — For large buckets, gcloud automatically parallelizes transfers. You can increase throughput with:
  ```bash
  gcloud storage cp -r --billing-project=s2px-production gs://s2p-active-projects/* /Volumes/YourNAS/S2PX-Backup/active-projects/
  ```

- **Ongoing sync** — To keep the NAS in sync without re-downloading unchanged files:
  ```bash
  gcloud storage rsync -r gs://s2p-active-projects /Volumes/YourNAS/S2PX-Backup/active-projects/
  ```

- **Download a single project** — If you only need one project folder:
  ```bash
  gcloud storage cp -r "gs://s2p-active-projects/Acme-Corp-2025-12-15/" /Volumes/YourNAS/S2PX-Backup/active-projects/
  ```

- **List bucket contents first** — To see what's in a bucket before downloading:
  ```bash
  gcloud storage ls gs://s2p-active-projects/
  gcloud storage ls -l gs://s2p-active-projects/  # with sizes
  ```

- **Check bucket sizes** — To see total storage used:
  ```bash
  gcloud storage du -s gs://s2p-active-projects
  gcloud storage du -s gs://s2p-core-vault
  ```

### Troubleshooting

| Issue | Fix |
|-------|-----|
| `AccessDeniedException: 403` | Run `gcloud auth login` again, ensure your account has Storage Object Viewer role |
| `Billing project not set` | Add `--billing-project=s2px-production` to the command |
| NAS disconnects mid-download | Re-run the same command — `gcloud storage cp` skips existing files by default |
| Very slow transfers | Check NAS is connected via ethernet, not Wi-Fi. Consider running from a machine on the same LAN. |
