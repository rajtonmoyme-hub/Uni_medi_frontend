import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  ArrowLeft,
  Building2,
  CheckCheck,
  Download,
  Eye,
  Package,
  ShieldCheck,
} from 'lucide-react';
import { apiRequest } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { DataList } from '../components/DataList';
import { DocumentViewerModal } from '../components/DocumentViewerModal';
import { StatusBadge } from '../components/StatusBadge';
import { TransientToast } from '../components/TransientToast';
import {
  downloadClinicalDocumentPdf,
  downloadRegistryReportPdf,
} from '../utils/pdfDownload';

type DetailEntityKind = 'PATIENT' | 'DOCTOR' | 'WORKSPACE';

interface DetailViewState {
  kind: DetailEntityKind;
  data: any;
  returnSection: string;
}

const RegistryPackageCardGrid: React.FC<{
  packages: any[];
  onOpenWorkspace?: (workspaceId: string) => void;
  emptyMessage?: string;
}> = ({
  packages,
  onOpenWorkspace,
  emptyMessage = 'No health packages offered by this workspace yet.',
}) => {
  if (!packages || packages.length === 0) {
    return (
      <div className="rounded-md border border-line bg-paper px-4 py-6 text-center text-sm text-mut">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="package-card-grid">
      {packages.map((pkg: any) => {
        const price = Number(pkg.price || 0);
        const origPrice = pkg.originalPrice ? Number(pkg.originalPrice) : null;
        return (
          <article key={pkg.id} className="package-card">
            <div className="space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-base font-semibold text-ink leading-snug">
                  {pkg.title}
                </h3>
                <StatusBadge label={pkg.isActive ? 'ACTIVE' : 'PAUSED'} />
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-mut">
                {pkg.packageCode && (
                  <span className="font-mono text-ink-2">{pkg.packageCode}</span>
                )}
                {pkg.workspace && (
                  <>
                    <span>·</span>
                    {onOpenWorkspace && pkg.workspace.id ? (
                      <button
                        type="button"
                        onClick={() => onOpenWorkspace(pkg.workspace.id)}
                        className="inline-flex items-center gap-1 font-semibold text-brand-800 hover:text-brand-900 underline underline-offset-2 text-left"
                      >
                        <Building2 className="w-3 h-3 shrink-0" />
                        <span>{pkg.workspace.name}</span>
                      </button>
                    ) : (
                      <span className="font-medium text-ink-2">
                        {pkg.workspace.name}
                      </span>
                    )}
                    {pkg.workspace.area && <span>({pkg.workspace.area})</span>}
                  </>
                )}
              </div>
            </div>

            <div className="space-y-2.5">
              {(pkg.tagline || pkg.description) && (
                <p className="text-xs text-mut leading-relaxed">
                  {pkg.tagline || pkg.description}
                </p>
              )}
              {Array.isArray(pkg.includedTests) &&
                pkg.includedTests.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {pkg.includedTests.map((testName: string, i: number) => (
                      <span
                        key={i}
                        className="inline-flex items-center rounded bg-paper-2 border border-line px-2 py-0.5 text-xs text-ink-2"
                      >
                        {testName}
                      </span>
                    ))}
                  </div>
                )}
            </div>

            <div className="pt-2.5 border-t border-line flex items-end justify-between gap-2">
              <div className="text-xs text-mut">
                {pkg.durationLabel || 'Comprehensive Package'}
              </div>
              <div className="text-right">
                {origPrice && origPrice > price && (
                  <div className="text-xs font-mono text-mut line-through">
                    {origPrice.toLocaleString()} Tk
                  </div>
                )}
                <div className="text-base font-semibold font-mono text-brand-700">
                  {price.toLocaleString()} Tk
                </div>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
};

export const CentralRegistryPortal: React.FC = () => {
  const {
    user,
    activeSection,
    sectionNavTick,
    setActiveSection,
    refreshUnreadCount,
  } = useAuth();

  const [overview, setOverview] = useState<any>(null);
  const [patients, setPatients] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notifFilter, setNotifFilter] = useState<'ALL' | 'PENDING' | 'UNREAD'>(
    'ALL'
  );

  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Directory Filters
  const [patientSearch, setPatientSearch] = useState<string>('');
  const [patientStatusFilter, setPatientStatusFilter] = useState<string>('');
  const [doctorStatusFilter, setDoctorStatusFilter] = useState<string>('');
  const [doctorSearch, setDoctorSearch] = useState<string>('');
  const [workspaceStatusFilter, setWorkspaceStatusFilter] =
    useState<string>('');
  const [workspaceSearch, setWorkspaceSearch] = useState<string>('');

  // Dedicated Full-Page Entity Dossier (Replaces Cramped Inspection Popups)
  const [detailView, setDetailView] = useState<DetailViewState | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);

  // Clinical Record Preview Modal (Supports Esc + Outside Backdrop Click)
  const [inspectedDocRecord, setInspectedDocRecord] = useState<any | null>(
    null
  );
  const [inspectedDocPatient, setInspectedDocPatient] = useState<any | null>(
    null
  );

  // Clear detailView whenever user clicks any sidebar/navbar section tab
  const suppressNextNavResetRef = useRef<boolean>(false);
  const prevNavTickRef = useRef<number>(sectionNavTick);
  useEffect(() => {
    if (prevNavTickRef.current !== sectionNavTick) {
      prevNavTickRef.current = sectionNavTick;
      if (suppressNextNavResetRef.current) {
        suppressNextNavResetRef.current = false;
        return;
      }
      setDetailView(null);
    }
  }, [sectionNavTick]);

  const loadOverview = useCallback(async () => {
    try {
      const res = await apiRequest('/central-registry/overview');
      setOverview(res);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: err.message || 'Failed to load Central Registry overview.',
      });
    }
  }, []);

  const loadPatients = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (patientSearch) params.set('search', patientSearch);
      if (patientStatusFilter) params.set('status', patientStatusFilter);
      const res = await apiRequest(
        `/central-registry/patients?${params.toString()}`
      );
      setPatients(res.patients || []);
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message });
    }
  }, [patientSearch, patientStatusFilter]);

  const loadDoctors = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (doctorStatusFilter) params.set('approvalStatus', doctorStatusFilter);
      if (doctorSearch) params.set('search', doctorSearch);
      const res = await apiRequest(
        `/central-registry/doctors?${params.toString()}`
      );
      setDoctors(res.doctors || []);
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message });
    }
  }, [doctorStatusFilter, doctorSearch]);

  const loadWorkspaces = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (workspaceStatusFilter)
        params.set('approvalStatus', workspaceStatusFilter);
      if (workspaceSearch) params.set('search', workspaceSearch);
      const res = await apiRequest(
        `/central-registry/workspaces?${params.toString()}`
      );
      setWorkspaces(res.workspaces || []);
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message });
    }
  }, [workspaceStatusFilter, workspaceSearch]);

  const loadNotifications = useCallback(async () => {
    try {
      const res = await apiRequest('/notifications?persona=CENTRAL_REGISTRY');
      setNotifications(res.notifications || []);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadOverview();
    loadPatients();
    loadDoctors();
    loadWorkspaces();
    loadNotifications();
  }, [
    loadOverview,
    loadPatients,
    loadDoctors,
    loadWorkspaces,
    loadNotifications,
  ]);

  // Full-Page Navigation Openers (redirects to corresponding directory section + details page)
  const openPatientPage = async (
    patientId: string,
    returnTo?: string
  ): Promise<void> => {
    const originSection =
      returnTo || detailView?.returnSection || activeSection;
    setLoadingDetail(true);
    try {
      const res = await apiRequest(
        `/central-registry/patients/${patientId}/inspect`
      );
      setDetailView({
        kind: 'PATIENT',
        data: res,
        returnSection: originSection,
      });
      if (activeSection !== 'patients') {
        suppressNextNavResetRef.current = true;
        setActiveSection('patients');
      }
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setLoadingDetail(false);
    }
  };

  const openDoctorPage = async (
    doctorId: string,
    returnTo?: string
  ): Promise<void> => {
    const originSection =
      returnTo || detailView?.returnSection || activeSection;
    setLoadingDetail(true);
    try {
      const res = await apiRequest(
        `/central-registry/doctors/${doctorId}/inspect`
      );
      setDetailView({
        kind: 'DOCTOR',
        data: res,
        returnSection: originSection,
      });
      if (activeSection !== 'doctors') {
        suppressNextNavResetRef.current = true;
        setActiveSection('doctors');
      }
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setLoadingDetail(false);
    }
  };

  const openWorkspacePage = async (
    workspaceId: string,
    returnTo?: string
  ): Promise<void> => {
    const originSection =
      returnTo || detailView?.returnSection || activeSection;
    setLoadingDetail(true);
    try {
      const res = await apiRequest(
        `/central-registry/workspaces/${workspaceId}/inspect`
      );
      setDetailView({
        kind: 'WORKSPACE',
        data: res,
        returnSection: originSection,
      });
      if (activeSection !== 'hospitals') {
        suppressNextNavResetRef.current = true;
        setActiveSection('hospitals');
      }
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleBackFromDetail = () => {
    const target = detailView?.returnSection || activeSection;
    setDetailView(null);
    if (target !== activeSection) {
      suppressNextNavResetRef.current = true;
      setActiveSection(target);
    }
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  };

  // Governance Status Mutations
  const handleTogglePatientStatus = async (
    patientId: string,
    newStatus: 'ACTIVE' | 'DISABLED'
  ) => {
    try {
      const res = await apiRequest(
        `/central-registry/patients/${patientId}/status`,
        {
          method: 'PATCH',
          body: { status: newStatus },
        }
      );
      setFeedback({ type: 'success', text: res.message });
      await Promise.all([loadPatients(), loadOverview()]);
      if (
        detailView?.kind === 'PATIENT' &&
        detailView.data?.patient?.id === patientId
      ) {
        const updated = await apiRequest(
          `/central-registry/patients/${patientId}/inspect`
        );
        setDetailView((prev) => (prev ? { ...prev, data: updated } : null));
      }
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message });
    }
  };

  const handleUpdateDoctorStatus = async (
    doctorId: string,
    approvalStatus: 'APPROVED' | 'DECLINED' | 'DISABLED' | 'PENDING'
  ) => {
    try {
      const res = await apiRequest(
        `/central-registry/doctors/${doctorId}/status`,
        {
          method: 'PATCH',
          body: {
            approvalStatus,
            dghsNotes: `DGHS status updated to ${approvalStatus}.`,
          },
        }
      );
      setFeedback({ type: 'success', text: res.message });
      await Promise.all([
        loadDoctors(),
        loadOverview(),
        loadNotifications(),
        refreshUnreadCount(),
      ]);
      if (
        detailView?.kind === 'DOCTOR' &&
        detailView.data?.doctor?.id === doctorId
      ) {
        const updated = await apiRequest(
          `/central-registry/doctors/${doctorId}/inspect`
        );
        setDetailView((prev) => (prev ? { ...prev, data: updated } : null));
      }
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message });
    }
  };

  const handleUpdateWorkspaceStatus = async (
    workspaceId: string,
    approvalStatus: 'APPROVED' | 'DECLINED' | 'DISABLED' | 'PENDING'
  ) => {
    try {
      const res = await apiRequest(
        `/central-registry/workspaces/${workspaceId}/status`,
        {
          method: 'PATCH',
          body: {
            approvalStatus,
            dghsNotes: `DGHS status updated to ${approvalStatus}.`,
          },
        }
      );
      setFeedback({ type: 'success', text: res.message });
      await Promise.all([
        loadWorkspaces(),
        loadOverview(),
        loadNotifications(),
        refreshUnreadCount(),
      ]);
      if (
        detailView?.kind === 'WORKSPACE' &&
        detailView.data?.workspace?.id === workspaceId
      ) {
        const updated = await apiRequest(
          `/central-registry/workspaces/${workspaceId}/inspect`
        );
        setDetailView((prev) => (prev ? { ...prev, data: updated } : null));
      }
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message });
    }
  };

  // Notification Actions
  const handleMarkOneRead = async (notifId: string) => {
    try {
      await apiRequest(`/notifications/${notifId}/read`, { method: 'PATCH' });
      await Promise.all([loadNotifications(), refreshUnreadCount()]);
    } catch {
      // ignore
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await apiRequest('/notifications/read-all', {
        method: 'POST',
        body: { persona: 'CENTRAL_REGISTRY' },
      });
      await Promise.all([loadNotifications(), refreshUnreadCount()]);
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message });
    }
  };

  // Unified Notifications + Live Pending Verification Queue
  const unifiedRegistryNotifications = useMemo(() => {
    const rows: any[] = [];

    for (const doc of overview?.pendingApprovals?.doctors || []) {
      rows.push({
        rowId: `pending-doc-${doc.id}`,
        kind: 'PENDING_DOCTOR',
        doctorId: doc.id,
        isPendingAction: true,
        isUnread: true,
        category: 'Doctor Verification',
        title: `${doc.patientUser?.name || 'Applicant'} (${doc.doctorIdCode}) — Pending BMDC Approval`,
        message: `Specialty: ${doc.specialty} · BMDC License: ${doc.doctorLicense} · NID: ${doc.nationalId}`,
        createdAt: doc.createdAt,
      });
    }

    for (const ws of overview?.pendingApprovals?.workspaces || []) {
      rows.push({
        rowId: `pending-ws-${ws.id}`,
        kind: 'PENDING_WORKSPACE',
        workspaceId: ws.id,
        isPendingAction: true,
        isUnread: true,
        category: 'Facility Verification',
        title: `${ws.name} (${ws.workspaceCode}) — Pending License Approval`,
        message: `Type: ${ws.type} · License: ${ws.registrationLicense} · Primary Owner: ${ws.owner?.name}`,
        createdAt: ws.createdAt,
      });
    }

    for (const n of notifications) {
      rows.push({
        rowId: `notif-${n.id}`,
        notifId: n.id,
        kind: 'DB_NOTIFICATION',
        doctorId: n.metadata?.doctorId,
        workspaceId: n.metadata?.workspaceId,
        patientId: n.metadata?.patientId,
        isPendingAction: false,
        isUnread: !n.isRead,
        category: n.type ? n.type.replace(/_/g, ' ') : 'System Alert',
        title: n.title,
        message: n.message,
        createdAt: n.createdAt,
      });
    }

    if (notifFilter === 'PENDING') {
      return rows.filter((r) => r.isPendingAction);
    }
    if (notifFilter === 'UNREAD') {
      return rows.filter((r) => r.isUnread);
    }
    return rows;
  }, [overview, notifications, notifFilter]);

  // PDF Export Helpers for Central Registry
  const handleExportOverviewPdf = () => {
    if (!overview) return;
    const m = overview.metrics;
    const eco = overview.ecosystemConnections || {};
    downloadRegistryReportPdf({
      title: 'National Centralized Health Ecosystem Overview Report',
      code: `DGHS-OVERVIEW-${new Date().toISOString().slice(0, 10)}`,
      subtitle:
        'Consolidated governance summary across Patients, BMDC Doctors, Registered Healthcare Facilities, Clinical Vault Documents, and Cross-Entity Connections.',
      metrics: [
        { label: 'Total Patients', value: m.patients.total },
        { label: 'Approved Doctors', value: m.doctors.APPROVED },
        { label: 'Approved Facilities', value: m.workspaces.APPROVED },
        { label: 'Medical Records', value: m.clinical.totalVaultDocs },
        {
          label: 'Active Dr-Hospital Links',
          value: m.connections?.activeDoctorHospitalAffiliations ?? 0,
        },
        {
          label: 'Patient-Doctor Pairs',
          value: m.connections?.doctorPatientPairsCount ?? 0,
        },
      ],
      sections: [
        {
          heading: 'Hospital <-> Doctor & Patient Ecosystem Summary',
          rows: (eco.hospitalEcosystemSummary || []).map(
            (h: any) =>
              `${h.name} (${h.workspaceCode}) [${h.approvalStatus}] — ${h.affiliatedDoctorsCount} Doctors, ${h.connectedPatientsCount} Patients, ${h.staffCount} Staff, ${h.recordsCount} Records`
          ),
        },
        {
          heading: 'Hospital <-> Doctor Chamber & Consultation Fee Matrix',
          rows: (eco.hospitalDoctorMatrix || []).map(
            (r: any) =>
              `${r.doctorName} (${r.doctorCode}, ${r.specialty}) <-> ${r.workspaceName} (${r.workspaceCode}) — Fee: ${Number(r.consultationFee || 0).toLocaleString()} Tk [${r.status}]`
          ),
        },
        {
          heading: 'Patient <-> Doctor Clinical Consultation Connections',
          rows: (eco.patientDoctorMatrix || []).map(
            (r: any) =>
              `${r.patientName} (${r.patientCode}) <-> ${r.doctorName} (${r.doctorCode}) — ${r.prescriptionsCount} Prescriptions, ${r.appointmentsCount} Appointments`
          ),
        },
        {
          heading: 'Family Proxy Governance (Maintainer <-> Child / Senior)',
          rows: (eco.familyLinks || []).map(
            (f: any) =>
              `Maintainer: ${f.maintainer?.name} (${f.maintainer?.uniqueId}) -> Dependent: ${f.dependent?.name} (${f.dependent?.uniqueId}, ${f.dependent?.accountType}) [${f.status}]`
          ),
        },
      ],
    });
  };

  const handleExportPatientDossierPdf = (payload: any) => {
    const p = payload.patient;
    const docs = p.vaultDocuments || [];
    const docConns = payload.doctorConnections || [];
    const hospConns = payload.hospitalConnections || [];
    const famDeps = p.maintainedDependents || [];
    const famMaints = p.managedByMaintainers || [];

    downloadRegistryReportPdf({
      title: `Patient Registry Dossier — ${p.name}`,
      code: p.uniqueId,
      subtitle: `Category: ${p.accountType} | Status: ${p.status} | Email: ${p.email || '—'} | Phone: ${p.phone || '—'} | Blood Group: ${p.bloodGroup || '—'}`,
      metrics: [
        { label: 'Vault Records', value: docs.length },
        { label: 'Connected Doctors', value: docConns.length },
        { label: 'Connected Hospitals', value: hospConns.length },
        {
          label: 'Family Proxy Links',
          value: famDeps.length + famMaints.length,
        },
      ],
      sections: [
        {
          heading: 'Patient <-> Doctor Consultation Connections',
          rows: docConns.map(
            (dc: any) =>
              `${dc.doctorName} (${dc.doctorCode || 'BMDC'}, ${dc.specialty}) — ${dc.prescriptionsCount} Prescriptions, ${dc.appointmentsCount || 0} Appointments, ${dc.qrScansCount} QR Scans`
          ),
        },
        {
          heading: 'Patient <-> Hospital & Facility Connections',
          rows: hospConns.map(
            (hc: any) =>
              `${hc.workspaceName} (${hc.workspaceCode}) — ${hc.documentsCount} Clinical Records, ${hc.appointmentsCount} Appointments`
          ),
        },
        {
          heading: 'Family Proxy Relationships (Child / Senior)',
          rows: [
            ...famDeps.map(
              (r: any) =>
                `Maintains Dependent: ${r.dependent?.name} (${r.dependent?.uniqueId}, ${r.dependent?.accountType}) [${r.status}]`
            ),
            ...famMaints.map(
              (r: any) =>
                `Managed By Maintainer: ${r.maintainer?.name} (${r.maintainer?.uniqueId}) [${r.status}]`
            ),
          ],
        },
        {
          heading: 'Medical Records Vault Summary',
          rows: docs.map(
            (d: any) =>
              `[${d.type}] ${d.documentCode} — ${d.title} (${d.workspace?.name || d.workspaceNameSnapshot || 'Independent Chamber'}, ${new Date(d.createdAt).toLocaleDateString()})`
          ),
        },
      ],
    });
  };

  const handleExportDoctorDossierPdf = (payload: any) => {
    const d = payload.doctor;
    const fees = payload.consultationFeesByWorkspace || [];
    const pats = payload.connectedPatients || [];
    const issued = d.issuedDocuments || [];

    downloadRegistryReportPdf({
      title: `Doctor Registry Dossier — ${d.patientUser?.name}`,
      code: d.doctorIdCode,
      subtitle: `Specialty: ${d.specialty} | BMDC License: ${d.doctorLicense} | NID: ${d.nationalId} | DGHS Status: ${d.approvalStatus}`,
      metrics: [
        { label: 'DGHS Status', value: d.approvalStatus },
        {
          label: 'Hospital Affiliations',
          value: (d.workspaceAffiliations || []).length,
        },
        { label: 'Connected Patients', value: pats.length },
        { label: 'Issued Prescriptions', value: issued.length },
      ],
      sections: [
        {
          heading: 'Doctor <-> Hospital Chamber & Consultation Fee Schedule',
          rows: fees.map(
            (f: any) =>
              `${f.workspaceName}${f.workspaceCode ? ` (${f.workspaceCode})` : ''} — Fee: ${Number(f.consultationFee || 0).toLocaleString()} Tk | Schedule: ${f.schedule || 'Standard'} [${f.status}]`
          ),
        },
        {
          heading: 'Doctor <-> Patient Clinical Connections',
          rows: pats.map(
            (cp: any) =>
              `${cp.name} (${cp.uniqueId}) — ${cp.prescriptionsIssued} Prescriptions, ${cp.appointmentsCount} Appointments, ${cp.qrScansCount} QR Scans`
          ),
        },
        {
          heading: 'Issued Immutable Prescriptions',
          rows: issued.map(
            (rx: any) =>
              `${rx.documentCode} — ${rx.title} for ${rx.patient?.name} (${rx.patient?.uniqueId}) on ${new Date(rx.createdAt).toLocaleDateString()}`
          ),
        },
      ],
    });
  };

  const handleExportWorkspaceDossierPdf = (payload: any) => {
    const ws = payload.workspace;
    const docs = ws.doctorAffiliations || [];
    const pats = payload.connectedPatients || [];
    const members = ws.members || [];
    const pkgs = ws.packages || [];

    downloadRegistryReportPdf({
      title: `Healthcare Facility Dossier — ${ws.name}`,
      code: ws.workspaceCode,
      subtitle: `Category: ${ws.type} | License: ${ws.registrationLicense} | Area: ${ws.area} | Primary Owner: ${ws.owner?.name} (${ws.owner?.uniqueId}) | Status: ${ws.approvalStatus}`,
      metrics: [
        { label: 'Approval Status', value: ws.approvalStatus },
        { label: 'Affiliated Doctors', value: docs.length },
        { label: 'Connected Patients', value: pats.length },
        { label: 'Staff Members', value: members.length },
        { label: 'Health Packages', value: pkgs.length },
        { label: 'Clinical Records', value: (ws.vaultDocuments || []).length },
      ],
      sections: [
        {
          heading: 'Hospital <-> Doctor Affiliations',
          rows: docs.map(
            (aff: any) =>
              `${aff.doctor?.patientUser?.name} (${aff.doctor?.doctorIdCode}, ${aff.doctor?.specialty}) — Fee: ${Number(aff.consultationFee || 0).toLocaleString()} Tk | ${aff.schedule} [${aff.status}]`
          ),
        },
        {
          heading: 'Hospital <-> Patient Connections',
          rows: pats.map(
            (cp: any) =>
              `${cp.name} (${cp.uniqueId}) — ${cp.documentsCount} Lab/Billing Records, ${cp.appointmentsCount} Appointments`
          ),
        },
        {
          heading: 'Staff Roster & Assigned RBAC Roles',
          rows: members.map(
            (m: any) =>
              `${m.patientUser?.name} (${m.patientUser?.uniqueId}) — Roles: ${m.isOwner ? 'Primary Owner, ' : ''}${(m.roleNames || []).join(', ') || 'Staff'} (${m.combinedPermissions?.length || 0} perms) [${m.invitationStatus}]`
          ),
        },
        {
          heading: 'Published Health Packages',
          rows: pkgs.map(
            (p: any) =>
              `${p.title} — ${Number(p.price || 0).toLocaleString()} Tk (${p.isActive ? 'ACTIVE' : 'PAUSED'})`
          ),
        },
      ],
    });
  };

  return (
    <div className="space-y-6">
      <TransientToast
        notification={feedback}
        onDismiss={() => setFeedback(null)}
      />

      {loadingDetail && (
        <div className="rounded-md border border-line bg-paper px-4 py-3 text-sm text-mut">
          Loading national registry dossier...
        </div>
      )}

      {/* =================================================================== */}
      {/* DEDICATED FULL-PAGE ENTITY DOSSIERS (NO CRAMPED INSPECTION POPUPS)  */}
      {/* =================================================================== */}
      {detailView?.kind === 'PATIENT' && detailView.data?.patient && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleBackFromDetail}
              className="btn-secondary"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleExportPatientDossierPdf(detailView.data)}
                className="btn-secondary"
              >
                <Download className="w-4 h-4" />
                <span>Download Dossier PDF</span>
              </button>
              {detailView.data.patient.status === 'ACTIVE' ? (
                <button
                  type="button"
                  onClick={() =>
                    handleTogglePatientStatus(
                      detailView.data.patient.id,
                      'DISABLED'
                    )
                  }
                  className="btn-danger"
                >
                  Disable Patient Account
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    handleTogglePatientStatus(
                      detailView.data.patient.id,
                      'ACTIVE'
                    )
                  }
                  className="btn-primary"
                >
                  Enable Patient Account
                </button>
              )}
            </div>
          </div>

          <div className="bg-paper border border-line rounded-md p-5 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-semibold text-ink">
                    {detailView.data.patient.name}
                  </h1>
                  <StatusBadge label={detailView.data.patient.status} />
                  <StatusBadge
                    label={detailView.data.patient.accountType}
                    tone="neutral"
                  />
                </div>
                <p className="text-sm text-mut mt-1">
                  Patient ID:{' '}
                  <span className="font-mono text-ink-2">
                    {detailView.data.patient.uniqueId}
                  </span>
                  {detailView.data.patient.nationalId
                    ? ` · NID: ${detailView.data.patient.nationalId}`
                    : ''}
                  {detailView.data.patient.bloodGroup
                    ? ` · Blood Group: ${detailView.data.patient.bloodGroup}`
                    : ''}
                </p>
              </div>
              <div className="text-sm text-right space-y-0.5">
                <div className="text-ink-2">
                  {detailView.data.patient.email || 'Managed Proxy Account'}
                </div>
                <div className="font-mono text-xs text-mut">
                  {detailView.data.patient.phone || '—'}
                </div>
                {detailView.data.patient.address && (
                  <div className="text-xs text-mut">
                    {detailView.data.patient.address}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-line">
              <div className="rounded border border-line bg-paper-2 p-3">
                <div className="text-xs text-mut">Medical Records</div>
                <div className="text-xl font-semibold font-mono text-ink mt-0.5">
                  {detailView.data.patient.vaultDocuments?.length || 0}
                </div>
              </div>
              <div className="rounded border border-line bg-paper-2 p-3">
                <div className="text-xs text-mut">Connected Doctors</div>
                <div className="text-xl font-semibold font-mono text-brand-700 mt-0.5">
                  {detailView.data.doctorConnections?.length || 0}
                </div>
              </div>
              <div className="rounded border border-line bg-paper-2 p-3">
                <div className="text-xs text-mut">Connected Hospitals</div>
                <div className="text-xl font-semibold font-mono text-brand-700 mt-0.5">
                  {detailView.data.hospitalConnections?.length || 0}
                </div>
              </div>
              <div className="rounded border border-line bg-paper-2 p-3">
                <div className="text-xs text-mut">Family Proxy Links</div>
                <div className="text-xl font-semibold font-mono text-ink mt-0.5">
                  {(detailView.data.patient.maintainedDependents?.length || 0) +
                    (detailView.data.patient.managedByMaintainers?.length || 0)}
                </div>
              </div>
            </div>
          </div>

          {/* Patient <-> Doctor Connections */}
          <DataList
            title={`Patient ↔ Doctor Connections (${detailView.data.doctorConnections?.length || 0})`}
            description="All specialists connected to this patient via prescriptions, appointments, or QR consultations. Click a doctor's name to open their Doctor Details Page."
            data={detailView.data.doctorConnections || []}
            getRowId={(dc: any) => dc.doctorId}
            emptyMessage="No doctor connections recorded for this patient."
            columns={[
              {
                key: 'doc',
                header: 'Connected Doctor',
                render: (dc: any) => (
                  <button
                    type="button"
                    onClick={() => openDoctorPage(dc.doctorId)}
                    className="text-left group"
                  >
                    <div className="font-semibold text-brand-800 group-hover:text-brand-900 underline underline-offset-2">
                      {dc.doctorName}
                    </div>
                    <div className="font-mono text-xs text-mut">
                      {dc.doctorCode} · {dc.specialty}
                    </div>
                  </button>
                ),
              },
              {
                key: 'interactions',
                header: 'Clinical Interactions',
                align: 'right',
                render: (dc: any) => (
                  <span className="font-mono text-xs text-brand-700">
                    {dc.prescriptionsCount || 0} Prescriptions ·{' '}
                    {dc.appointmentsCount || 0} Appointments ·{' '}
                    {dc.qrScansCount || 0} QR Scans
                  </span>
                ),
              },
            ]}
          />

          {/* Patient <-> Hospital Connections */}
          <DataList
            title={`Patient ↔ Hospital Connections (${detailView.data.hospitalConnections?.length || 0})`}
            description="Healthcare facilities that have issued laboratory reports, billing statements, or appointments for this patient. Click a facility name to open its Hospital Details Page."
            data={detailView.data.hospitalConnections || []}
            getRowId={(hc: any) => hc.workspaceId}
            emptyMessage="No hospital or diagnostic center connections recorded."
            columns={[
              {
                key: 'ws',
                header: 'Facility',
                render: (hc: any) => (
                  <button
                    type="button"
                    onClick={() => openWorkspacePage(hc.workspaceId)}
                    className="text-left group"
                  >
                    <div className="font-semibold text-brand-800 group-hover:text-brand-900 underline underline-offset-2">
                      {hc.workspaceName}
                    </div>
                    <div className="font-mono text-xs text-mut">
                      {hc.workspaceCode}
                      {hc.area ? ` · ${hc.area}` : ''}
                    </div>
                  </button>
                ),
              },
              {
                key: 'activity',
                header: 'Records & Visits',
                align: 'right',
                render: (hc: any) => (
                  <span className="font-mono text-xs text-brand-700">
                    {hc.documentsCount || 0} Clinical Records ·{' '}
                    {hc.appointmentsCount || 0} Appointments
                  </span>
                ),
              },
            ]}
          />

          {/* Family Proxy Connections */}
          <DataList
            title="Family Proxy Links (Maintainer ↔ Child / Senior)"
            data={[
              ...(detailView.data.patient.maintainedDependents || []).map(
                (r: any) => ({
                  rowKey: `dep-${r.id}`,
                  direction: 'Maintains Dependent',
                  personId: r.dependent?.id,
                  name: r.dependent?.name,
                  uniqueId: r.dependent?.uniqueId,
                  accountType: r.dependent?.accountType || 'CHILD',
                  label: r.relationshipLabel,
                  status: r.status,
                })
              ),
              ...(detailView.data.patient.managedByMaintainers || []).map(
                (r: any) => ({
                  rowKey: `maint-${r.id}`,
                  direction: 'Managed by Maintainer',
                  personId: r.maintainer?.id,
                  name: r.maintainer?.name,
                  uniqueId: r.maintainer?.uniqueId,
                  accountType: r.maintainer?.accountType || 'NORMAL',
                  label: r.relationshipLabel,
                  status: r.status,
                })
              ),
            ]}
            getRowId={(r: any) => r.rowKey}
            emptyMessage="No linked family proxy accounts."
            columns={[
              {
                key: 'dir',
                header: 'Proxy Role',
                render: (r: any) => (
                  <StatusBadge label={r.direction} tone="neutral" />
                ),
              },
              {
                key: 'member',
                header: 'Linked Family Member',
                render: (r: any) =>
                  r.personId ? (
                    <button
                      type="button"
                      onClick={() => openPatientPage(r.personId)}
                      className="text-left group"
                    >
                      <div className="font-semibold text-brand-800 group-hover:text-brand-900 underline underline-offset-2">
                        {r.name}
                      </div>
                      <div className="font-mono text-xs text-mut">
                        {r.uniqueId} · {r.accountType} ({r.label})
                      </div>
                    </button>
                  ) : (
                    <div>
                      <div className="font-semibold text-ink">{r.name}</div>
                      <div className="font-mono text-xs text-mut">
                        {r.uniqueId} · {r.accountType} ({r.label})
                      </div>
                    </div>
                  ),
              },
              {
                key: 'status',
                header: 'Status',
                align: 'right',
                render: (r: any) => <StatusBadge label={r.status} />,
              },
            ]}
          />

          {/* Patient Medical Records Vault + PDF Download */}
          <DataList
            title={`Medical Records Vault (${detailView.data.patient.vaultDocuments?.length || 0})`}
            data={detailView.data.patient.vaultDocuments || []}
            getRowId={(d: any) => d.id}
            emptyMessage="No clinical documents in this patient's vault."
            columns={[
              {
                key: 'type',
                header: 'Record Type & Code',
                render: (d: any) => (
                  <div className="space-y-0.5">
                    <StatusBadge label={d.type} />
                    <div className="font-mono text-xs text-mut">
                      {d.documentCode}
                    </div>
                  </div>
                ),
              },
              {
                key: 'title',
                header: 'Document Title',
                render: (d: any) => (
                  <div>
                    <div className="font-medium text-ink">{d.title}</div>
                    {d.summary && (
                      <div className="text-xs text-mut">{d.summary}</div>
                    )}
                  </div>
                ),
              },
              {
                key: 'source',
                header: 'Issuing Doctor / Facility',
                render: (d: any) => (
                  <div className="text-sm space-y-0.5">
                    <div>
                      {d.doctor?.id ? (
                        <button
                          type="button"
                          onClick={() => openDoctorPage(d.doctor.id)}
                          className="font-medium text-brand-800 hover:text-brand-900 underline underline-offset-2 text-left"
                        >
                          {d.doctor.patientUser?.name ||
                            d.doctorNameSnapshot ||
                            'Doctor'}
                        </button>
                      ) : (
                        <span>
                          {d.doctor?.patientUser?.name ||
                            d.doctorNameSnapshot ||
                            'Facility Upload'}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-mut">
                      {d.workspace?.id ? (
                        <button
                          type="button"
                          onClick={() => openWorkspacePage(d.workspace.id)}
                          className="text-brand-800 hover:text-brand-900 underline underline-offset-2 text-left"
                        >
                          {d.workspace.name}
                        </button>
                      ) : (
                        <span>
                          {d.workspace?.name ||
                            d.workspaceNameSnapshot ||
                            'Independent Chamber'}
                        </span>
                      )}
                    </div>
                  </div>
                ),
              },
              {
                key: 'date',
                header: 'Issued',
                render: (d: any) => (
                  <span className="font-mono text-xs text-mut">
                    {new Date(d.createdAt).toLocaleDateString()}
                  </span>
                ),
              },
              {
                key: 'actions',
                header: 'Actions',
                align: 'right',
                render: (d: any) => (
                  <div className="inline-flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setInspectedDocPatient(detailView.data.patient);
                        setInspectedDocRecord(d);
                      }}
                      className="btn-secondary !px-2.5 !py-1"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        downloadClinicalDocumentPdf(d, detailView.data.patient)
                      }
                      className="btn-secondary !px-2.5 !py-1"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download PDF</span>
                    </button>
                  </div>
                ),
              },
            ]}
          />
        </div>
      )}

      {detailView?.kind === 'DOCTOR' && detailView.data?.doctor && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleBackFromDetail}
              className="btn-secondary"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleExportDoctorDossierPdf(detailView.data)}
                className="btn-secondary"
              >
                <Download className="w-4 h-4" />
                <span>Download Dossier PDF</span>
              </button>
              {detailView.data.doctor.approvalStatus !== 'APPROVED' && (
                <button
                  type="button"
                  onClick={() =>
                    handleUpdateDoctorStatus(
                      detailView.data.doctor.id,
                      'APPROVED'
                    )
                  }
                  className="btn-primary"
                >
                  Approve Doctor
                </button>
              )}
              {detailView.data.doctor.approvalStatus === 'PENDING' && (
                <button
                  type="button"
                  onClick={() =>
                    handleUpdateDoctorStatus(
                      detailView.data.doctor.id,
                      'DECLINED'
                    )
                  }
                  className="btn-danger"
                >
                  Decline
                </button>
              )}
              {detailView.data.doctor.approvalStatus === 'APPROVED' && (
                <button
                  type="button"
                  onClick={() =>
                    handleUpdateDoctorStatus(
                      detailView.data.doctor.id,
                      'DISABLED'
                    )
                  }
                  className="btn-danger"
                >
                  Disable Doctor
                </button>
              )}
            </div>
          </div>

          <div className="bg-paper border border-line rounded-md p-5 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-semibold text-ink">
                    {detailView.data.doctor.patientUser?.name}
                  </h1>
                  <StatusBadge
                    label={detailView.data.doctor.specialty}
                    tone="brand"
                  />
                  <StatusBadge label={detailView.data.doctor.approvalStatus} />
                </div>
                <p className="text-sm text-mut mt-1">
                  Doctor ID:{' '}
                  <span className="font-mono text-ink-2">
                    {detailView.data.doctor.doctorIdCode}
                  </span>{' '}
                  · BMDC License:{' '}
                  <span className="font-mono text-ink-2">
                    {detailView.data.doctor.doctorLicense}
                  </span>{' '}
                  · NID:{' '}
                  <span className="font-mono text-ink-2">
                    {detailView.data.doctor.nationalId}
                  </span>
                </p>
                {detailView.data.doctor.patientUser?.id && (
                  <div className="mt-1.5 text-xs text-mut">
                    Linked Citizen Account:{' '}
                    <button
                      type="button"
                      onClick={() =>
                        openPatientPage(detailView.data.doctor.patientUser.id)
                      }
                      className="font-semibold text-brand-800 hover:text-brand-900 underline underline-offset-2"
                    >
                      {detailView.data.doctor.patientUser.name} (
                      {detailView.data.doctor.patientUser.uniqueId})
                    </button>
                  </div>
                )}
              </div>
              <div className="text-sm text-right space-y-0.5">
                <div className="text-ink-2">
                  {detailView.data.doctor.patientUser?.email}
                </div>
                <div className="font-mono text-xs text-mut">
                  {detailView.data.doctor.patientUser?.phone}
                </div>
              </div>
            </div>
          </div>

          {/* Doctor <-> Hospital Multi-Chamber Fee Matrix */}
          <DataList
            title="Doctor ↔ Hospital Affiliations & Chamber Fees"
            description="Independent chamber fee and hospital-specific consultation fees across facilities. Click a hospital name to open its Hospital Details Page."
            data={(detailView.data.consultationFeesByWorkspace || []).map(
              (it: any, idx: number) => ({ ...it, _rowKey: String(idx) })
            )}
            getRowId={(r: any) => r._rowKey}
            emptyMessage="No chamber fee records configured."
            columns={[
              {
                key: 'ws',
                header: 'Hospital / Chamber',
                render: (it: any) =>
                  it.workspaceId && it.workspaceId !== 'DEFAULT_INDEPENDENT' ? (
                    <button
                      type="button"
                      onClick={() => openWorkspacePage(it.workspaceId)}
                      className="text-left group"
                    >
                      <div className="font-semibold text-brand-800 group-hover:text-brand-900 underline underline-offset-2">
                        {it.workspaceName}
                      </div>
                      <div className="font-mono text-xs text-mut">
                        {it.workspaceCode || it.workspaceType}
                        {it.area ? ` · ${it.area}` : ''}
                      </div>
                    </button>
                  ) : (
                    <div>
                      <div className="font-semibold text-ink">
                        {it.workspaceName}
                      </div>
                      <div className="font-mono text-xs text-mut">
                        {it.workspaceCode || it.workspaceType || 'Personal Chamber'}
                      </div>
                    </div>
                  ),
              },
              {
                key: 'schedule',
                header: 'Schedule & Room',
                render: (it: any) => (
                  <div className="text-sm">
                    <div>{it.schedule || 'Standard Hours'}</div>
                    {it.roomNumber && (
                      <div className="text-xs text-mut">{it.roomNumber}</div>
                    )}
                  </div>
                ),
              },
              {
                key: 'fee',
                header: 'Consultation Fee',
                render: (it: any) => (
                  <span className="font-mono font-semibold text-brand-700">
                    {Number(it.consultationFee || 0).toLocaleString()} Tk
                  </span>
                ),
              },
              {
                key: 'status',
                header: 'Status',
                align: 'right',
                render: (it: any) => <StatusBadge label={it.status} />,
              },
            ]}
          />

          {/* Doctor <-> Patient Connections */}
          <DataList
            title={`Doctor ↔ Patient Connections (${detailView.data.connectedPatients?.length || 0})`}
            description="Patients connected to this doctor via prescriptions, appointments, or QR consultations. Click a patient's name to open their Patient Details Page."
            data={detailView.data.connectedPatients || []}
            getRowId={(cp: any) => cp.patientId}
            emptyMessage="No patient consultations recorded yet."
            columns={[
              {
                key: 'patient',
                header: 'Connected Patient',
                render: (cp: any) => (
                  <button
                    type="button"
                    onClick={() => openPatientPage(cp.patientId)}
                    className="text-left group"
                  >
                    <div className="font-semibold text-brand-800 group-hover:text-brand-900 underline underline-offset-2">
                      {cp.name}
                    </div>
                    <div className="font-mono text-xs text-mut">
                      {cp.uniqueId} · {cp.phone || cp.email}
                    </div>
                  </button>
                ),
              },
              {
                key: 'metrics',
                header: 'Interactions',
                align: 'right',
                render: (cp: any) => (
                  <span className="font-mono text-xs text-brand-700">
                    {cp.prescriptionsIssued} Prescriptions ·{' '}
                    {cp.appointmentsCount} Appointments · {cp.qrScansCount} QR
                    Scans
                  </span>
                ),
              },
            ]}
          />

          {/* Issued Prescriptions + PDF Download */}
          <DataList
            title={`Issued Immutable Prescriptions (${detailView.data.doctor.issuedDocuments?.length || 0})`}
            data={detailView.data.doctor.issuedDocuments || []}
            getRowId={(rx: any) => rx.id}
            emptyMessage="No prescriptions issued by this doctor yet."
            columns={[
              {
                key: 'code',
                header: 'Prescription Code',
                render: (rx: any) => (
                  <span className="font-mono text-xs text-ink-2">
                    {rx.documentCode}
                  </span>
                ),
              },
              {
                key: 'patient',
                header: 'Patient',
                render: (rx: any) =>
                  rx.patient?.id ? (
                    <button
                      type="button"
                      onClick={() => openPatientPage(rx.patient.id)}
                      className="text-left group"
                    >
                      <div className="font-semibold text-brand-800 group-hover:text-brand-900 underline underline-offset-2">
                        {rx.patient.name}
                      </div>
                      <div className="font-mono text-xs text-mut">
                        {rx.patient.uniqueId}
                      </div>
                    </button>
                  ) : (
                    <div>
                      <div className="font-medium text-ink">
                        {rx.patient?.name}
                      </div>
                      <div className="font-mono text-xs text-mut">
                        {rx.patient?.uniqueId}
                      </div>
                    </div>
                  ),
              },
              {
                key: 'title',
                header: 'Diagnosis / Title',
                render: (rx: any) => (
                  <div>
                    <div className="font-medium text-ink">{rx.title}</div>
                    <div className="text-xs text-mut">
                      {rx.workspace?.id ? (
                        <button
                          type="button"
                          onClick={() => openWorkspacePage(rx.workspace.id)}
                          className="text-brand-800 hover:text-brand-900 underline underline-offset-2 text-left"
                        >
                          {rx.workspace.name}
                        </button>
                      ) : (
                        rx.workspace?.name || 'Independent Chamber'
                      )}
                    </div>
                  </div>
                ),
              },
              {
                key: 'actions',
                header: 'Actions',
                align: 'right',
                render: (rx: any) => (
                  <div className="inline-flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setInspectedDocPatient(rx.patient);
                        setInspectedDocRecord(rx);
                      }}
                      className="btn-secondary !px-2.5 !py-1"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        downloadClinicalDocumentPdf(rx, rx.patient)
                      }
                      className="btn-secondary !px-2.5 !py-1"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download PDF</span>
                    </button>
                  </div>
                ),
              },
            ]}
          />
        </div>
      )}

      {detailView?.kind === 'WORKSPACE' && detailView.data?.workspace && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleBackFromDetail}
              className="btn-secondary"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleExportWorkspaceDossierPdf(detailView.data)}
                className="btn-secondary"
              >
                <Download className="w-4 h-4" />
                <span>Download Facility PDF</span>
              </button>
              {detailView.data.workspace.approvalStatus !== 'APPROVED' && (
                <button
                  type="button"
                  onClick={() =>
                    handleUpdateWorkspaceStatus(
                      detailView.data.workspace.id,
                      'APPROVED'
                    )
                  }
                  className="btn-primary"
                >
                  Approve Facility
                </button>
              )}
              {detailView.data.workspace.approvalStatus === 'PENDING' && (
                <button
                  type="button"
                  onClick={() =>
                    handleUpdateWorkspaceStatus(
                      detailView.data.workspace.id,
                      'DECLINED'
                    )
                  }
                  className="btn-danger"
                >
                  Decline
                </button>
              )}
              {detailView.data.workspace.approvalStatus === 'APPROVED' && (
                <button
                  type="button"
                  onClick={() =>
                    handleUpdateWorkspaceStatus(
                      detailView.data.workspace.id,
                      'DISABLED'
                    )
                  }
                  className="btn-danger"
                >
                  Disable Facility
                </button>
              )}
            </div>
          </div>

          <div className="bg-paper border border-line rounded-md p-5 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-semibold text-ink">
                    {detailView.data.workspace.name}
                  </h1>
                  <StatusBadge label={detailView.data.workspace.type} />
                  <StatusBadge
                    label={detailView.data.workspace.approvalStatus}
                  />
                </div>
                <p className="text-sm text-mut mt-1">
                  Code:{' '}
                  <span className="font-mono text-ink-2">
                    {detailView.data.workspace.workspaceCode}
                  </span>{' '}
                  · License:{' '}
                  <span className="font-mono text-ink-2">
                    {detailView.data.workspace.registrationLicense}
                  </span>{' '}
                  · Area: {detailView.data.workspace.area}
                </p>
              </div>
              <div className="text-sm text-right space-y-0.5">
                <div className="font-medium text-ink">
                  Owner:{' '}
                  {detailView.data.workspace.owner?.id ? (
                    <button
                      type="button"
                      onClick={() =>
                        openPatientPage(detailView.data.workspace.owner.id)
                      }
                      className="font-semibold text-brand-800 hover:text-brand-900 underline underline-offset-2"
                    >
                      {detailView.data.workspace.owner.name}
                    </button>
                  ) : (
                    detailView.data.workspace.owner?.name
                  )}
                </div>
                <div className="font-mono text-xs text-mut">
                  {detailView.data.workspace.owner?.uniqueId} ·{' '}
                  {detailView.data.workspace.phone}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-3 border-t border-line">
              <div className="rounded border border-line bg-paper-2 p-3">
                <div className="text-xs text-mut">Offered Packages</div>
                <div className="text-xl font-semibold font-mono text-brand-700 mt-0.5">
                  {detailView.data.workspace.packages?.length || 0}
                </div>
              </div>
              <div className="rounded border border-line bg-paper-2 p-3">
                <div className="text-xs text-mut">Affiliated Doctors</div>
                <div className="text-xl font-semibold font-mono text-brand-700 mt-0.5">
                  {detailView.data.workspace.doctorAffiliations?.length || 0}
                </div>
              </div>
              <div className="rounded border border-line bg-paper-2 p-3">
                <div className="text-xs text-mut">Connected Patients</div>
                <div className="text-xl font-semibold font-mono text-ink mt-0.5">
                  {detailView.data.connectedPatients?.length || 0}
                </div>
              </div>
              <div className="rounded border border-line bg-paper-2 p-3">
                <div className="text-xs text-mut">Staff Members</div>
                <div className="text-xl font-semibold font-mono text-ink mt-0.5">
                  {detailView.data.workspace.members?.length || 0}
                </div>
              </div>
              <div className="rounded border border-line bg-paper-2 p-3">
                <div className="text-xs text-mut">Clinical Records</div>
                <div className="text-xl font-semibold font-mono text-ink mt-0.5">
                  {detailView.data.workspace.vaultDocuments?.length || 0}
                </div>
              </div>
            </div>
          </div>

          {/* Offered Health Packages (Shown prominently at TOP of Hospital Details Page) */}
          <section className="bg-paper border border-line rounded-md p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-ink flex items-center gap-2">
                  <Package className="w-4 h-4 text-brand-700" />
                  <span>
                    Offered Health Packages (
                    {detailView.data.workspace.packages?.length || 0})
                  </span>
                </h2>
                <p className="text-xs text-mut mt-0.5">
                  Preventive screening bundles and diagnostic health packages
                  published by {detailView.data.workspace.name}.
                </p>
              </div>
            </div>
            <RegistryPackageCardGrid
              packages={detailView.data.workspace.packages || []}
              emptyMessage={`${detailView.data.workspace.name} has not published any health packages yet.`}
            />
          </section>

          {/* Hospital <-> Doctor Connections */}
          <DataList
            title={`Hospital ↔ Doctor Connections (${detailView.data.workspace.doctorAffiliations?.length || 0})`}
            description="Click any affiliated doctor's name to open their Doctor Details Page."
            data={detailView.data.workspace.doctorAffiliations || []}
            getRowId={(aff: any) => aff.id}
            emptyMessage="No doctor affiliations configured for this facility."
            columns={[
              {
                key: 'doctor',
                header: 'Doctor',
                render: (aff: any) => (
                  <button
                    type="button"
                    onClick={() => openDoctorPage(aff.doctorId)}
                    className="text-left group"
                  >
                    <div className="font-semibold text-brand-800 group-hover:text-brand-900 underline underline-offset-2">
                      {aff.doctor?.patientUser?.name}
                    </div>
                    <div className="font-mono text-xs text-mut">
                      {aff.doctor?.doctorIdCode} · {aff.doctor?.specialty}
                    </div>
                  </button>
                ),
              },
              {
                key: 'schedule',
                header: 'Chamber Schedule',
                render: (aff: any) => (
                  <span className="text-sm text-ink-2">
                    {aff.schedule || 'Flexible'}
                  </span>
                ),
              },
              {
                key: 'fee',
                header: 'Consultation Fee',
                render: (aff: any) => (
                  <span className="font-mono font-semibold text-brand-700">
                    {Number(aff.consultationFee || 0).toLocaleString()} Tk
                  </span>
                ),
              },
              {
                key: 'status',
                header: 'Status',
                align: 'right',
                render: (aff: any) => <StatusBadge label={aff.status} />,
              },
            ]}
          />

          {/* Hospital <-> Patient Connections */}
          <DataList
            title={`Hospital ↔ Patient Connections (${detailView.data.connectedPatients?.length || 0})`}
            description="Click any connected patient's name to open their Patient Details Page."
            data={detailView.data.connectedPatients || []}
            getRowId={(cp: any) => cp.patientId}
            emptyMessage="No patient visits or clinical documents recorded at this facility yet."
            columns={[
              {
                key: 'patient',
                header: 'Patient',
                render: (cp: any) => (
                  <button
                    type="button"
                    onClick={() => openPatientPage(cp.patientId)}
                    className="text-left group"
                  >
                    <div className="font-semibold text-brand-800 group-hover:text-brand-900 underline underline-offset-2">
                      {cp.name}
                    </div>
                    <div className="font-mono text-xs text-mut">
                      {cp.uniqueId} · {cp.phone || '—'}
                    </div>
                  </button>
                ),
              },
              {
                key: 'counts',
                header: 'Facility Records & Appointments',
                align: 'right',
                render: (cp: any) => (
                  <span className="font-mono text-xs text-brand-700">
                    {cp.documentsCount} Lab/Billing Records ·{' '}
                    {cp.appointmentsCount} Appointments
                  </span>
                ),
              },
            ]}
          />

          {/* Staff Members & Dynamic Roles */}
          <DataList
            title={`Staff Roster & Dynamic Role Governance (${detailView.data.workspace.members?.length || 0})`}
            data={detailView.data.workspace.members || []}
            getRowId={(m: any) => m.id}
            emptyMessage="No staff members."
            columns={[
              {
                key: 'member',
                header: 'Staff Member',
                render: (m: any) =>
                  m.patientUser?.id ? (
                    <button
                      type="button"
                      onClick={() => openPatientPage(m.patientUser.id)}
                      className="text-left group"
                    >
                      <div className="font-semibold text-brand-800 group-hover:text-brand-900 underline underline-offset-2">
                        {m.patientUser.name}
                      </div>
                      <div className="font-mono text-xs text-mut">
                        {m.patientUser.uniqueId}
                      </div>
                    </button>
                  ) : (
                    <div>
                      <div className="font-semibold text-ink">
                        {m.patientUser?.name}
                      </div>
                      <div className="font-mono text-xs text-mut">
                        {m.patientUser?.uniqueId}
                      </div>
                    </div>
                  ),
              },
              {
                key: 'roles',
                header: 'Assigned Roles',
                render: (m: any) => (
                  <div className="flex flex-wrap gap-1">
                    {m.isOwner && (
                      <StatusBadge label="Primary Owner" tone="brand" />
                    )}
                    {(m.roleNames || []).map((rn: string, idx: number) => (
                      <StatusBadge key={idx} label={rn} tone="neutral" />
                    ))}
                  </div>
                ),
              },
              {
                key: 'perms',
                header: 'Combined Permissions',
                render: (m: any) => (
                  <span className="font-mono text-xs text-ink-2">
                    {m.combinedPermissions?.length || 0} permissions
                  </span>
                ),
              },
              {
                key: 'status',
                header: 'Status',
                align: 'right',
                render: (m: any) => <StatusBadge label={m.invitationStatus} />,
              },
            ]}
          />

          {/* Facility Clinical Documents + PDF Download */}
          <DataList
            deferredBelowFold
            title={`Facility Clinical Documents (${detailView.data.workspace.vaultDocuments?.length || 0})`}
            data={detailView.data.workspace.vaultDocuments || []}
            getRowId={(d: any) => d.id}
            emptyMessage="No clinical documents uploaded by this facility yet."
            columns={[
              {
                key: 'type',
                header: 'Type & Code',
                render: (d: any) => (
                  <div className="space-y-0.5">
                    <StatusBadge label={d.type} />
                    <div className="font-mono text-xs text-mut">
                      {d.documentCode}
                    </div>
                  </div>
                ),
              },
              {
                key: 'patient',
                header: 'Patient',
                render: (d: any) =>
                  d.patient?.id ? (
                    <button
                      type="button"
                      onClick={() => openPatientPage(d.patient.id)}
                      className="text-left group"
                    >
                      <div className="font-semibold text-brand-800 group-hover:text-brand-900 underline underline-offset-2">
                        {d.patient.name}
                      </div>
                      <div className="font-mono text-xs text-mut">
                        {d.patient.uniqueId}
                      </div>
                    </button>
                  ) : (
                    <div>
                      <div className="font-medium text-ink">
                        {d.patient?.name}
                      </div>
                      <div className="font-mono text-xs text-mut">
                        {d.patient?.uniqueId}
                      </div>
                    </div>
                  ),
              },
              {
                key: 'title',
                header: 'Title',
                render: (d: any) => <span>{d.title}</span>,
              },
              {
                key: 'actions',
                header: 'Actions',
                align: 'right',
                render: (d: any) => (
                  <div className="inline-flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setInspectedDocPatient(d.patient);
                        setInspectedDocRecord(d);
                      }}
                      className="btn-secondary !px-2.5 !py-1"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        downloadClinicalDocumentPdf(d, d.patient)
                      }
                      className="btn-secondary !px-2.5 !py-1"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download PDF</span>
                    </button>
                  </div>
                ),
              },
            ]}
          />
        </div>
      )}

      {/* =================================================================== */}
      {/* 1. REDESIGNED CENTRALIZED SYSTEM OVERVIEW                           */}
      {/* =================================================================== */}
      {!detailView && activeSection === 'overview' && overview && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-ink">
                National Central Registry Overview
              </h1>
              <p className="text-sm text-mut mt-0.5">
                Directorate General of Health Services (DGHS) — Unified
                governance across patients, clinicians, healthcare facilities,
                offered packages, and clinical interconnections.
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportOverviewPdf}
              className="btn-primary"
            >
              <Download className="w-4 h-4" />
              <span>Download Overview PDF</span>
            </button>
          </div>

          {/* 6-Box National System Architecture Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <button
              type="button"
              onClick={() => setActiveSection('patients')}
              className="bg-paper border border-line hover:border-brand-400 rounded-md p-4 space-y-1 text-left transition-colors"
            >
              <div className="text-sm font-medium text-brand-800 underline underline-offset-2">
                National Patient Registry
              </div>
              <div className="text-2xl font-semibold text-ink font-mono">
                {overview.metrics.patients.total}
              </div>
              <div className="text-xs text-mut">
                Active: {overview.metrics.patients.active} · Disabled:{' '}
                {overview.metrics.patients.disabled} · Child/Senior Proxy:{' '}
                {overview.metrics.patients.childAccounts +
                  overview.metrics.patients.seniorAccounts}
              </div>
            </button>

            <button
              type="button"
              onClick={() => setActiveSection('doctors')}
              className="bg-paper border border-line hover:border-brand-400 rounded-md p-4 space-y-1 text-left transition-colors"
            >
              <div className="text-sm font-medium text-brand-800 underline underline-offset-2">
                BMDC Doctor Registry
              </div>
              <div className="text-2xl font-semibold text-brand-700 font-mono">
                {overview.metrics.doctors.APPROVED} Approved
              </div>
              <div className="text-xs text-mut">
                Pending: {overview.metrics.doctors.PENDING} · Declined:{' '}
                {overview.metrics.doctors.DECLINED} · Disabled:{' '}
                {overview.metrics.doctors.DISABLED}
              </div>
            </button>

            <button
              type="button"
              onClick={() => setActiveSection('hospitals')}
              className="bg-paper border border-line hover:border-brand-400 rounded-md p-4 space-y-1 text-left transition-colors"
            >
              <div className="text-sm font-medium text-brand-800 underline underline-offset-2">
                Healthcare Facilities
              </div>
              <div className="text-2xl font-semibold text-brand-700 font-mono">
                {overview.metrics.workspaces.APPROVED} Approved
              </div>
              <div className="text-xs text-mut">
                Hospitals: {overview.metrics.workspaces.byType?.HOSPITAL ?? 0} ·
                Clinics: {overview.metrics.workspaces.byType?.CLINIC ?? 0} ·
                Diagnostic:{' '}
                {overview.metrics.workspaces.byType?.DIAGNOSTIC_CENTER ?? 0} ·
                Pending: {overview.metrics.workspaces.PENDING}
              </div>
            </button>

            <div className="bg-paper border border-line rounded-md p-4 space-y-1">
              <div className="text-sm font-medium text-mut">
                Centralized Medical Records
              </div>
              <div className="text-2xl font-semibold text-ink font-mono">
                {overview.metrics.clinical.totalVaultDocs}
              </div>
              <div className="text-xs text-mut">
                Prescriptions: {overview.metrics.clinical.totalPrescriptions} ·
                Lab Reports: {overview.metrics.clinical.totalLabReports} ·
                Billing: {overview.metrics.clinical.totalBillingDocs ?? 0}
              </div>
            </div>

            <div className="bg-paper border border-line rounded-md p-4 space-y-1">
              <div className="text-sm font-medium text-mut">
                Ecosystem Interconnections
              </div>
              <div className="text-2xl font-semibold text-brand-700 font-mono">
                {(overview.metrics.connections
                  ?.activeDoctorHospitalAffiliations ?? 0) +
                  (overview.metrics.connections?.doctorPatientPairsCount ?? 0)}
              </div>
              <div className="text-xs text-mut">
                Dr↔Hospital:{' '}
                {overview.metrics.connections
                  ?.activeDoctorHospitalAffiliations ?? 0}{' '}
                · Patient↔Dr:{' '}
                {overview.metrics.connections?.doctorPatientPairsCount ?? 0} ·
                Family Links:{' '}
                {overview.metrics.connections?.activeFamilyLinksCount ?? 0}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setActiveSection('hospitals')}
              className="bg-paper border border-line hover:border-brand-400 rounded-md p-4 space-y-1 text-left transition-colors"
            >
              <div className="text-sm font-medium text-brand-800 underline underline-offset-2">
                Appointments & Offered Packages
              </div>
              <div className="text-2xl font-semibold text-ink font-mono">
                {overview.metrics.clinical.totalAppointments} Appts
              </div>
              <div className="text-xs text-mut">
                Pending:{' '}
                {overview.metrics.clinical.appointmentsByStatus?.PENDING ?? 0} ·
                Approved:{' '}
                {overview.metrics.clinical.appointmentsByStatus?.APPROVED ?? 0}{' '}
                · Offered Packages: {overview.metrics.clinical.totalPackages}
              </div>
            </button>
          </div>

          {/* Pending Verification Queue */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <DataList
              title={`Pending Doctor Applications (${overview.pendingApprovals.doctors.length})`}
              description="Click an applicant's name to open their Doctor Details Page."
              data={overview.pendingApprovals.doctors}
              getRowId={(d: any) => d.id}
              emptyMessage="All BMDC doctor applications have been reviewed."
              columns={[
                {
                  key: 'doc',
                  header: 'Applicant',
                  render: (d: any) => (
                    <button
                      type="button"
                      onClick={() => openDoctorPage(d.id, 'overview')}
                      className="text-left group"
                    >
                      <div className="font-semibold text-brand-800 group-hover:text-brand-900 underline underline-offset-2">
                        {d.patientUser?.name}
                      </div>
                      <div className="font-mono text-xs text-mut">
                        {d.doctorIdCode} · {d.specialty} · BMDC{' '}
                        {d.doctorLicense}
                      </div>
                    </button>
                  ),
                },
                {
                  key: 'actions',
                  header: 'Governance',
                  align: 'right',
                  render: (d: any) => (
                    <div className="inline-flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateDoctorStatus(d.id, 'APPROVED')
                        }
                        className="btn-primary !px-2.5 !py-1"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateDoctorStatus(d.id, 'DECLINED')
                        }
                        className="btn-danger !px-2.5 !py-1"
                      >
                        Decline
                      </button>
                    </div>
                  ),
                },
              ]}
            />

            <DataList
              title={`Pending Facility Applications (${overview.pendingApprovals.workspaces.length})`}
              description="Click a facility name to open its Hospital Details Page."
              data={overview.pendingApprovals.workspaces}
              getRowId={(ws: any) => ws.id}
              emptyMessage="All hospital and clinic license applications have been reviewed."
              columns={[
                {
                  key: 'ws',
                  header: 'Facility',
                  render: (ws: any) => (
                    <div className="space-y-0.5">
                      <button
                        type="button"
                        onClick={() => openWorkspacePage(ws.id, 'overview')}
                        className="text-left font-semibold text-brand-800 hover:text-brand-900 underline underline-offset-2 block"
                      >
                        {ws.name}
                      </button>
                      <div className="font-mono text-xs text-mut">
                        {ws.workspaceCode} · {ws.registrationLicense} · Owner:{' '}
                        {ws.owner?.id ? (
                          <button
                            type="button"
                            onClick={() =>
                              openPatientPage(ws.owner.id, 'overview')
                            }
                            className="text-brand-800 hover:text-brand-900 underline underline-offset-2"
                          >
                            {ws.owner.name}
                          </button>
                        ) : (
                          ws.owner?.name
                        )}
                      </div>
                    </div>
                  ),
                },
                {
                  key: 'actions',
                  header: 'Governance',
                  align: 'right',
                  render: (ws: any) => (
                    <div className="inline-flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateWorkspaceStatus(ws.id, 'APPROVED')
                        }
                        className="btn-primary !px-2.5 !py-1"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateWorkspaceStatus(ws.id, 'DECLINED')
                        }
                        className="btn-danger !px-2.5 !py-1"
                      >
                        Decline
                      </button>
                    </div>
                  ),
                },
              ]}
            />
          </div>

          {/* Workspaces' Offered Health Packages on Overview */}
          <section className="bg-paper border border-line rounded-md p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-ink flex items-center gap-2">
                  <Package className="w-4 h-4 text-brand-700" />
                  <span>
                    Workspaces&apos; Offered Health Packages (
                    {overview.ecosystemConnections?.publishedPackages?.length ||
                      0}
                    )
                  </span>
                </h2>
                <p className="text-xs text-mut mt-0.5">
                  Preventive screening bundles offered across registered
                  hospitals and diagnostic centers. Click a hospital name to
                  open its Hospital Details Page.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveSection('hospitals')}
                className="btn-secondary !px-2.5 !py-1"
              >
                All Hospitals
              </button>
            </div>
            <RegistryPackageCardGrid
              packages={overview.ecosystemConnections?.publishedPackages || []}
              onOpenWorkspace={(wsId) => openWorkspacePage(wsId, 'overview')}
              emptyMessage="No workspaces have published health packages yet."
            />
          </section>

          {/* Centralized Ecosystem Connectivity Matrices */}
          <DataList
            title={`Hospital ↔ Doctor & Patient Ecosystem Matrix (${overview.ecosystemConnections?.hospitalEcosystemSummary?.length || 0})`}
            description="Click any facility name to redirect directly to its Hospital Details Page."
            data={overview.ecosystemConnections?.hospitalEcosystemSummary || []}
            getRowId={(h: any) => h.workspaceId}
            emptyMessage="No healthcare facilities registered yet."
            columns={[
              {
                key: 'facility',
                header: 'Facility',
                render: (h: any) => (
                  <button
                    type="button"
                    onClick={() =>
                      openWorkspacePage(h.workspaceId, 'overview')
                    }
                    className="text-left group"
                  >
                    <div className="font-semibold text-brand-800 group-hover:text-brand-900 underline underline-offset-2">
                      {h.name}
                    </div>
                    <div className="font-mono text-xs text-mut">
                      {h.workspaceCode} · {h.area}
                    </div>
                  </button>
                ),
              },
              {
                key: 'type',
                header: 'Type & Status',
                render: (h: any) => (
                  <div className="flex flex-wrap gap-1">
                    <StatusBadge label={h.type} tone="neutral" />
                    <StatusBadge label={h.approvalStatus} />
                  </div>
                ),
              },
              {
                key: 'connections',
                header: 'Doctor & Patient Connectivity',
                render: (h: any) => (
                  <span className="font-mono text-xs text-brand-700">
                    {h.affiliatedDoctorsCount} Doctors ·{' '}
                    {h.connectedPatientsCount} Patients · {h.staffCount} Staff
                  </span>
                ),
              },
              {
                key: 'packages',
                header: 'Offered Packages',
                render: (h: any) =>
                  h.packages?.length > 0 ? (
                    <div className="space-y-0.5">
                      {h.packages.map((pkg: any) => (
                        <div key={pkg.id} className="text-xs">
                          <span className="font-medium text-ink">
                            {pkg.title}
                          </span>{' '}
                          <span className="font-mono text-brand-700">
                            ({Number(pkg.price || 0).toLocaleString()} Tk)
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-mut">None</span>
                  ),
              },
              {
                key: 'clinical',
                header: 'Clinical Output',
                align: 'right',
                render: (h: any) => (
                  <span className="font-mono text-xs text-ink-2">
                    {h.recordsCount} Records · {h.appointmentsCount} Appts
                  </span>
                ),
              },
            ]}
          />

          <DataList
            title={`Hospital ↔ Doctor Chamber & Fee Connections (${overview.ecosystemConnections?.hospitalDoctorMatrix?.length || 0})`}
            description="Click any doctor or hospital name to open its dedicated Details Page."
            data={overview.ecosystemConnections?.hospitalDoctorMatrix || []}
            getRowId={(r: any) => r.affiliationId}
            emptyMessage="No doctor-hospital affiliations recorded."
            columns={[
              {
                key: 'doctor',
                header: 'Doctor',
                render: (r: any) => (
                  <button
                    type="button"
                    onClick={() => openDoctorPage(r.doctorId, 'overview')}
                    className="text-left group"
                  >
                    <div className="font-semibold text-brand-800 group-hover:text-brand-900 underline underline-offset-2">
                      {r.doctorName}
                    </div>
                    <div className="font-mono text-xs text-mut">
                      {r.doctorCode} · {r.specialty}
                    </div>
                  </button>
                ),
              },
              {
                key: 'hospital',
                header: 'Connected Hospital / Clinic',
                render: (r: any) => (
                  <button
                    type="button"
                    onClick={() =>
                      openWorkspacePage(r.workspaceId, 'overview')
                    }
                    className="text-left group"
                  >
                    <div className="font-semibold text-brand-800 group-hover:text-brand-900 underline underline-offset-2">
                      {r.workspaceName}
                    </div>
                    <div className="font-mono text-xs text-mut">
                      {r.workspaceCode} · {r.area}
                    </div>
                  </button>
                ),
              },
              {
                key: 'fee',
                header: 'Chamber Fee & Schedule',
                render: (r: any) => (
                  <div>
                    <div className="font-mono text-sm font-semibold text-brand-700">
                      {Number(r.consultationFee || 0).toLocaleString()} Tk
                    </div>
                    <div className="text-xs text-mut">{r.schedule}</div>
                  </div>
                ),
              },
              {
                key: 'status',
                header: 'Status',
                align: 'right',
                render: (r: any) => <StatusBadge label={r.status} />,
              },
            ]}
          />

          <DataList
            deferredBelowFold
            title={`Patient ↔ Doctor Consultation Connections (${overview.ecosystemConnections?.patientDoctorMatrix?.length || 0})`}
            description="Click any patient, doctor, or hospital name to open its dedicated Details Page."
            data={overview.ecosystemConnections?.patientDoctorMatrix || []}
            getRowId={(r: any) => r.key}
            emptyMessage="No patient-doctor consultations recorded yet."
            columns={[
              {
                key: 'patient',
                header: 'Patient',
                render: (r: any) => (
                  <button
                    type="button"
                    onClick={() => openPatientPage(r.patientId, 'overview')}
                    className="text-left group"
                  >
                    <div className="font-semibold text-brand-800 group-hover:text-brand-900 underline underline-offset-2">
                      {r.patientName}
                    </div>
                    <div className="font-mono text-xs text-mut">
                      {r.patientCode}
                    </div>
                  </button>
                ),
              },
              {
                key: 'doctor',
                header: 'Consulting Doctor',
                render: (r: any) => (
                  <button
                    type="button"
                    onClick={() => openDoctorPage(r.doctorId, 'overview')}
                    className="text-left group"
                  >
                    <div className="font-semibold text-brand-800 group-hover:text-brand-900 underline underline-offset-2">
                      {r.doctorName}
                    </div>
                    <div className="font-mono text-xs text-mut">
                      {r.doctorCode} · {r.specialty}
                    </div>
                  </button>
                ),
              },
              {
                key: 'facilities',
                header: 'Chamber / Facility',
                render: (r: any) =>
                  r.facilityLinks?.length ? (
                    <div className="flex flex-wrap items-center gap-1.5 text-sm">
                      {r.facilityLinks.map((fl: any, idx: number) => (
                        <React.Fragment key={fl.id}>
                          {idx > 0 && <span className="text-mut">·</span>}
                          <button
                            type="button"
                            onClick={() =>
                              openWorkspacePage(fl.id, 'overview')
                            }
                            className="font-medium text-brand-800 hover:text-brand-900 underline underline-offset-2 text-left"
                          >
                            {fl.name}
                          </button>
                        </React.Fragment>
                      ))}
                    </div>
                  ) : (
                    <span className="text-sm text-ink-2">
                      {r.facilities?.length
                        ? r.facilities.join(', ')
                        : 'Independent Personal Chamber'}
                    </span>
                  ),
              },
              {
                key: 'counts',
                header: 'Records & Visits',
                align: 'right',
                render: (r: any) => (
                  <span className="font-mono text-xs text-brand-700">
                    {r.prescriptionsCount} Prescriptions · {r.appointmentsCount}{' '}
                    Appointments
                  </span>
                ),
              },
            ]}
          />

          <DataList
            deferredBelowFold
            title={`Recent National Platform Activity (${overview.recentActivityLogs?.length || 0})`}
            data={overview.recentActivityLogs || []}
            getRowId={(l: any) => l.id}
            emptyMessage="No recent platform activity recorded."
            columns={[
              {
                key: 'patient',
                header: 'Account',
                render: (l: any) =>
                  l.patient?.id ? (
                    <button
                      type="button"
                      onClick={() => openPatientPage(l.patient.id, 'overview')}
                      className="text-left group"
                    >
                      <div className="font-medium text-brand-800 group-hover:text-brand-900 underline underline-offset-2">
                        {l.patient.name}
                      </div>
                      <div className="font-mono text-xs text-mut">
                        {l.patient.uniqueId}
                      </div>
                    </button>
                  ) : (
                    <span className="text-sm font-medium text-ink-2">
                      System
                    </span>
                  ),
              },
              {
                key: 'action',
                header: 'Event',
                render: (l: any) => (
                  <div>
                    <div className="font-mono text-xs text-brand-700">
                      {l.action}
                    </div>
                    <div className="text-sm text-ink-2">{l.description}</div>
                  </div>
                ),
              },
              {
                key: 'time',
                header: 'Timestamp',
                align: 'right',
                render: (l: any) => (
                  <span className="font-mono text-xs text-mut">
                    {new Date(l.createdAt).toLocaleString()}
                  </span>
                ),
              },
            ]}
          />
        </div>
      )}

      {/* =================================================================== */}
      {/* 2. PATIENTS DIRECTORY (OPENS FULL-PAGE DOSSIER, NOT POPUP)          */}
      {/* =================================================================== */}
      {!detailView && activeSection === 'patients' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-ink">Patients</h1>
              <p className="text-sm text-mut mt-0.5">
                Click any patient&apos;s name to open their full Patient Details
                Page, clinical vault, family proxy links, and connections.
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                downloadRegistryReportPdf({
                  title: 'National Patient Registry Directory',
                  code: `DGHS-PATIENTS-${new Date().toISOString().slice(0, 10)}`,
                  metrics: [
                    { label: 'Total Listed', value: patients.length },
                    {
                      label: 'Active Accounts',
                      value: patients.filter((p) => p.status === 'ACTIVE')
                        .length,
                    },
                    {
                      label: 'Child / Senior',
                      value: patients.filter((p) => p.accountType !== 'NORMAL')
                        .length,
                    },
                  ],
                  sections: [
                    {
                      heading: 'Registered Patients & Ecosystem Connections',
                      rows: patients.map(
                        (p) =>
                          `${p.name} (${p.uniqueId}) [${p.accountType} | ${p.status}] — ${p._count?.vaultDocuments || 0} Records, ${p.connectedDoctorsCount || 0} Doctors, ${p.connectedWorkspacesCount || 0} Hospitals`
                      ),
                    },
                  ],
                })
              }
              className="btn-secondary"
            >
              <Download className="w-4 h-4" />
              <span>Export List PDF</span>
            </button>
          </div>

          <DataList
            title={`National Patient Registry (${patients.length})`}
            data={patients}
            getRowId={(p: any) => p.id}
            emptyMessage="No patients match your search."
            toolbar={
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input
                  type="search"
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  placeholder="Search patient name, ID, email, or phone..."
                  className="rounded-md border border-line bg-paper px-3 py-1.5 text-sm text-ink"
                />
                <select
                  value={patientStatusFilter}
                  onChange={(e) => setPatientStatusFilter(e.target.value)}
                  aria-label="Filter patient status"
                  className="rounded-md border border-line bg-paper px-3 py-1.5 text-sm text-ink"
                >
                  <option value="">All Statuses</option>
                  <option value="ACTIVE">Active</option>
                  <option value="DISABLED">Disabled</option>
                </select>
              </div>
            }
            columns={[
              {
                key: 'patient',
                header: 'Patient',
                render: (p: any) => (
                  <button
                    type="button"
                    onClick={() => openPatientPage(p.id, 'patients')}
                    className="text-left group"
                  >
                    <div className="font-semibold text-brand-800 group-hover:text-brand-900 underline underline-offset-2">
                      {p.name}
                    </div>
                    <div className="font-mono text-xs text-mut">
                      {p.uniqueId}
                    </div>
                  </button>
                ),
              },
              {
                key: 'type',
                header: 'Category',
                render: (p: any) => <StatusBadge label={p.accountType} />,
              },
              {
                key: 'connections',
                header: 'Doctor, Hospital & Family Links',
                render: (p: any) => {
                  const famCount =
                    (p.maintainedDependents?.length || 0) +
                    (p.managedByMaintainers?.length || 0);
                  return (
                    <div className="space-y-0.5 text-xs font-mono">
                      <div className="text-brand-700">
                        {p.connectedDoctorsCount ?? 0} Doctors ·{' '}
                        {p.connectedWorkspacesCount ?? 0} Hospitals
                      </div>
                      <div className="text-mut">
                        {p._count?.vaultDocuments || 0} Records · {famCount}{' '}
                        Family Links
                      </div>
                    </div>
                  );
                },
              },
              {
                key: 'status',
                header: 'Status',
                render: (p: any) => <StatusBadge label={p.status} />,
              },
              {
                key: 'actions',
                header: 'Governance',
                align: 'right',
                render: (p: any) => (
                  <div className="inline-flex items-center justify-end gap-1.5">
                    {p.status === 'ACTIVE' ? (
                      <button
                        type="button"
                        onClick={() =>
                          handleTogglePatientStatus(p.id, 'DISABLED')
                        }
                        className="btn-danger !px-2.5 !py-1"
                      >
                        Disable
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          handleTogglePatientStatus(p.id, 'ACTIVE')
                        }
                        className="btn-primary !px-2.5 !py-1"
                      >
                        Enable
                      </button>
                    )}
                  </div>
                ),
              },
            ]}
          />
        </div>
      )}

      {/* =================================================================== */}
      {/* 3. DOCTORS DIRECTORY                                                */}
      {/* =================================================================== */}
      {!detailView && activeSection === 'doctors' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-ink">Doctors</h1>
              <p className="text-sm text-mut mt-0.5">
                Click any doctor&apos;s name to open their Doctor Details Page,
                chamber fees, and connected patients.
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                downloadRegistryReportPdf({
                  title: 'National BMDC Doctor Registry Directory',
                  code: `DGHS-DOCTORS-${new Date().toISOString().slice(0, 10)}`,
                  metrics: [
                    { label: 'Total Listed', value: doctors.length },
                    {
                      label: 'Approved',
                      value: doctors.filter(
                        (d) => d.approvalStatus === 'APPROVED'
                      ).length,
                    },
                    {
                      label: 'Pending',
                      value: doctors.filter(
                        (d) => d.approvalStatus === 'PENDING'
                      ).length,
                    },
                  ],
                  sections: [
                    {
                      heading: 'Registered Doctors & Facility Affiliations',
                      rows: doctors.map(
                        (d) =>
                          `${d.patientUser?.name} (${d.doctorIdCode}, ${d.specialty}) — BMDC: ${d.doctorLicense} [${d.approvalStatus}] · ${d.workspaceAffiliations?.length || 0} Facilities, ${d._count?.issuedDocuments || 0} Prescriptions`
                      ),
                    },
                  ],
                })
              }
              className="btn-secondary"
            >
              <Download className="w-4 h-4" />
              <span>Export List PDF</span>
            </button>
          </div>

          <DataList
            title={`National Doctor Registry (${doctors.length})`}
            data={doctors}
            getRowId={(d: any) => d.id}
            emptyMessage="No doctors match your filters."
            toolbar={
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input
                  type="search"
                  value={doctorSearch}
                  onChange={(e) => setDoctorSearch(e.target.value)}
                  placeholder="Search doctor name, ID, BMDC license, or specialty..."
                  className="rounded-md border border-line bg-paper px-3 py-1.5 text-sm text-ink"
                />
                <select
                  value={doctorStatusFilter}
                  onChange={(e) => setDoctorStatusFilter(e.target.value)}
                  aria-label="Filter doctor status"
                  className="rounded-md border border-line bg-paper px-3 py-1.5 text-sm text-ink"
                >
                  <option value="">All Statuses</option>
                  <option value="APPROVED">Approved</option>
                  <option value="PENDING">Pending</option>
                  <option value="DECLINED">Declined</option>
                  <option value="DISABLED">Disabled</option>
                </select>
              </div>
            }
            columns={[
              {
                key: 'doctor',
                header: 'Doctor',
                render: (d: any) => (
                  <button
                    type="button"
                    onClick={() => openDoctorPage(d.id, 'doctors')}
                    className="text-left group"
                  >
                    <div className="font-semibold text-brand-800 group-hover:text-brand-900 underline underline-offset-2">
                      {d.patientUser?.name}
                    </div>
                    <div className="font-mono text-xs text-mut">
                      {d.doctorIdCode} · BMDC {d.doctorLicense}
                    </div>
                  </button>
                ),
              },
              {
                key: 'spec',
                header: 'Specialty',
                render: (d: any) => (
                  <StatusBadge label={d.specialty} tone="brand" />
                ),
              },
              {
                key: 'connections',
                header: 'Hospital & Patient Activity',
                render: (d: any) => (
                  <div className="space-y-0.5 text-xs font-mono">
                    <div className="text-brand-700">
                      {d.workspaceAffiliations?.length || 0} Facilities
                    </div>
                    <div className="text-mut">
                      {d._count?.issuedDocuments || 0} Rx ·{' '}
                      {d._count?.appointments || 0} Appts
                    </div>
                  </div>
                ),
              },
              {
                key: 'status',
                header: 'Status',
                render: (d: any) => <StatusBadge label={d.approvalStatus} />,
              },
              {
                key: 'actions',
                header: 'Governance',
                align: 'right',
                render: (d: any) => (
                  <div className="inline-flex items-center justify-end gap-1.5">
                    {d.approvalStatus !== 'APPROVED' && (
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateDoctorStatus(d.id, 'APPROVED')
                        }
                        className="btn-primary !px-2.5 !py-1"
                      >
                        Approve
                      </button>
                    )}
                    {d.approvalStatus === 'PENDING' && (
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateDoctorStatus(d.id, 'DECLINED')
                        }
                        className="btn-danger !px-2.5 !py-1"
                      >
                        Decline
                      </button>
                    )}
                    {d.approvalStatus === 'APPROVED' && (
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateDoctorStatus(d.id, 'DISABLED')
                        }
                        className="btn-danger !px-2.5 !py-1"
                      >
                        Disable
                      </button>
                    )}
                  </div>
                ),
              },
            ]}
          />
        </div>
      )}

      {/* =================================================================== */}
      {/* 4. HOSPITALS DIRECTORY + WORKSPACES' OFFERED HEALTH PACKAGES        */}
      {/* =================================================================== */}
      {!detailView && activeSection === 'hospitals' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-ink">
                Hospitals &amp; Offered Packages
              </h1>
              <p className="text-sm text-mut mt-0.5">
                Click any facility name to open its Hospital Details Page,
                offered health packages, affiliated doctors, and staff roles.
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                downloadRegistryReportPdf({
                  title: 'National Healthcare Facility Directory',
                  code: `DGHS-FACILITIES-${new Date().toISOString().slice(0, 10)}`,
                  metrics: [
                    { label: 'Total Facilities', value: workspaces.length },
                    {
                      label: 'Approved',
                      value: workspaces.filter(
                        (w) => w.approvalStatus === 'APPROVED'
                      ).length,
                    },
                    {
                      label: 'Offered Packages',
                      value: workspaces.reduce(
                        (sum, w) => sum + (w.packages?.length || 0),
                        0
                      ),
                    },
                  ],
                  sections: [
                    {
                      heading: 'Registered Hospitals, Clinics & Diagnostic Centers',
                      rows: workspaces.map(
                        (ws) =>
                          `${ws.name} (${ws.workspaceCode}, ${ws.type}) — License: ${ws.registrationLicense} [${ws.approvalStatus}] · ${ws._count?.doctorAffiliations || 0} Doctors, ${ws._count?.members || 0} Staff, ${ws.packages?.length || 0} Packages`
                      ),
                    },
                  ],
                })
              }
              className="btn-secondary"
            >
              <Download className="w-4 h-4" />
              <span>Export List PDF</span>
            </button>
          </div>

          {/* Top Card Grid: All Workspaces' Offered Health Packages */}
          <section className="bg-paper border border-line rounded-md p-5 space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-ink flex items-center gap-2">
                <Package className="w-4 h-4 text-brand-700" />
                <span>
                  Workspaces&apos; Offered Health Packages (
                  {workspaces.reduce(
                    (sum, w) => sum + (w.packages?.length || 0),
                    0
                  )}
                  )
                </span>
              </h2>
              <p className="text-xs text-mut mt-0.5">
                Preventive screening and diagnostic packages offered across
                listed healthcare workspaces.
              </p>
            </div>
            <RegistryPackageCardGrid
              packages={workspaces.flatMap((ws: any) =>
                (ws.packages || []).map((pkg: any) => ({
                  ...pkg,
                  workspace: {
                    id: ws.id,
                    workspaceCode: ws.workspaceCode,
                    name: ws.name,
                    type: ws.type,
                    area: ws.area,
                    approvalStatus: ws.approvalStatus,
                  },
                }))
              )}
              onOpenWorkspace={(wsId) => openWorkspacePage(wsId, 'hospitals')}
              emptyMessage="No offered health packages match the current facility filters."
            />
          </section>

          <DataList
            title={`Registered Hospitals & Facilities (${workspaces.length})`}
            data={workspaces}
            getRowId={(ws: any) => ws.id}
            emptyMessage="No facilities match your filters."
            toolbar={
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input
                  type="search"
                  value={workspaceSearch}
                  onChange={(e) => setWorkspaceSearch(e.target.value)}
                  placeholder="Search facility name, license, or area..."
                  className="rounded-md border border-line bg-paper px-3 py-1.5 text-sm text-ink"
                />
                <select
                  value={workspaceStatusFilter}
                  onChange={(e) => setWorkspaceStatusFilter(e.target.value)}
                  aria-label="Filter facility status"
                  className="rounded-md border border-line bg-paper px-3 py-1.5 text-sm text-ink"
                >
                  <option value="">All Statuses</option>
                  <option value="APPROVED">Approved</option>
                  <option value="PENDING">Pending</option>
                  <option value="DECLINED">Declined</option>
                  <option value="DISABLED">Disabled</option>
                </select>
              </div>
            }
            columns={[
              {
                key: 'facility',
                header: 'Facility',
                render: (ws: any) => (
                  <button
                    type="button"
                    onClick={() => openWorkspacePage(ws.id, 'hospitals')}
                    className="text-left group"
                  >
                    <div className="font-semibold text-brand-800 group-hover:text-brand-900 underline underline-offset-2">
                      {ws.name}
                    </div>
                    <div className="font-mono text-xs text-mut">
                      {ws.workspaceCode} · {ws.registrationLicense}
                    </div>
                  </button>
                ),
              },
              {
                key: 'type',
                header: 'Category & Area',
                render: (ws: any) => (
                  <div>
                    <StatusBadge label={ws.type} />
                    <div className="text-xs text-mut mt-0.5">{ws.area}</div>
                  </div>
                ),
              },
              {
                key: 'packages',
                header: 'Offered Packages',
                render: (ws: any) =>
                  ws.packages?.length > 0 ? (
                    <div className="space-y-0.5">
                      {ws.packages.map((pkg: any) => (
                        <div key={pkg.id} className="text-xs">
                          <span className="font-medium text-ink">
                            {pkg.title}
                          </span>{' '}
                          <span className="font-mono text-brand-700">
                            ({Number(pkg.price || 0).toLocaleString()} Tk)
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-mut">No packages</span>
                  ),
              },
              {
                key: 'connections',
                header: 'Doctor, Staff & Record Counts',
                render: (ws: any) => (
                  <div className="space-y-0.5 text-xs font-mono">
                    <div className="text-brand-700">
                      {ws._count?.doctorAffiliations || 0} Doctors ·{' '}
                      {ws._count?.members || 0} Staff
                    </div>
                    <div className="text-mut">
                      {ws._count?.vaultDocuments || 0} Records ·{' '}
                      {ws._count?.appointments || 0} Appts
                    </div>
                  </div>
                ),
              },
              {
                key: 'status',
                header: 'Status',
                render: (ws: any) => <StatusBadge label={ws.approvalStatus} />,
              },
              {
                key: 'actions',
                header: 'Governance',
                align: 'right',
                render: (ws: any) => (
                  <div className="inline-flex items-center justify-end gap-1.5">
                    {ws.approvalStatus !== 'APPROVED' && (
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateWorkspaceStatus(ws.id, 'APPROVED')
                        }
                        className="btn-primary !px-2.5 !py-1"
                      >
                        Approve
                      </button>
                    )}
                    {ws.approvalStatus === 'PENDING' && (
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateWorkspaceStatus(ws.id, 'DECLINED')
                        }
                        className="btn-danger !px-2.5 !py-1"
                      >
                        Decline
                      </button>
                    )}
                    {ws.approvalStatus === 'APPROVED' && (
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateWorkspaceStatus(ws.id, 'DISABLED')
                        }
                        className="btn-danger !px-2.5 !py-1"
                      >
                        Disable
                      </button>
                    )}
                  </div>
                ),
              },
            ]}
          />
        </div>
      )}

      {/* =================================================================== */}
      {/* 5. CENTRAL REGISTRY NOTIFICATIONS SYSTEM                            */}
      {/* =================================================================== */}
      {!detailView && activeSection === 'notifications' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-ink">
                Central Registry Notifications
              </h1>
              <p className="text-sm text-mut mt-0.5">
                Incoming BMDC doctor applications, healthcare facility license
                submissions, and national governance alerts.
              </p>
            </div>
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="btn-secondary"
            >
              <CheckCheck className="w-4 h-4" />
              <span>Mark All Read</span>
            </button>
          </div>

          <DataList
            title={`Verification Alerts & System Notifications (${unifiedRegistryNotifications.length})`}
            data={unifiedRegistryNotifications}
            getRowId={(r: any) => r.rowId}
            emptyMessage="No notifications in this view."
            toolbar={
              <div className="flex flex-wrap items-center gap-2">
                {(['ALL', 'PENDING', 'UNREAD'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setNotifFilter(tab)}
                    className={
                      notifFilter === tab ? 'btn-primary' : 'btn-secondary'
                    }
                  >
                    {tab === 'ALL'
                      ? 'All'
                      : tab === 'PENDING'
                        ? 'Pending Verifications'
                        : 'Unread'}
                  </button>
                ))}
              </div>
            }
            columns={[
              {
                key: 'category',
                header: 'Category',
                render: (row: any) => (
                  <StatusBadge
                    label={row.category}
                    tone={
                      row.isPendingAction
                        ? 'warning'
                        : row.isUnread
                          ? 'brand'
                          : 'neutral'
                    }
                  />
                ),
              },
              {
                key: 'details',
                header: 'Alert Details',
                render: (row: any) => {
                  const canNavigate = Boolean(
                    row.doctorId || row.workspaceId || row.patientId
                  );
                  return (
                    <div>
                      {canNavigate ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (row.doctorId) {
                              openDoctorPage(row.doctorId, 'notifications');
                            } else if (row.workspaceId) {
                              openWorkspacePage(
                                row.workspaceId,
                                'notifications'
                              );
                            } else if (row.patientId) {
                              openPatientPage(row.patientId, 'notifications');
                            }
                          }}
                          className={`text-left text-brand-800 hover:text-brand-900 underline underline-offset-2 ${
                            row.isUnread ? 'font-semibold' : 'font-medium'
                          }`}
                        >
                          {row.title}
                        </button>
                      ) : (
                        <div
                          className={`${
                            row.isUnread ? 'font-semibold' : 'font-medium'
                          } text-ink`}
                        >
                          {row.title}
                        </div>
                      )}
                      <div className="text-sm text-mut mt-0.5">
                        {row.message}
                      </div>
                    </div>
                  );
                },
              },
              {
                key: 'time',
                header: 'Received',
                render: (row: any) => (
                  <span className="font-mono text-xs text-mut">
                    {new Date(row.createdAt).toLocaleString()}
                  </span>
                ),
              },
              {
                key: 'actions',
                header: 'Actions',
                align: 'right',
                render: (row: any) => {
                  if (row.kind === 'PENDING_DOCTOR') {
                    return (
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateDoctorStatus(row.doctorId, 'APPROVED')
                          }
                          className="btn-primary !px-2.5 !py-1"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateDoctorStatus(row.doctorId, 'DECLINED')
                          }
                          className="btn-danger !px-2.5 !py-1"
                        >
                          Decline
                        </button>
                      </div>
                    );
                  }
                  if (row.kind === 'PENDING_WORKSPACE') {
                    return (
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateWorkspaceStatus(
                              row.workspaceId,
                              'APPROVED'
                            )
                          }
                          className="btn-primary !px-2.5 !py-1"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateWorkspaceStatus(
                              row.workspaceId,
                              'DECLINED'
                            )
                          }
                          className="btn-danger !px-2.5 !py-1"
                        >
                          Decline
                        </button>
                      </div>
                    );
                  }
                  return (
                    <div className="inline-flex items-center justify-end gap-1.5">
                      {row.isUnread && row.notifId ? (
                        <button
                          type="button"
                          onClick={() => handleMarkOneRead(row.notifId)}
                          className="btn-secondary !px-2.5 !py-1"
                        >
                          Mark Read
                        </button>
                      ) : (
                        <span className="text-xs text-mut">Read</span>
                      )}
                    </div>
                  );
                },
              },
            ]}
          />
        </div>
      )}

      {/* =================================================================== */}
      {/* 6. CENTRAL REGISTRY INSTITUTIONAL PROFILE                           */}
      {/* =================================================================== */}
      {!detailView && activeSection === 'profile' && (
        <div className="max-w-2xl mx-auto space-y-5">
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-semibold text-ink">
              Central Registry Profile
            </h1>
            <p className="text-sm text-mut">
              National Healthcare Regulatory Authority — DGHS Governance
              Account
            </p>
          </div>

          <div className="bg-paper border border-line rounded-md p-6 space-y-5">
            <div className="flex items-center gap-3.5 pb-4 border-b border-line">
              <div className="h-12 w-12 rounded-md bg-brand-50 border border-brand-200 flex items-center justify-center text-brand-700 shrink-0">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold text-ink">
                    {user?.centralRegistry?.name ||
                      'Directorate General of Health Services'}
                  </h2>
                  <StatusBadge label="ACTIVE AUTHORITY" tone="brand" />
                </div>
                <div className="font-mono text-xs text-mut mt-0.5">
                  Authority Code: {user?.centralRegistry?.code || 'DGHS-BD'}
                </div>
              </div>
            </div>

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="rounded border border-line bg-paper-2 p-3.5">
                <dt className="text-xs text-mut">Official Email</dt>
                <dd className="font-medium text-ink mt-0.5">
                  {user?.centralRegistry?.email || 'registry@dghs.gov.bd'}
                </dd>
              </div>
              <div className="rounded border border-line bg-paper-2 p-3.5">
                <dt className="text-xs text-mut">Regulatory Hotline</dt>
                <dd className="font-mono font-medium text-ink mt-0.5">
                  {user?.centralRegistry?.phone || '+880-2-9880000'}
                </dd>
              </div>
              <div className="rounded border border-line bg-paper-2 p-3.5">
                <dt className="text-xs text-mut">Jurisdiction</dt>
                <dd className="font-medium text-ink mt-0.5">
                  National Citizen Vault, BMDC Doctors &amp; Licensed Facilities
                </dd>
              </div>
              <div className="rounded border border-line bg-paper-2 p-3.5">
                <dt className="text-xs text-mut">Audit &amp; Compliance</dt>
                <dd className="font-medium text-brand-700 mt-0.5">
                  Full Cross-Entity Read &amp; Verification Access
                </dd>
              </div>
            </dl>
          </div>
        </div>
      )}

      {/* Clinical Document Viewer Modal (Supports Esc + Outside Backdrop Click + PDF Download) */}
      <DocumentViewerModal
        doc={inspectedDocRecord}
        onClose={() => {
          setInspectedDocRecord(null);
          setInspectedDocPatient(null);
        }}
        fallbackPatient={inspectedDocPatient}
      />
    </div>
  );
};
