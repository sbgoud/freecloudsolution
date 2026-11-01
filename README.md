# TG Drive

TG Drive turns your Telegram **Saved Messages** into a private, Google
Drive-like file store. It runs entirely in the browser with
[GramJS](https://github.com/gram-js/gramjs), so your files live in Telegram.
There is no application backend and no separate storage service.

**TG Drive is a pure open-source project by [sbgoud](https://github.com/sbgoud/freecloudsolution).**

Built with Vite, React, TypeScript, Tailwind CSS and shadcn/ui. The interface
supports light and dark themes, follows your system preference, and is designed
for keyboard and mobile use.

## Features

- **Sign in with Telegram**
  - QR code login (Settings → Devices → Link Desktop Device)
  - Phone number + OTP code
  - Two-factor (2FA) password prompt when your account has it enabled
- **Folders** — browse a folder tree, create folders, rename and move them
- **Grid and list views** — the chosen view is remembered locally
- **Search** — search files and folders across the whole drive
- **Uploads**
  - Drag and drop or pick individual files
  - Upload whole folders, preserving their nested structure
  - Files up to **2 GB** on a free Telegram account and **4 GB** with Premium
  - Queued uploads with per-file progress and cancellation
- **Downloads** — download a single file or multiple selected files
- **File management** — rename, move and delete files and folders
- **New folder** — create folders at the current location
- **Unsorted** — media in Saved Messages without TG Drive metadata appears in
  an automatically generated `/Unsorted` folder so nothing is hidden

## How metadata is stored

TG Drive does not keep a database. All metadata lives in the caption of each
Telegram message:

- **Files** use a two-line caption:

  ```text
  #tgdrive
  {"v":1,"path":"/Documents/report.pdf"}
  ```

- **Folders** are marker messages whose second line identifies them as a folder:

  ```text
  #tgdrive
  {"v":1,"type":"folder","path":"/Documents"}
  ```

- **Legacy captions** of the form `#tgdrive path=/Documents/report.pdf` are also
  accepted, so older drives keep working.

Renaming or moving an item simply updates the `path` in its caption. The
current path is the source of truth for folder structure.

## Privacy

- Your Telegram session string is stored **only in `localStorage`** in your
  browser. It is used to reconnect to Telegram on the next visit.
- There is no server or database operated by this app. Files and metadata stay
  in your own Telegram account and are fetched directly from Telegram.
- Logging out clears the stored session and logs the client out of Telegram.
- Theme preference is stored locally under `tg-drive-theme`.

## Local development

Requires Node.js and [pnpm](https://pnpm.io/).

```bash
pnpm install
pnpm dev
```

The dev server runs at http://localhost:8080 by default.

Other useful commands:

```bash
pnpm build     # production build
pnpm preview   # preview the production build
pnpm lint      # run ESLint
```

## Configuration

Telegram API credentials are read from two Vite environment variables:

| Variable           | Description          |
| ------------------ | -------------------- |
| `VITE_TG_API_ID`   | Your Telegram API ID |
| `VITE_TG_API_HASH` | Your Telegram API hash |

Get them at <https://my.telegram.org> → **API development tools** → create an
application, then copy the `api_id` and `api_hash` values.

For local development, copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

```text
VITE_TG_API_ID=1234567
VITE_TG_API_HASH=your_api_hash_here
```

### Deploying to Vercel

1. Open your project on Vercel: **Project → Settings → Environment Variables**.
2. Add both `VITE_TG_API_ID` and `VITE_TG_API_HASH`.
3. Apply them to **Production** and **Preview** environments.
4. Redeploy the project so the new variables are baked into the build.

Without these variables the app falls back to built-in default credentials,
which may be rate-limited or unavailable — set your own for reliable use.

## About

**TG Drive is a pure open-source project by
[sbgoud](https://github.com/sbgoud/freecloudsolution).**

Source code, issues and releases live at
<https://github.com/sbgoud/freecloudsolution>. Contributions are welcome.
