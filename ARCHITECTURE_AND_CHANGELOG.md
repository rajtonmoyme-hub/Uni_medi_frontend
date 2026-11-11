# Unified Health Platform — Frontend Architecture & Change Log

## 1. UI & Portal Architecture

1. **Collapsible AppShell Layout (`src/components/AppShellLayout.tsx`)**:
   - Persistent collapsible left sidebar (`240px` expanded / `64px` collapsed) across all 4 portals (`PATIENT`, `DOCTOR`, `WORKSPACE`, `CENTRAL_REGISTRY`).
   - Single-row institutional top bar with Persona Mode Switcher, Child/Senior Family Proxy Switcher (auto-validated against active `maintainedDependents`), and unread Notification Bell badge across all 4 portals.
2. **Reusable Components**:
   - `src/components/DataList.tsx`: Unified responsive sticky-header table with search/filter toolbars and optional row selection checkboxes.
   - `src/components/ModalDialog.tsx`: Native `<dialog closedby="any">` opened via `showModal()` with explicit `Escape` and outside-backdrop click dismissal fallback for Electron/Chromium runtimes.
   - `src/components/DocumentViewerModal.tsx` & `src/utils/pdfDownload.ts`: Structured viewer and direct A4 PDF export (`downloadClinicalDocumentPdf` and `downloadRegistryReportPdf`) for Prescriptions, Laboratory Reports, Billing Invoices, and DGHS Registry Dossiers.
3. **Four Role Portals (`src/portals/`)**:
   - **Patient Portal (`PatientPortal.tsx`)**: Top subgrid-aligned `<article>` Health Package Cards on `Overview` and `Hospitals & Packages`, selectable `Medical Records` with 2-hour QR generation popup, `Doctors` fee-range directory + Hospital/Independent Chamber appointment booking with inline error feedback, list-only `Family` proxy management, dedicated `Notifications` invitation inbox, and centered `Profile`.
   - **Doctor Portal (`DoctorPortal.tsx`)**: Stacked QR consultation queue, locked prescription writer, lifetime prescription archive, Hospital `Affiliations` with `Revoke` + instant `Undo Revoke` / `Re-request Affiliation`, `Notifications`, and centered `Profile`.
   - **Hospital / Workspace Portal (`WorkspacePortal.tsx`)**: Dynamic 24-permission Role Perspective switcher, Appointments, Laboratory Reports, Billing, Doctors (`Invite`, `Revoke`, `Undo Revoke`), Health Packages, Staff & Dynamic Roles, Audit Trail (displaying invitation & acceptance logs), and centered `Profile`.
   - **Central Registry Portal (`CentralRegistryPortal.tsx`)**: Redesigned 6-KPI National System Overview with `Hospital <-> Doctor`, `Patient <-> Doctor`, `Hospital <-> Patient`, and `Family` connection matrices, dedicated full-page Patient/Doctor/Facility dossiers (zero inspection popups), Central Registry `Notifications` page, and full PDF exports.

---

## 2. Change Log

- **[2026-11-10]**: Implemented initial multi-portal React + Vite + Electron application.
- **[2026-11-11]**:
  - Redesigned UI with `IBM Plex Sans`/`IBM Plex Mono`, zero animations, collapsible sidebar, unified `<DataList />`, and PDF downloads.
  - Added top `<article>` Health Package Card grids, fixed Doctor Appointment booking (Hospital + Independent Chamber + inline error handling), and centered `Profile` across portals.
  - Added `Undo Revoke` & `Re-request` for Doctor/Hospital affiliations.
  - Rebuilt Central Registry with centralized ecosystem overview, dedicated full-page inspection views, Central Registry Notification Center, bi-directional connection links, and PDF dossier downloads.
  - Fixed modal outside-click light-dismiss and `Esc` handling across web & Electron.
  - Separated `frontend/` into a standalone Git repository with hardened `.gitignore` and `.env.example`.
