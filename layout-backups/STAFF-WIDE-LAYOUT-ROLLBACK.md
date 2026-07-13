# Staff Dashboard — Wide Layout Rollback

Applied: wide staff dashboard layout (desktop sidebar + wider page).

## Restore old design (3 files)

From project root in PowerShell:

```powershell
Copy-Item -Force "app\globals.css.backup-staff-wide-layout" "app\globals.css"
Copy-Item -Force "app\b\[slug]\staff\page.js.backup-staff-wide-layout" "app\b\[slug]\staff\page.js"
Copy-Item -Force "components\StaffClient.js.backup-staff-wide-layout" "components\StaffClient.js"
```

Or tell the agent: **"ارجع تصميم Staff القديم"**

## Backup files

- `app/globals.css.backup-staff-wide-layout`
- `app/b/[slug]/staff/page.js.backup-staff-wide-layout`
- `components/StaffClient.js.backup-staff-wide-layout`

## What changed (layout only)

- `fb-page-staff` — wider max-width on large screens (staff page only)
- `StaffClient` — xl+ two columns: prep/filters left, search + orders right
- Order cards — more columns on 2xl screens

No API, state, or order logic was changed.
