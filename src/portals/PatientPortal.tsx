import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  QrCode,
  Plus,
  Download,
  Eye,
  Trash2,
  CheckCheck,
  Calendar,
} from 'lucide-react';
import { apiRequest } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { DataList } from '../components/DataList';
import { ModalDialog } from '../components/ModalDialog';
import { DocumentViewerModal } from '../components/DocumentViewerModal';
import { StatusBadge } from '../components/StatusBadge';
import { downloadClinicalDocumentPdf } from '../utils/pdfDownload';

function computeDoctorFeeRange(doc: any): string {
  const affFees = (doc.affiliations || [])
    .map((a: any) => Number(a.consultationFee))
    .filter((n: number) => Number.isFinite(n) && n > 0);

  if (affFees.length === 0) {
    const fallback = Number(doc.defaultConsultationFee || 0);
    return fallback > 0 ? `${fallback.toLocaleString()} Tk` : '—';
  }

  const min = Math.min(...affFees);
  const max = Math.max(...affFees);
  if (min === max) {
    return `${min.toLocaleString()} Tk`;
  }
  return `${min.toLocaleString()} – ${max.toLocaleString()} Tk`;
}

interface HealthPackageCardProps {
  pkg: any;
  onViewHospital?: (hospitalName: string) => void;
}

const HealthPackageCard: React.FC<HealthPackageCardProps> = ({
  pkg,
  onViewHospital,
}) => {
  const tests: string[] = Array.isArray(pkg.includedTests)
    ? pkg.includedTests
    : [];

  return (
    <article className="package-card">
      <header className="space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-base font-semibold text-ink leading-snug">
            {pkg.title}
          </h3>
          {pkg.isFeatured && <StatusBadge label="Featured" tone="brand" />}
        </div>
        <div className="text-xs text-mut">
          <span className="font-medium text-ink-2">
            {pkg.workspace?.name || 'Registered Facility'}
          </span>
          {pkg.workspace?.area ? ` · ${pkg.workspace.area}` : ''}
        </div>
      </header>

      <div className="space-y-2.5 text-sm">
        {(pkg.tagline || pkg.description) && (
          <p className="text-xs text-mut">
            {pkg.tagline || pkg.description}
          </p>
        )}
        <div>
          <div className="text-xs font-semibold text-ink-2 mb-1">
            Included Investigations ({tests.length || 1})
          </div>
          {tests.length > 0 ? (
            <ul className="flex flex-wrap gap-1">
              {tests.slice(0, 6).map((test: string, i: number) => (
                <li
                  key={i}
                  className="rounded border border-line bg-paper-2 px-2 py-0.5 text-xs text-ink-2"
                >
                  {test}
                </li>
              ))}
              {tests.length > 6 && (
                <li className="rounded border border-line bg-paper-2 px-2 py-0.5 text-xs font-mono text-mut">
                  +{tests.length - 6} more
                </li>
              )}
            </ul>
          ) : (
            <p className="text-xs text-mut">Standard diagnostic checkup panel</p>
          )}
        </div>
      </div>

      <footer className="pt-3 border-t border-line flex items-end justify-between gap-3">
        <div>
          <div className="text-xs text-mut">
            {pkg.durationLabel || 'Standard Delivery'}
          </div>
          <div className="flex items-baseline gap-2 mt-0.5 font-mono">
            <span className="text-lg font-semibold text-brand-700">
              {Number(pkg.price || 0).toLocaleString()} Tk
            </span>
            {pkg.originalPrice ? (
              <span className="text-xs text-mut line-through">
                {Number(pkg.originalPrice).toLocaleString()} Tk
              </span>
            ) : null}
          </div>
        </div>
        {onViewHospital && pkg.workspace?.name && (
          <button
            type="button"
            onClick={() => onViewHospital(pkg.workspace.name)}
            className="btn-secondary !px-2.5 !py-1 text-xs"
          >
            View Doctors
          </button>
        )}
      </footer>
    </article>
  );
};

export const PatientPortal: React.FC = () => {
  const {
    actingPatientId,
    setActingPatientId,
    activeSection,
    setActiveSection,
    refreshUserContext,
    refreshUnreadCount,
  } = useAuth();

  const [dashboard, setDashboard] = useState<any>(null);
  const [vaultDocs, setVaultDocs] = useState<any[]>([]);
  const [qrSessions, setQrSessions] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [workspacesData, setWorkspacesData] = useState<any>(null);
  const [familyData, setFamilyData] = useState<any>(null);
  const [staffInvites, setStaffInvites] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notifFilter, setNotifFilter] = useState<'ALL' | 'INVITATIONS' | 'UNREAD'>('ALL');
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Medical Records Filters & Selection
  const [vaultDoctorFilter, setVaultDoctorFilter] = useState<string>('');
  const [vaultWorkspaceFilter, setVaultWorkspaceFilter] = useState<string>('');
  const [vaultTypeFilter, setVaultTypeFilter] = useState<string>('');
  const [vaultSortBy, setVaultSortBy] = useState<string>('date_desc');
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);

  // Modals State
  const [inspectedDoc, setInspectedDoc] = useState<any | null>(null);
  const [qrPopupData, setQrPopupData] = useState<any | null>(null);
  const [activeSharesModalOpen, setActiveSharesModalOpen] =
    useState<boolean>(false);
  const [inspectedDoctor, setInspectedDoctor] = useState<any | null>(null);
  const [bookingDoctor, setBookingDoctor] = useState<any | null>(null);
  const [addFamilyModalOpen, setAddFamilyModalOpen] = useState<boolean>(false);

  // Doctor Directory Filters & Appointment Request Form
  const [docSearch, setDocSearch] = useState<string>('');
  const [docWorkspaceFilter, setDocWorkspaceFilter] = useState<string>('');
  const [docSpecialtyFilter, setDocSpecialtyFilter] = useState<string>('');
  const [docAreaFilter, setDocAreaFilter] = useState<string>('');
  const [bookingWorkspaceId, setBookingWorkspaceId] = useState<string>('');
  const [bookingDate, setBookingDate] = useState<string>(() =>
    new Date(Date.now() + 86400000).toISOString().slice(0, 10)
  );
  const [bookingSlot, setBookingSlot] = useState<string>('06:00 PM');
  const [bookingReason, setBookingReason] = useState<string>('');
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingSubmitting, setBookingSubmitting] = useState<boolean>(false);

  // Hospitals Directory Filters
  const [wsSearch, setWsSearch] = useState<string>('');
  const [wsArea, setWsArea] = useState<string>('');
  const [wsType, setWsType] = useState<string>('');
  const [wsSortBy, setWsSortBy] = useState<string>('name_asc');

  // Family Add Member Popup State
  const [famTargetId, setFamTargetId] = useState<string>('');
  const [famDirection, setFamDirection] = useState<string>('AS_MAINTAINER');
  const [famType, setFamType] = useState<string>('CHILD');
  const [famLabel, setFamLabel] = useState<string>('Son / Daughter');

  // Profile Form State
  const [profName, setProfName] = useState<string>('');
  const [profPhone, setProfPhone] = useState<string>('');
  const [profNewPassword, setProfNewPassword] = useState<string>('');
  const [profNid, setProfNid] = useState<string>('');
  const [profBloodGroup, setProfBloodGroup] = useState<string>('');
  const [profAddress, setProfAddress] = useState<string>('');
  const [profAvatar, setProfAvatar] = useState<string>('');
  const [secondaryEmails, setSecondaryEmails] = useState<string[]>([]);
  const [newSecEmail, setNewSecEmail] = useState<string>('');
  const [secondaryPhones, setSecondaryPhones] = useState<string[]>([]);
  const [newSecPhone, setNewSecPhone] = useState<string>('');

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setFeedback({ type, text });
  };

  const loadCoreData = useCallback(async () => {
    try {
      const notifParams = new URLSearchParams({ persona: 'PATIENT' });
      if (actingPatientId) notifParams.set('actingPatientId', actingPatientId);

      const [dashRes, qrRes, aptRes, invitesRes, famRes, notifRes] =
        await Promise.all([
          apiRequest('/patient/dashboard'),
          apiRequest('/patient/vault/qr-sessions'),
          apiRequest('/patient/appointments'),
          apiRequest('/patient/staff-invitations'),
          apiRequest('/patient/family'),
          apiRequest(`/notifications?${notifParams.toString()}`),
        ]);

      setDashboard(dashRes);
      setQrSessions(qrRes.sessions || []);
      setAppointments(aptRes.appointments || []);
      setStaffInvites(invitesRes.invitations || []);
      setFamilyData(famRes);
      setNotifications(notifRes.notifications || []);

      if (dashRes.patient) {
        setProfName(dashRes.patient.name || '');
        setProfPhone(dashRes.patient.phone || '');
        setProfNid(dashRes.patient.nationalId || '');
        setProfBloodGroup(dashRes.patient.bloodGroup || '');
        setProfAddress(dashRes.patient.address || '');
        setProfAvatar(dashRes.patient.profileAvatar || '');
        setSecondaryEmails(dashRes.patient.secondaryEmails || []);
        setSecondaryPhones(dashRes.patient.secondaryPhones || []);
      }
    } catch (err: any) {
      showFeedback('error', err.message || 'Failed to load patient records.');
    }
  }, [actingPatientId]);

  const loadVaultDocs = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (vaultDoctorFilter) params.set('doctorName', vaultDoctorFilter);
      if (vaultWorkspaceFilter)
        params.set('workspaceName', vaultWorkspaceFilter);
      if (vaultTypeFilter) params.set('type', vaultTypeFilter);
      params.set('sortBy', vaultSortBy);
      const res = await apiRequest(`/patient/vault?${params.toString()}`);
      setVaultDocs(res.documents || []);
    } catch (err: any) {
      showFeedback('error', err.message);
    }
  }, [
    vaultDoctorFilter,
    vaultWorkspaceFilter,
    vaultTypeFilter,
    vaultSortBy,
    actingPatientId,
  ]);

  const loadDoctors = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (docSearch) params.set('search', docSearch);
      if (docWorkspaceFilter) params.set('workspaceName', docWorkspaceFilter);
      if (docSpecialtyFilter) params.set('specialty', docSpecialtyFilter);
      if (docAreaFilter) params.set('area', docAreaFilter);
      const res = await apiRequest(`/patient/doctors?${params.toString()}`);
      setDoctors(res.doctors || []);
    } catch (err: any) {
      showFeedback('error', err.message);
    }
  }, [docSearch, docWorkspaceFilter, docSpecialtyFilter, docAreaFilter]);

  const loadWorkspaces = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (wsSearch) params.set('search', wsSearch);
      if (wsArea) params.set('area', wsArea);
      if (wsType) params.set('type', wsType);
      params.set('sortBy', wsSortBy);
      const res = await apiRequest(`/patient/workspaces?${params.toString()}`);
      setWorkspacesData(res);
    } catch (err: any) {
      showFeedback('error', err.message);
    }
  }, [wsSearch, wsArea, wsType, wsSortBy]);

  useEffect(() => {
    loadCoreData();
    loadVaultDocs();
    loadDoctors();
    loadWorkspaces();
  }, [loadCoreData, loadVaultDocs, loadDoctors, loadWorkspaces]);

  const activeQrSessions = useMemo(() => {
    const now = new Date();
    return qrSessions.filter(
      (s: any) =>
        ['GENERATED', 'SCANNED_ACTIVE'].includes(s.status) &&
        new Date(s.expiresAt) > now
    );
  }, [qrSessions]);

  const handleToggleDocRow = (id: string) => {
    setSelectedDocIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleToggleAllDocs = (checked: boolean) => {
    if (checked) {
      setSelectedDocIds(vaultDocs.map((d) => d.id));
    } else {
      setSelectedDocIds([]);
    }
  };

  const handleGenerateQr = async () => {
    if (selectedDocIds.length === 0) return;
    try {
      const res = await apiRequest('/patient/vault/qr-generate', {
        method: 'POST',
        body: {
          selectAll: false,
          documentIds: selectedDocIds,
        },
      });
      setQrPopupData(res);
      await loadCoreData();
    } catch (err: any) {
      showFeedback('error', err.message);
    }
  };

  const handleRevokeQr = async (sessionId: string) => {
    try {
      const res = await apiRequest(
        `/patient/vault/qr-sessions/${sessionId}/revoke`,
        { method: 'POST' }
      );
      showFeedback('success', res.message);
      if (qrPopupData?.session?.id === sessionId) {
        setQrPopupData(null);
      }
      await loadCoreData();
    } catch (err: any) {
      showFeedback('error', err.message);
    }
  };

  const openBookAppointmentModal = (doc: any) => {
    setBookingError(null);
    setBookingDoctor(doc);
    const firstAffWs = doc.affiliations?.[0]?.workspaceId;
    setBookingWorkspaceId(firstAffWs || 'INDEPENDENT_CHAMBER');
  };

  const handleBookAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingDoctor) return;
    if (!bookingDate) {
      setBookingError('Please select a preferred appointment date.');
      return;
    }
    setBookingError(null);
    setBookingSubmitting(true);
    try {
      const selectedWs =
        bookingWorkspaceId ||
        bookingDoctor.affiliations?.[0]?.workspaceId ||
        'INDEPENDENT_CHAMBER';
      const res = await apiRequest('/patient/appointments', {
        method: 'POST',
        body: {
          doctorId: bookingDoctor.id,
          workspaceId: selectedWs,
          appointmentDate: bookingDate,
          timeSlot: bookingSlot,
          reason: bookingReason.trim() || 'Specialist Consultation',
        },
      });
      showFeedback('success', res.message);
      setBookingDoctor(null);
      setBookingReason('');
      setBookingError(null);
      await loadCoreData();
    } catch (err: any) {
      const msg = err.message || 'Unable to submit appointment request.';
      setBookingError(msg);
      showFeedback('error', msg);
    } finally {
      setBookingSubmitting(false);
    }
  };

  const handleSendFamilyInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiRequest('/patient/family/invite', {
        method: 'POST',
        body: {
          targetIdentifier: famTargetId,
          direction: famDirection,
          relationshipType: famType,
          relationshipLabel: famLabel,
        },
      });
      showFeedback('success', res.message);
      setFamTargetId('');
      setAddFamilyModalOpen(false);
      await Promise.all([loadCoreData(), refreshUserContext()]);
    } catch (err: any) {
      showFeedback('error', err.message);
    }
  };

  const handleToggleFamilyStatus = async (
    relId: string,
    status: 'ACTIVE' | 'REVOKED'
  ) => {
    try {
      const res = await apiRequest(`/patient/family/${relId}/status`, {
        method: 'PATCH',
        body: { status },
      });
      showFeedback('success', res.message);
      await Promise.all([
        loadCoreData(),
        refreshUserContext(),
        refreshUnreadCount(),
      ]);
    } catch (err: any) {
      showFeedback('error', err.message);
    }
  };

  const handleRespondStaffInvite = async (
    memberId: string,
    action: 'ACCEPT' | 'REVOKE'
  ) => {
    try {
      const res = await apiRequest(
        `/patient/staff-invitations/${memberId}/respond`,
        {
          method: 'PATCH',
          body: { action },
        }
      );
      showFeedback('success', res.message);
      await Promise.all([
        loadCoreData(),
        refreshUserContext(),
        refreshUnreadCount(),
      ]);
    } catch (err: any) {
      showFeedback('error', err.message);
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    try {
      await apiRequest('/notifications/read-all', {
        method: 'POST',
        body: {
          actingPatientId: actingPatientId || undefined,
          persona: 'PATIENT',
        },
      });
      await Promise.all([loadCoreData(), refreshUnreadCount()]);
    } catch (err: any) {
      showFeedback('error', err.message);
    }
  };

  const handleMarkOneRead = async (id: string) => {
    try {
      await apiRequest(`/notifications/${id}/read`, { method: 'PATCH' });
      await Promise.all([loadCoreData(), refreshUnreadCount()]);
    } catch {
      // ignore
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiRequest('/patient/profile', {
        method: 'PATCH',
        body: {
          name: profName,
          phone: profPhone,
          newPassword: profNewPassword || undefined,
          nationalId: profNid || undefined,
          bloodGroup: profBloodGroup,
          address: profAddress,
          profileAvatar: profAvatar || undefined,
          secondaryEmails,
          secondaryPhones,
        },
      });
      showFeedback('success', res.message);
      setProfNewPassword('');
      await Promise.all([loadCoreData(), refreshUserContext()]);
    } catch (err: any) {
      showFeedback('error', err.message);
    }
  };

  const handleAvatarFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setProfAvatar(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Unified Family Members List (Dependents managed by user + Maintainers managing user)
  const unifiedFamilyRows = useMemo(() => {
    if (!familyData) return [];
    const dependents = (familyData.maintainedDependents || []).map(
      (rel: any) => ({
        id: rel.id,
        roleKind: 'DEPENDENT' as const,
        personId: rel.dependent?.id,
        name: rel.dependent?.name,
        uniqueId: rel.dependent?.uniqueId,
        accountType: rel.dependent?.accountType || 'CHILD',
        relationshipLabel: rel.relationshipLabel || 'Dependent',
        status: rel.status,
        vaultCount: rel.dependent?._count?.vaultDocuments ?? 0,
      })
    );
    const maintainers = (familyData.managedByMaintainers || []).map(
      (rel: any) => ({
        id: rel.id,
        roleKind: 'MAINTAINER' as const,
        personId: rel.maintainer?.id,
        name: rel.maintainer?.name,
        uniqueId: rel.maintainer?.uniqueId,
        accountType: 'NORMAL',
        relationshipLabel: `${rel.relationshipLabel || 'Family'} (Maintainer)`,
        status: rel.status,
        vaultCount: null,
      })
    );
    return [...dependents, ...maintainers];
  }, [familyData]);

  // Unified Notifications + Actionable Invitations Rows
  const unifiedNotificationRows = useMemo(() => {
    const rows: any[] = [];

    // 1. Actionable Hospital Staff Invitations (only when viewing own account)
    if (!actingPatientId) {
      for (const inv of staffInvites) {
        if (inv.invitationStatus === 'PENDING') {
          rows.push({
            rowId: `staff-inv-${inv.id}`,
            kind: 'STAFF_INVITE',
            isInvitation: true,
            isUnread: true,
            category: 'Hospital Staff Invitation',
            title: `${inv.workspace?.name || 'Hospital'} — Staff Role Invitation`,
            message: `Invited as ${
              inv.assignedRoles?.map((r: any) => r.role.name).join(', ') ||
              inv.staffTitle ||
              'Staff'
            }`,
            createdAt: inv.createdAt,
            memberId: inv.id,
          });
        }
      }
    }

    // 2. Actionable Pending Family Link Invitations
    for (const fam of unifiedFamilyRows) {
      if (fam.status === 'PENDING') {
        rows.push({
          rowId: `fam-inv-${fam.id}`,
          kind: 'FAMILY_INVITE',
          isInvitation: true,
          isUnread: true,
          category: 'Family Invitation',
          title: `Family Account Link — ${fam.name} (${fam.uniqueId})`,
          message:
            fam.roleKind === 'DEPENDENT'
              ? `Pending link to manage ${fam.name} (${fam.relationshipLabel}).`
              : `${fam.name} requested maintainer access (${fam.relationshipLabel}).`,
          createdAt: new Date().toISOString(),
          relId: fam.id,
        });
      }
    }

    // 3. Persistent Notifications
    for (const n of notifications) {
      const isInvType =
        n.type === 'STAFF_INVITATION' ||
        n.type === 'FAMILY_INVITE' ||
        n.type === 'DOCTOR_AFFILIATION';
      rows.push({
        rowId: `notif-${n.id}`,
        notifId: n.id,
        kind: 'NOTIFICATION',
        isInvitation: isInvType,
        isUnread: !n.isRead,
        category: n.type ? n.type.replace(/_/g, ' ') : 'Update',
        title: n.title,
        message: n.message,
        createdAt: n.createdAt,
      });
    }

    if (notifFilter === 'INVITATIONS') {
      return rows.filter((r) => r.isInvitation);
    }
    if (notifFilter === 'UNREAD') {
      return rows.filter((r) => r.isUnread);
    }
    return rows;
  }, [
    actingPatientId,
    staffInvites,
    unifiedFamilyRows,
    notifications,
    notifFilter,
  ]);

  const patient = dashboard?.patient;

  return (
    <div className="space-y-6">
      {/* Proxy Account Banner (Only when managing a Child or Senior Dependent) */}
      {actingPatientId && patient && (
        <div className="rounded-md bg-brand-50 border border-brand-200 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-sm">
          <div>
            <span className="font-semibold text-brand-900">
              Managing Family Account:{' '}
            </span>
            <span className="text-brand-800">
              {patient.name} ({patient.uniqueId})
            </span>
          </div>
          <button
            type="button"
            onClick={() => setActingPatientId(null)}
            className="btn-secondary"
          >
            Switch Back to My Account
          </button>
        </div>
      )}

      {/* Feedback Banner */}
      {feedback && (
        <div
          role="status"
          className={`rounded-md border px-4 py-3 text-sm font-medium flex items-center justify-between gap-3 ${
            feedback.type === 'success'
              ? 'bg-brand-50 border-brand-200 text-brand-800'
              : 'bg-accent-50 border-accent-100 text-accent-600'
          }`}
        >
          <span>{feedback.text}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-xs underline shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* =================================================================== */}
      {/* 1. OVERVIEW                                                         */}
      {/* =================================================================== */}
      {activeSection === 'overview' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-ink">Overview</h1>
              {patient && (
                <p className="text-sm text-mut mt-0.5">
                  {patient.name} ·{' '}
                  <span className="font-mono text-ink-2">
                    {patient.uniqueId}
                  </span>
                  {patient.bloodGroup ? ` · Blood Group ${patient.bloodGroup}` : ''}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveSection('doctors')}
                className="btn-secondary"
              >
                Find a Doctor
              </button>
              <button
                type="button"
                onClick={() => setActiveSection('records')}
                className="btn-primary"
              >
                Medical Records
              </button>
            </div>
          </div>

          {/* Hospital Health Packages as Cards at the Top */}
          {(workspacesData?.featuredPackages?.length ?? 0) > 0 && (
            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold text-ink">
                    Hospital Health & Diagnostic Packages
                  </h2>
                  <p className="text-xs text-mut">
                    Preventive checkup packages offered by DGHS-approved
                    hospitals and diagnostic centers.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveSection('hospitals')}
                  className="btn-secondary"
                >
                  View All Packages ({workspacesData.featuredPackages.length})
                </button>
              </div>
              <div className="package-card-grid">
                {workspacesData.featuredPackages.slice(0, 3).map((pkg: any) => (
                  <HealthPackageCard
                    key={pkg.id}
                    pkg={pkg}
                    onViewHospital={(name) => {
                      setDocWorkspaceFilter(name);
                      setActiveSection('doctors');
                    }}
                  />
                ))}
              </div>
            </section>
          )}

          {/* 4 Clean Summary Boxes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-paper border border-line rounded-md p-4">
              <div className="text-sm text-mut">Medical Records</div>
              <div className="text-2xl font-semibold text-ink font-mono mt-1">
                {vaultDocs.length}
              </div>
            </div>
            <div className="bg-paper border border-line rounded-md p-4">
              <div className="text-sm text-mut">Upcoming Appointments</div>
              <div className="text-2xl font-semibold text-ink font-mono mt-1">
                {
                  appointments.filter((a: any) =>
                    ['PENDING', 'APPROVED'].includes(a.status)
                  ).length
                }
              </div>
            </div>
            <div className="bg-paper border border-line rounded-md p-4">
              <div className="text-sm text-mut">Active Shared QR</div>
              <div className="text-2xl font-semibold text-brand-700 font-mono mt-1">
                {activeQrSessions.length}
              </div>
            </div>
            <div className="bg-paper border border-line rounded-md p-4">
              <div className="text-sm text-mut">Family Members</div>
              <div className="text-2xl font-semibold text-ink font-mono mt-1">
                {unifiedFamilyRows.length}
              </div>
            </div>
          </div>

          {/* Upcoming Appointments List */}
          <DataList
            title="Upcoming Appointments"
            data={appointments.slice(0, 5)}
            getRowId={(r: any) => r.id}
            emptyMessage="No scheduled appointments."
            headerActions={
              <button
                type="button"
                onClick={() => setActiveSection('appointments')}
                className="btn-secondary"
              >
                View All Appointments
              </button>
            }
            columns={[
              {
                key: 'doctor',
                header: 'Doctor',
                render: (apt: any) => (
                  <div>
                    <div className="font-medium text-ink">
                      {apt.doctor?.patientUser?.name || 'Specialist'}
                    </div>
                    <div className="text-xs text-mut">
                      {apt.doctor?.specialty}
                    </div>
                  </div>
                ),
              },
              {
                key: 'facility',
                header: 'Hospital / Chamber',
                render: (apt: any) => (
                  <span>
                    {apt.workspace?.name || 'Independent Personal Chamber'}
                  </span>
                ),
              },
              {
                key: 'schedule',
                header: 'Date & Time',
                render: (apt: any) => (
                  <span className="font-mono text-sm">
                    {apt.appointmentDate} · {apt.timeSlot}
                  </span>
                ),
              },
              {
                key: 'status',
                header: 'Status',
                render: (apt: any) => <StatusBadge label={apt.status} />,
              },
            ]}
          />

          {/* Recent Medical Records List */}
          <DataList
            title="Recent Medical Records"
            data={(dashboard?.recentVaultDocs || vaultDocs).slice(0, 5)}
            getRowId={(r: any) => r.id}
            emptyMessage="No medical records in your account yet."
            headerActions={
              <button
                type="button"
                onClick={() => setActiveSection('records')}
                className="btn-secondary"
              >
                View All Records
              </button>
            }
            columns={[
              {
                key: 'code',
                header: 'Record Code',
                render: (doc: any) => (
                  <div className="space-y-0.5">
                    <div className="font-mono text-xs text-ink-2">
                      {doc.documentCode}
                    </div>
                    <StatusBadge label={doc.type} />
                  </div>
                ),
              },
              {
                key: 'title',
                header: 'Title',
                render: (doc: any) => (
                  <div>
                    <div className="font-medium text-ink">{doc.title}</div>
                    {doc.summary && (
                      <div className="text-xs text-mut">{doc.summary}</div>
                    )}
                  </div>
                ),
              },
              {
                key: 'source',
                header: 'Clinician / Facility',
                render: (doc: any) => (
                  <div className="text-sm">
                    <div>
                      {doc.doctor?.patientUser?.name ||
                        doc.doctorNameSnapshot ||
                        'Clinical Staff'}
                    </div>
                    <div className="text-xs text-mut">
                      {doc.workspace?.name ||
                        doc.workspaceNameSnapshot ||
                        'Independent Chamber'}
                    </div>
                  </div>
                ),
              },
              {
                key: 'date',
                header: 'Date',
                render: (doc: any) => (
                  <span className="font-mono text-sm text-mut">
                    {new Date(doc.createdAt).toLocaleDateString()}
                  </span>
                ),
              },
              {
                key: 'actions',
                header: 'Actions',
                align: 'right',
                render: (doc: any) => (
                  <div className="inline-flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => setInspectedDoc(doc)}
                      className="btn-secondary !px-2.5 !py-1"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadClinicalDocumentPdf(doc, patient)}
                      className="btn-secondary !px-2.5 !py-1"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>PDF</span>
                    </button>
                  </div>
                ),
              },
            ]}
          />
        </div>
      )}

      {/* =================================================================== */}
      {/* 2. MEDICAL RECORDS (SELECTABLE LIST + GENERATE QR POPUP + PDF)      */}
      {/* =================================================================== */}
      {activeSection === 'records' && (
        <div className="space-y-5">
          <div>
            <h1 className="text-2xl font-semibold text-ink">Medical Records</h1>
            <p className="text-sm text-mut mt-0.5">
              Select one, several, or all records and click Generate QR to share
              temporary 2-hour access with your doctor, or download any record
              as PDF.
            </p>
          </div>

          <DataList
            title={`All Records (${vaultDocs.length})`}
            selectable={true}
            selectedIds={selectedDocIds}
            onToggleRow={handleToggleDocRow}
            onToggleAll={handleToggleAllDocs}
            data={vaultDocs}
            getRowId={(r: any) => r.id}
            emptyMessage="No medical records match your current filters."
            headerActions={
              <>
                <button
                  type="button"
                  onClick={() => setActiveSharesModalOpen(true)}
                  className="btn-secondary"
                >
                  Active Shares ({activeQrSessions.length})
                </button>
                {vaultDocs.length > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      handleToggleAllDocs(
                        selectedDocIds.length < vaultDocs.length
                      )
                    }
                    className="btn-secondary"
                  >
                    {selectedDocIds.length === vaultDocs.length &&
                    vaultDocs.length > 0
                      ? 'Clear Selection'
                      : 'Select All'}
                  </button>
                )}
                <button
                  type="button"
                  disabled={selectedDocIds.length === 0}
                  onClick={handleGenerateQr}
                  className="btn-primary"
                >
                  <QrCode className="w-4 h-4" />
                  <span>
                    Generate QR
                    {selectedDocIds.length > 0
                      ? ` (${selectedDocIds.length})`
                      : ''}
                  </span>
                </button>
              </>
            }
            toolbar={
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                <input
                  type="search"
                  value={vaultDoctorFilter}
                  onChange={(e) => setVaultDoctorFilter(e.target.value)}
                  placeholder="Filter by doctor name..."
                  className="rounded-md border border-line bg-paper px-3 py-1.5 text-sm text-ink"
                />
                <input
                  type="search"
                  value={vaultWorkspaceFilter}
                  onChange={(e) => setVaultWorkspaceFilter(e.target.value)}
                  placeholder="Filter by facility name..."
                  className="rounded-md border border-line bg-paper px-3 py-1.5 text-sm text-ink"
                />
                <select
                  value={vaultTypeFilter}
                  onChange={(e) => setVaultTypeFilter(e.target.value)}
                  aria-label="Filter by document type"
                  className="rounded-md border border-line bg-paper px-3 py-1.5 text-sm text-ink"
                >
                  <option value="">All Record Types</option>
                  <option value="PRESCRIPTION">Prescriptions</option>
                  <option value="LAB_REPORT">Laboratory Reports</option>
                  <option value="BILLING_DOC">Billing Invoices</option>
                </select>
                <select
                  value={vaultSortBy}
                  onChange={(e) => setVaultSortBy(e.target.value)}
                  aria-label="Sort medical records"
                  className="rounded-md border border-line bg-paper px-3 py-1.5 text-sm text-ink"
                >
                  <option value="date_desc">Sort: Newest First</option>
                  <option value="date_asc">Sort: Oldest First</option>
                  <option value="doctor">Sort: Doctor Name (A–Z)</option>
                  <option value="workspace">Sort: Facility Name (A–Z)</option>
                </select>
              </div>
            }
            columns={[
              {
                key: 'type',
                header: 'Type & Code',
                render: (doc: any) => (
                  <div className="space-y-1">
                    <StatusBadge label={doc.type} />
                    <div className="font-mono text-xs text-mut">
                      {doc.documentCode}
                    </div>
                  </div>
                ),
              },
              {
                key: 'title',
                header: 'Document Title',
                render: (doc: any) => (
                  <div>
                    <div className="font-medium text-ink">{doc.title}</div>
                    {doc.summary && (
                      <div className="text-xs text-mut mt-0.5">
                        {doc.summary}
                      </div>
                    )}
                  </div>
                ),
              },
              {
                key: 'doctor',
                header: 'Doctor',
                render: (doc: any) => (
                  <span>
                    {doc.doctor?.patientUser?.name ||
                      doc.doctorNameSnapshot ||
                      '—'}
                  </span>
                ),
              },
              {
                key: 'facility',
                header: 'Facility',
                render: (doc: any) => (
                  <span>
                    {doc.workspace?.name ||
                      doc.workspaceNameSnapshot ||
                      'Independent Chamber'}
                  </span>
                ),
              },
              {
                key: 'date',
                header: 'Issued Date',
                render: (doc: any) => (
                  <span className="font-mono text-sm text-mut">
                    {new Date(doc.createdAt).toLocaleDateString()}
                  </span>
                ),
              },
              {
                key: 'actions',
                header: 'Actions',
                align: 'right',
                render: (doc: any) => (
                  <div className="inline-flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => setInspectedDoc(doc)}
                      className="btn-secondary !px-2.5 !py-1"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadClinicalDocumentPdf(doc, patient)}
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
      {/* 3. DOCTORS (UNIFIED DATALIST + FEE RANGE + AVAILABILITY + POPUP)    */}
      {/* =================================================================== */}
      {activeSection === 'doctors' && (
        <div className="space-y-5">
          <div>
            <h1 className="text-2xl font-semibold text-ink">Doctors</h1>
            <p className="text-sm text-mut mt-0.5">
              Browse verified specialists, consultation fee ranges, and
              available hospital chambers.
            </p>
          </div>

          <DataList
            title={`Registered Specialists (${doctors.length})`}
            data={doctors}
            getRowId={(d: any) => d.id}
            emptyMessage="No doctors match your search filters."
            toolbar={
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                <input
                  type="search"
                  value={docSearch}
                  onChange={(e) => setDocSearch(e.target.value)}
                  placeholder="Search doctor name..."
                  className="rounded-md border border-line bg-paper px-3 py-1.5 text-sm text-ink"
                />
                <input
                  type="search"
                  value={docWorkspaceFilter}
                  onChange={(e) => setDocWorkspaceFilter(e.target.value)}
                  placeholder="Filter by hospital or clinic..."
                  className="rounded-md border border-line bg-paper px-3 py-1.5 text-sm text-ink"
                />
                <select
                  value={docSpecialtyFilter}
                  onChange={(e) => setDocSpecialtyFilter(e.target.value)}
                  aria-label="Filter by specialty"
                  className="rounded-md border border-line bg-paper px-3 py-1.5 text-sm text-ink"
                >
                  <option value="">All Specialties</option>
                  <option value="Cardiology">Cardiology</option>
                  <option value="Gynecology">Gynecology</option>
                  <option value="Orthopedics">Orthopedics</option>
                  <option value="Neurology">Neurology</option>
                  <option value="Pediatrics">Pediatrics</option>
                  <option value="General Medicine">General Medicine</option>
                </select>
                <input
                  type="search"
                  value={docAreaFilter}
                  onChange={(e) => setDocAreaFilter(e.target.value)}
                  placeholder="Filter by area (e.g. Dhanmondi)..."
                  className="rounded-md border border-line bg-paper px-3 py-1.5 text-sm text-ink"
                />
              </div>
            }
            columns={[
              {
                key: 'doctor',
                header: 'Doctor',
                render: (doc: any) => (
                  <div className="flex items-center gap-3">
                    {doc.profileImage ? (
                      <img
                        src={doc.profileImage}
                        alt={doc.name}
                        className="w-10 h-10 rounded object-cover border border-line shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded bg-brand-700 text-white flex items-center justify-center font-semibold text-sm shrink-0">
                        Dr
                      </div>
                    )}
                    <div>
                      <div className="font-semibold text-ink">{doc.name}</div>
                      <div className="text-xs text-mut">
                        {doc.degrees?.length
                          ? doc.degrees.join(', ')
                          : 'Registered Physician'}
                        {doc.experienceYears
                          ? ` · ${doc.experienceYears} yrs exp`
                          : ''}
                      </div>
                    </div>
                  </div>
                ),
              },
              {
                key: 'specialty',
                header: 'Specialty',
                render: (doc: any) => (
                  <StatusBadge label={doc.specialty} tone="brand" />
                ),
              },
              {
                key: 'locations',
                header: 'Available Locations',
                render: (doc: any) => {
                  const affs = doc.affiliations || [];
                  if (affs.length === 0) {
                    return (
                      <span className="text-sm text-mut">
                        {doc.area || 'Independent Chamber'}
                      </span>
                    );
                  }
                  return (
                    <div className="space-y-0.5 text-sm">
                      {affs.map((aff: any) => (
                        <div key={aff.affiliationId} className="text-ink-2">
                          <span className="font-medium text-ink">
                            {aff.workspaceName}
                          </span>
                          {aff.area ? (
                            <span className="text-xs text-mut">
                              {' '}
                              ({aff.area})
                            </span>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  );
                },
              },
              {
                key: 'feeRange',
                header: 'Consultation Fee',
                render: (doc: any) => (
                  <span className="font-mono font-semibold text-brand-700">
                    {computeDoctorFeeRange(doc)}
                  </span>
                ),
              },
              {
                key: 'actions',
                header: 'Actions',
                align: 'right',
                render: (doc: any) => (
                  <div className="inline-flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => setInspectedDoctor(doc)}
                      className="btn-secondary !px-2.5 !py-1"
                    >
                      Details
                    </button>
                    <button
                      type="button"
                      onClick={() => openBookAppointmentModal(doc)}
                      className="btn-primary !px-2.5 !py-1"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Request Appointment</span>
                    </button>
                  </div>
                ),
              },
            ]}
          />
        </div>
      )}

      {/* =================================================================== */}
      {/* 4. APPOINTMENTS                                                     */}
      {/* =================================================================== */}
      {activeSection === 'appointments' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-ink">Appointments</h1>
              <p className="text-sm text-mut mt-0.5">
                Track all requested, confirmed, and completed hospital
                consultations.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveSection('doctors')}
              className="btn-primary"
            >
              Request New Appointment
            </button>
          </div>

          <DataList
            title={`All Appointments (${appointments.length})`}
            data={appointments}
            getRowId={(a: any) => a.id}
            emptyMessage="You have not requested any appointments yet."
            columns={[
              {
                key: 'code',
                header: 'Booking Code',
                render: (apt: any) => (
                  <span className="font-mono text-xs text-ink-2">
                    {apt.appointmentCode}
                  </span>
                ),
              },
              {
                key: 'doctor',
                header: 'Doctor',
                render: (apt: any) => (
                  <div>
                    <div className="font-medium text-ink">
                      {apt.doctor?.patientUser?.name || '—'}
                    </div>
                    <div className="text-xs text-mut">
                      {apt.doctor?.specialty}
                    </div>
                  </div>
                ),
              },
              {
                key: 'hospital',
                header: 'Hospital / Chamber',
                render: (apt: any) => (
                  <div>
                    <div className="font-medium text-ink">
                      {apt.workspace?.name || 'Independent Personal Chamber'}
                    </div>
                    <div className="text-xs text-mut">
                      {apt.workspace?.area || apt.doctor?.area || 'Direct Chamber'}
                    </div>
                  </div>
                ),
              },
              {
                key: 'schedule',
                header: 'Date & Slot',
                render: (apt: any) => (
                  <span className="font-mono text-sm">
                    {apt.appointmentDate} · {apt.timeSlot}
                  </span>
                ),
              },
              {
                key: 'serial',
                header: 'Serial',
                render: (apt: any) => (
                  <span className="font-mono text-sm">
                    {apt.serialNumber ? `#${apt.serialNumber}` : 'Pending'}
                  </span>
                ),
              },
              {
                key: 'status',
                header: 'Status',
                align: 'right',
                render: (apt: any) => <StatusBadge label={apt.status} />,
              },
            ]}
          />
        </div>
      )}

      {/* =================================================================== */}
      {/* 5. HOSPITALS & PACKAGES (CLEAN UNIFIED DATALISTS)                   */}
      {/* =================================================================== */}
      {activeSection === 'hospitals' && (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-semibold text-ink">
              Hospitals & Packages
            </h1>
            <p className="text-sm text-mut mt-0.5">
              Compare diagnostic checkup packages and search DGHS-approved
              healthcare facilities.
            </p>
          </div>

          <section className="space-y-3">
            <div>
              <h2 className="text-base font-semibold text-ink">
                Health & Diagnostic Packages (
                {workspacesData?.featuredPackages?.length || 0})
              </h2>
              <p className="text-xs text-mut">
                Published checkup packages across verified hospitals and
                diagnostic centers.
              </p>
            </div>
            {(workspacesData?.featuredPackages?.length ?? 0) === 0 ? (
              <div className="rounded-md border border-line bg-paper p-6 text-sm text-mut text-center">
                No active health packages match your current filters.
              </div>
            ) : (
              <div className="package-card-grid">
                {(workspacesData?.featuredPackages || []).map((pkg: any) => (
                  <HealthPackageCard
                    key={pkg.id}
                    pkg={pkg}
                    onViewHospital={(name) => {
                      setDocWorkspaceFilter(name);
                      setActiveSection('doctors');
                    }}
                  />
                ))}
              </div>
            )}
          </section>

          <DataList
            title={`Registered Facilities (${workspacesData?.workspaces?.length || 0})`}
            data={workspacesData?.workspaces || []}
            getRowId={(ws: any) => ws.id}
            emptyMessage="No healthcare facilities match your search."
            toolbar={
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                <input
                  type="search"
                  value={wsSearch}
                  onChange={(e) => setWsSearch(e.target.value)}
                  placeholder="Search facility name..."
                  className="rounded-md border border-line bg-paper px-3 py-1.5 text-sm text-ink"
                />
                <input
                  type="search"
                  value={wsArea}
                  onChange={(e) => setWsArea(e.target.value)}
                  placeholder="Filter by area..."
                  className="rounded-md border border-line bg-paper px-3 py-1.5 text-sm text-ink"
                />
                <select
                  value={wsType}
                  onChange={(e) => setWsType(e.target.value)}
                  aria-label="Filter by facility type"
                  className="rounded-md border border-line bg-paper px-3 py-1.5 text-sm text-ink"
                >
                  <option value="">All Facility Types</option>
                  <option value="HOSPITAL">Hospital</option>
                  <option value="CLINIC">Clinic</option>
                  <option value="DIAGNOSTIC_CENTER">Diagnostic Center</option>
                  <option value="CHAMBER">Chamber</option>
                </select>
                <select
                  value={wsSortBy}
                  onChange={(e) => setWsSortBy(e.target.value)}
                  aria-label="Sort facilities"
                  className="rounded-md border border-line bg-paper px-3 py-1.5 text-sm text-ink"
                >
                  <option value="name_asc">Sort: Name (A–Z)</option>
                  <option value="name_desc">Sort: Name (Z–A)</option>
                  <option value="area">Sort: Area</option>
                  <option value="newest">Sort: Newest</option>
                </select>
              </div>
            }
            columns={[
              {
                key: 'name',
                header: 'Facility',
                render: (ws: any) => (
                  <div>
                    <div className="font-semibold text-ink">{ws.name}</div>
                    <div className="font-mono text-xs text-mut">
                      {ws.workspaceCode}
                    </div>
                  </div>
                ),
              },
              {
                key: 'type',
                header: 'Category',
                render: (ws: any) => <StatusBadge label={ws.type} />,
              },
              {
                key: 'location',
                header: 'Area & Address',
                render: (ws: any) => (
                  <div className="text-sm">
                    <div className="font-medium text-ink">{ws.area}</div>
                    <div className="text-xs text-mut">{ws.address}</div>
                  </div>
                ),
              },
              {
                key: 'depts',
                header: 'Departments',
                render: (ws: any) => (
                  <div className="text-xs text-ink-2 max-w-sm">
                    {(ws.departments || []).join(', ') || 'General Care'}
                  </div>
                ),
              },
              {
                key: 'phone',
                header: 'Contact',
                align: 'right',
                render: (ws: any) => (
                  <span className="font-mono text-sm text-ink-2">
                    {ws.phone || '—'}
                  </span>
                ),
              },
            ]}
          />
        </div>
      )}

      {/* =================================================================== */}
      {/* 6. FAMILY (ONLY LIST OF MEMBERS + TOP-RIGHT ADD MEMBER POPUP)       */}
      {/* =================================================================== */}
      {activeSection === 'family' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-ink">Family</h1>
              <p className="text-sm text-mut mt-0.5">
                Linked child and senior family accounts managed under proxy
                access.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAddFamilyModalOpen(true)}
              className="btn-primary"
            >
              <Plus className="w-4 h-4" />
              <span>Add Member</span>
            </button>
          </div>

          <DataList
            title={`Family Members (${unifiedFamilyRows.length})`}
            data={unifiedFamilyRows}
            getRowId={(r: any) => `${r.roleKind}-${r.id}`}
            emptyMessage="No family members linked yet. Click Add Member to link a child or senior account."
            columns={[
              {
                key: 'member',
                header: 'Family Member',
                render: (row: any) => (
                  <div>
                    <div className="font-semibold text-ink">{row.name}</div>
                    <div className="font-mono text-xs text-mut">
                      {row.uniqueId}
                    </div>
                  </div>
                ),
              },
              {
                key: 'category',
                header: 'Account Type',
                render: (row: any) => <StatusBadge label={row.accountType} />,
              },
              {
                key: 'relation',
                header: 'Relationship',
                render: (row: any) => (
                  <span className="text-sm text-ink-2">
                    {row.relationshipLabel}
                  </span>
                ),
              },
              {
                key: 'status',
                header: 'Status',
                render: (row: any) => <StatusBadge label={row.status} />,
              },
              {
                key: 'actions',
                header: 'Actions',
                align: 'right',
                render: (row: any) => (
                  <div className="inline-flex items-center justify-end gap-1.5">
                    {row.roleKind === 'DEPENDENT' &&
                      row.status === 'ACTIVE' && (
                        <button
                          type="button"
                          onClick={() => {
                            setActingPatientId(row.personId);
                            setActiveSection('overview');
                          }}
                          className="btn-primary !px-2.5 !py-1"
                        >
                          Manage Account
                        </button>
                      )}
                    {row.status !== 'ACTIVE' ? (
                      <button
                        type="button"
                        onClick={() =>
                          handleToggleFamilyStatus(row.id, 'ACTIVE')
                        }
                        className="btn-primary !px-2.5 !py-1"
                      >
                        Accept
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          handleToggleFamilyStatus(row.id, 'REVOKED')
                        }
                        className="btn-danger !px-2.5 !py-1"
                      >
                        Revoke
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
      {/* 7. NOTIFICATIONS (DEDICATED PAGE + ACCEPT / REVOKE INVITATIONS)     */}
      {/* =================================================================== */}
      {activeSection === 'notifications' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-ink">Notifications</h1>
              <p className="text-sm text-mut mt-0.5">
                Review hospital staff invitations, family account requests, and
                clinical record updates.
              </p>
            </div>
            <button
              type="button"
              onClick={handleMarkAllNotificationsRead}
              className="btn-secondary"
            >
              <CheckCheck className="w-4 h-4" />
              <span>Mark All Read</span>
            </button>
          </div>

          <DataList
            title="Activity & Invitations"
            data={unifiedNotificationRows}
            getRowId={(r: any) => r.rowId}
            emptyMessage="No notifications or invitations in this view."
            toolbar={
              <div className="flex flex-wrap items-center gap-2">
                {(['ALL', 'INVITATIONS', 'UNREAD'] as const).map((tab) => (
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
                      : tab === 'INVITATIONS'
                        ? 'Invitations'
                        : 'Unread'}
                  </button>
                ))}
              </div>
            }
            columns={[
              {
                key: 'category',
                header: 'Type',
                render: (row: any) => (
                  <StatusBadge
                    label={row.isInvitation ? 'Invitation' : row.category}
                    tone={
                      row.isInvitation
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
                header: 'Details',
                render: (row: any) => (
                  <div>
                    <div
                      className={`${
                        row.isUnread ? 'font-semibold' : 'font-medium'
                      } text-ink`}
                    >
                      {row.title}
                    </div>
                    <div className="text-sm text-mut mt-0.5">{row.message}</div>
                  </div>
                ),
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
                  if (row.kind === 'STAFF_INVITE') {
                    return (
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            handleRespondStaffInvite(row.memberId, 'ACCEPT')
                          }
                          className="btn-primary !px-2.5 !py-1"
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleRespondStaffInvite(row.memberId, 'REVOKE')
                          }
                          className="btn-danger !px-2.5 !py-1"
                        >
                          Revoke
                        </button>
                      </div>
                    );
                  }
                  if (row.kind === 'FAMILY_INVITE') {
                    return (
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            handleToggleFamilyStatus(row.relId, 'ACTIVE')
                          }
                          className="btn-primary !px-2.5 !py-1"
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleToggleFamilyStatus(row.relId, 'REVOKED')
                          }
                          className="btn-danger !px-2.5 !py-1"
                        >
                          Revoke
                        </button>
                      </div>
                    );
                  }
                  if (row.isUnread && row.notifId) {
                    return (
                      <button
                        type="button"
                        onClick={() => handleMarkOneRead(row.notifId)}
                        className="btn-secondary !px-2.5 !py-1"
                      >
                        Mark Read
                      </button>
                    );
                  }
                  return <span className="text-xs text-mut">Read</span>;
                },
              },
            ]}
          />
        </div>
      )}

      {/* =================================================================== */}
      {/* 8. PROFILE (PERSONAL PROFILE CONFIGURATION ONLY — CENTERED)         */}
      {/* =================================================================== */}
      {activeSection === 'profile' && (
        <div className="mx-auto w-full max-w-3xl space-y-5">
          <div>
            <h1 className="text-2xl font-semibold text-ink">Profile</h1>
            <p className="text-sm text-mut mt-0.5">
              Update your personal demographics, contact details, and security
              credentials.
            </p>
          </div>

          <form
            onSubmit={handleSaveProfile}
            className="bg-paper border border-line rounded-md p-6 space-y-5"
          >
            <div className="flex items-center gap-4 pb-4 border-b border-line">
              {profAvatar ? (
                <img
                  src={profAvatar}
                  alt="Profile"
                  className="w-16 h-16 rounded-md object-cover border border-line"
                />
              ) : (
                <div className="w-16 h-16 rounded-md bg-brand-700 text-white flex items-center justify-center font-semibold text-xl">
                  {profName?.[0] || 'P'}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-ink-2 mb-1">
                  Profile Photo
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarFileUpload}
                  className="text-sm text-mut"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-ink-2 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={profName}
                  onChange={(e) => setProfName(e.target.value)}
                  className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base text-ink"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-2 mb-1">
                  Primary Phone
                </label>
                <input
                  type="tel"
                  required
                  value={profPhone}
                  onChange={(e) => setProfPhone(e.target.value)}
                  className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base font-mono text-ink"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-ink-2 mb-1">
                  Blood Group
                </label>
                <input
                  type="text"
                  value={profBloodGroup}
                  onChange={(e) => setProfBloodGroup(e.target.value)}
                  placeholder="O+"
                  className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base text-ink"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-2 mb-1">
                  National ID
                </label>
                <input
                  type="text"
                  value={profNid}
                  onChange={(e) => setProfNid(e.target.value)}
                  className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base font-mono text-ink"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-2 mb-1">
                  New Password (Optional)
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={profNewPassword}
                  onChange={(e) => setProfNewPassword(e.target.value)}
                  placeholder="Leave blank to keep"
                  className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base text-ink"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-2 mb-1">
                Residential Address
              </label>
              <input
                type="text"
                value={profAddress}
                onChange={(e) => setProfAddress(e.target.value)}
                className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base text-ink"
              />
            </div>

            {/* Secondary Emails & Phones */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-line">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-ink-2">
                  Additional Emails
                </label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={newSecEmail}
                    onChange={(e) => setNewSecEmail(e.target.value)}
                    placeholder="secondary@example.com"
                    className="flex-1 rounded-md border border-line bg-paper px-3 py-1.5 text-sm text-ink"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newSecEmail.trim()) {
                        setSecondaryEmails((prev) => [
                          ...prev,
                          newSecEmail.trim(),
                        ]);
                        setNewSecEmail('');
                      }
                    }}
                    className="btn-secondary"
                  >
                    Add
                  </button>
                </div>
                {secondaryEmails.map((em, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded border border-line bg-paper-2 px-2.5 py-1 text-xs"
                  >
                    <span>{em}</span>
                    <button
                      type="button"
                      aria-label={`Remove ${em}`}
                      onClick={() =>
                        setSecondaryEmails((prev) =>
                          prev.filter((_, i) => i !== idx)
                        )
                      }
                      className="text-accent-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-ink-2">
                  Additional Phone Numbers
                </label>
                <div className="flex gap-2">
                  <input
                    type="tel"
                    value={newSecPhone}
                    onChange={(e) => setNewSecPhone(e.target.value)}
                    placeholder="+88018XXXXXXXX"
                    className="flex-1 rounded-md border border-line bg-paper px-3 py-1.5 text-sm font-mono text-ink"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newSecPhone.trim()) {
                        setSecondaryPhones((prev) => [
                          ...prev,
                          newSecPhone.trim(),
                        ]);
                        setNewSecPhone('');
                      }
                    }}
                    className="btn-secondary"
                  >
                    Add
                  </button>
                </div>
                {secondaryPhones.map((ph, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded border border-line bg-paper-2 px-2.5 py-1 text-xs font-mono"
                  >
                    <span>{ph}</span>
                    <button
                      type="button"
                      aria-label={`Remove ${ph}`}
                      onClick={() =>
                        setSecondaryPhones((prev) =>
                          prev.filter((_, i) => i !== idx)
                        )
                      }
                      className="text-accent-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button type="submit" className="btn-primary">
                Save Profile Changes
              </button>
            </div>
          </form>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODALS / POPUPS                                                     */}
      {/* =================================================================== */}

      {/* 1. Clinical Document Viewer + PDF Download Modal */}
      <DocumentViewerModal
        doc={inspectedDoc}
        onClose={() => setInspectedDoc(null)}
        fallbackPatient={patient}
      />

      {/* 2. Generated QR Code & Pairing Code Popup */}
      <ModalDialog
        open={Boolean(qrPopupData)}
        onClose={() => setQrPopupData(null)}
        title="Doctor Consultation QR Code"
        subtitle="Valid for 2 hours. Show this QR code or 6-character code to your doctor."
        maxWidthClass="max-w-md"
      >
        {qrPopupData && (
          <div className="space-y-4 text-center">
            <div className="inline-block p-3 rounded-md border border-line bg-paper">
              <img
                src={qrPopupData.qrDataUrl}
                alt="Temporary Patient QR Code"
                className="w-48 h-48 mx-auto"
              />
            </div>

            <div className="rounded-md border border-line bg-paper-2 p-3.5 space-y-1">
              <div className="text-xs text-mut">Pairing Code</div>
              <div className="font-mono text-2xl font-semibold tracking-wider text-brand-800">
                {qrPopupData.session.shortCode}
              </div>
              <div className="text-xs text-mut pt-1">
                Expires at{' '}
                {new Date(qrPopupData.session.expiresAt).toLocaleTimeString(
                  [],
                  { hour: '2-digit', minute: '2-digit' }
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => handleRevokeQr(qrPopupData.session.id)}
                className="btn-danger"
              >
                Revoke Access
              </button>
              <button
                type="button"
                onClick={() => setQrPopupData(null)}
                className="btn-primary"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </ModalDialog>

      {/* 3. Active QR Shares Popup */}
      <ModalDialog
        open={activeSharesModalOpen}
        onClose={() => setActiveSharesModalOpen(false)}
        title="QR Share Sessions"
        subtitle="Review active and recent QR access sessions and revoke access at any time."
        maxWidthClass="max-w-2xl"
      >
        <DataList
          data={qrSessions}
          getRowId={(s: any) => s.id}
          emptyMessage="No QR codes generated yet."
          columns={[
            {
              key: 'code',
              header: 'Pairing Code',
              render: (s: any) => (
                <span className="font-mono font-semibold text-ink">
                  {s.shortCode}
                </span>
              ),
            },
            {
              key: 'doctor',
              header: 'Scanned By',
              render: (s: any) => (
                <span>
                  {s.scannedByDoctor?.patientUser?.name || 'Not scanned yet'}
                </span>
              ),
            },
            {
              key: 'expires',
              header: 'Expires',
              render: (s: any) => (
                <span className="font-mono text-xs text-mut">
                  {new Date(s.expiresAt).toLocaleString()}
                </span>
              ),
            },
            {
              key: 'status',
              header: 'Status',
              render: (s: any) => <StatusBadge label={s.status} />,
            },
            {
              key: 'action',
              header: 'Action',
              align: 'right',
              render: (s: any) => {
                const isActive =
                  ['GENERATED', 'SCANNED_ACTIVE'].includes(s.status) &&
                  new Date(s.expiresAt) > new Date();
                return isActive ? (
                  <button
                    type="button"
                    onClick={() => handleRevokeQr(s.id)}
                    className="btn-danger !px-2.5 !py-1"
                  >
                    Revoke
                  </button>
                ) : (
                  <span className="text-xs text-mut">Closed</span>
                );
              },
            },
          ]}
        />
      </ModalDialog>

      {/* 4. Doctor Details Modal (Shows Fee Range & Available Locations without per-hospital fee breakdown) */}
      <ModalDialog
        open={Boolean(inspectedDoctor)}
        onClose={() => setInspectedDoctor(null)}
        title={inspectedDoctor?.name || 'Doctor Details'}
        subtitle={
          inspectedDoctor
            ? `${inspectedDoctor.specialty} · Consultation Fee: ${computeDoctorFeeRange(inspectedDoctor)}`
            : undefined
        }
      >
        {inspectedDoctor && (
          <div className="space-y-4 text-sm">
            {inspectedDoctor.degrees?.length > 0 && (
              <div>
                <div className="text-xs text-mut">Qualifications</div>
                <div className="font-medium text-ink mt-0.5">
                  {inspectedDoctor.degrees.join(', ')}
                </div>
              </div>
            )}

            {inspectedDoctor.bio && (
              <div>
                <div className="text-xs text-mut">Clinical Summary</div>
                <p className="text-ink-2 mt-0.5">{inspectedDoctor.bio}</p>
              </div>
            )}

            {inspectedDoctor.achievements?.length > 0 && (
              <div>
                <div className="text-xs text-mut">Highlights</div>
                <ul className="list-disc list-inside text-ink-2 mt-0.5 space-y-0.5">
                  {inspectedDoctor.achievements.map((a: string, i: number) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <div className="text-xs text-mut mb-1.5">
                Available Chambers & Schedules
              </div>
              {(inspectedDoctor.affiliations || []).length === 0 ? (
                <p className="text-mut">No active hospital chambers listed.</p>
              ) : (
                <div className="space-y-2">
                  {inspectedDoctor.affiliations.map((aff: any) => (
                    <div
                      key={aff.affiliationId}
                      className="rounded-md border border-line bg-paper-2 p-2.5"
                    >
                      <div className="font-medium text-ink">
                        {aff.workspaceName}{' '}
                        {aff.area ? `(${aff.area})` : ''}
                      </div>
                      <div className="text-xs text-mut mt-0.5">
                        {aff.schedule}
                        {aff.roomNumber ? ` · ${aff.roomNumber}` : ''}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setInspectedDoctor(null)}
                className="btn-secondary"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  const doc = inspectedDoctor;
                  setInspectedDoctor(null);
                  openBookAppointmentModal(doc);
                }}
                className="btn-primary"
              >
                Request Appointment
              </button>
            </div>
          </div>
        )}
      </ModalDialog>

      {/* 5. Request Appointment Modal (Shows exact hospital fee & schedule + Independent Chamber option) */}
      <ModalDialog
        open={Boolean(bookingDoctor)}
        onClose={() => {
          setBookingDoctor(null);
          setBookingError(null);
        }}
        title="Request Appointment"
        subtitle={
          bookingDoctor
            ? `${bookingDoctor.name} (${bookingDoctor.specialty})`
            : undefined
        }
      >
        {bookingDoctor && (
          <form onSubmit={handleBookAppointment} className="space-y-4">
            {bookingError && (
              <div
                role="alert"
                className="rounded-md border border-accent-100 bg-accent-50 px-3.5 py-2.5 text-sm text-accent-600"
              >
                {bookingError}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-ink-2 mb-1">
                Select Hospital / Chamber
              </label>
              <select
                required
                value={bookingWorkspaceId}
                onChange={(e) => setBookingWorkspaceId(e.target.value)}
                className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base text-ink"
              >
                {(bookingDoctor.affiliations || []).map((aff: any) => (
                  <option key={aff.workspaceId} value={aff.workspaceId}>
                    {aff.workspaceName} ({aff.area || 'Facility'}) —{' '}
                    {Number(aff.consultationFee || 0).toLocaleString()} Tk ·{' '}
                    {aff.schedule || 'Standard Hours'}
                  </option>
                ))}
                <option value="INDEPENDENT_CHAMBER">
                  Independent Personal Chamber (
                  {bookingDoctor.area || 'Direct Consultation'}) —{' '}
                  {Number(
                    bookingDoctor.defaultConsultationFee || 1000
                  ).toLocaleString()}{' '}
                  Tk
                </option>
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-ink-2 mb-1">
                  Preferred Date
                </label>
                <input
                  type="date"
                  required
                  value={bookingDate}
                  onChange={(e) => setBookingDate(e.target.value)}
                  className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base font-mono text-ink"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-2 mb-1">
                  Preferred Time Slot
                </label>
                <select
                  value={bookingSlot}
                  onChange={(e) => setBookingSlot(e.target.value)}
                  className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base text-ink"
                >
                  <option value="05:00 PM">05:00 PM</option>
                  <option value="06:00 PM">06:00 PM</option>
                  <option value="07:00 PM">07:00 PM</option>
                  <option value="08:00 PM">08:00 PM</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-2 mb-1">
                Reason for Consultation
              </label>
              <input
                type="text"
                value={bookingReason}
                onChange={(e) => setBookingReason(e.target.value)}
                placeholder="Routine checkup or symptoms..."
                className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base text-ink"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setBookingDoctor(null);
                  setBookingError(null);
                }}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={bookingSubmitting}
                className="btn-primary"
              >
                {bookingSubmitting ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </form>
        )}
      </ModalDialog>

      {/* 6. Add Family Member Modal */}
      <ModalDialog
        open={addFamilyModalOpen}
        onClose={() => setAddFamilyModalOpen(false)}
        title="Add Family Member"
        subtitle="Link an existing child or senior Patient account to manage their records and appointments."
      >
        <form onSubmit={handleSendFamilyInvite} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink-2 mb-1">
              Link Role
            </label>
            <select
              value={famDirection}
              onChange={(e) => setFamDirection(e.target.value)}
              className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base text-ink"
            >
              <option value="AS_MAINTAINER">
                I am the Maintainer (Add Child or Senior Dependent)
              </option>
              <option value="AS_DEPENDENT">
                I am a Child/Senior Account (Assign My Maintainer)
              </option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-2 mb-1">
              Member Patient ID, Email, or Phone
            </label>
            <input
              type="text"
              required
              value={famTargetId}
              onChange={(e) => setFamTargetId(e.target.value)}
              placeholder="PAT-2026-100002 or child@demo.bd"
              className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base text-ink"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-ink-2 mb-1">
                Account Category
              </label>
              <select
                value={famType}
                onChange={(e) => setFamType(e.target.value)}
                className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base text-ink"
              >
                <option value="CHILD">Child Account</option>
                <option value="OLD">Senior Account</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-2 mb-1">
                Relationship Label
              </label>
              <input
                type="text"
                value={famLabel}
                onChange={(e) => setFamLabel(e.target.value)}
                placeholder="Son, Daughter, Parent"
                className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base text-ink"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setAddFamilyModalOpen(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Send Invitation
            </button>
          </div>
        </form>
      </ModalDialog>
    </div>
  );
};
