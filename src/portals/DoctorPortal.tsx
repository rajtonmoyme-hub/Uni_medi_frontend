import React, { useState, useEffect, useCallback, useMemo } from 'react';
import jsQR from 'jsqr';
import {
  QrCode,
  Plus,
  Trash2,
  Download,
  Eye,
  Lock,
  Upload,
  CheckCheck,
  AlertTriangle,
} from 'lucide-react';
import { apiRequest } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { DataList } from '../components/DataList';
import { ModalDialog } from '../components/ModalDialog';
import { DocumentViewerModal } from '../components/DocumentViewerModal';
import { StatusBadge } from '../components/StatusBadge';
import { downloadClinicalDocumentPdf } from '../utils/pdfDownload';

interface MedicationItem {
  name: string;
  dosage: string;
  duration: string;
  instruction: string;
}

export const DoctorPortal: React.FC = () => {
  const {
    user,
    activeSection,
    setActiveSection,
    refreshUserContext,
    refreshUnreadCount,
  } = useAuth();

  const [bannerMsg, setBannerMsg] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [lastRevokedAffId, setLastRevokedAffId] = useState<string | null>(null);

  // Core Data States
  const [dashboard, setDashboard] = useState<any>(null);
  const [qrQueue, setQrQueue] = useState<any[]>([]);
  const [historyPrescriptions, setHistoryPrescriptions] = useState<any[]>([]);
  const [affiliations, setAffiliations] = useState<any[]>([]);
  const [availableWorkspaces, setAvailableWorkspaces] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notifFilter, setNotifFilter] = useState<
    'ALL' | 'INVITATIONS' | 'UNREAD'
  >('ALL');

  // Modals State
  const [scanModalOpen, setScanModalOpen] = useState<boolean>(false);
  const [consultSession, setConsultSession] = useState<any | null>(null);
  const [requestAffModalOpen, setRequestAffModalOpen] =
    useState<boolean>(false);
  const [inspectedDoc, setInspectedDoc] = useState<any | null>(null);

  // QR Scanner Input
  const [qrInput, setQrInput] = useState<string>('');
  const [scanWorkspaceId, setScanWorkspaceId] = useState<string>('');

  // Prescription Form State (Strictly bound to consultSession.id)
  const [rxTitle, setRxTitle] = useState<string>('');
  const [rxDiagnosis, setRxDiagnosis] = useState<string>('');
  const [rxComplaints, setRxComplaints] = useState<string>('');
  const [rxBp, setRxBp] = useState<string>('120/80 mmHg');
  const [rxPulse, setRxPulse] = useState<string>('74 bpm');
  const [rxTemp, setRxTemp] = useState<string>('98.6 °F');
  const [rxWeight, setRxWeight] = useState<string>('70 kg');
  const [rxMedications, setRxMedications] = useState<MedicationItem[]>([
    {
      name: 'Tab. Rosuvastatin 10mg',
      dosage: '0 + 0 + 1',
      duration: '30 Days',
      instruction: 'After dinner',
    },
  ]);
  const [rxTests, setRxTests] = useState<string>(
    'CBC, Fasting Lipid Profile, ECG'
  );
  const [rxAdvice, setRxAdvice] = useState<string>(
    'Maintain low-sodium diet, walk 30 minutes daily, and avoid smoking.'
  );
  const [rxFollowUp, setRxFollowUp] = useState<string>('2026-12-10');

  // History Filters
  const [historyWorkspaceFilter, setHistoryWorkspaceFilter] =
    useState<string>('ALL');
  const [historySortBy, setHistorySortBy] = useState<string>('date_desc');
  const [historySearch, setHistorySearch] = useState<string>('');

  // Request Affiliation Popup Form
  const [reqWorkspaceId, setReqWorkspaceId] = useState<string>('');
  const [reqFee, setReqFee] = useState<string>('1500');
  const [reqSchedule, setReqSchedule] = useState<string>(
    'Sat, Mon, Wed: 5:00 PM - 9:00 PM'
  );
  const [reqDepartment, setReqDepartment] = useState<string>('');

  // Profile State
  const [profSpecialty, setProfSpecialty] = useState<string>('');
  const [profDegrees, setProfDegrees] = useState<string>('');
  const [profAchievements, setProfAchievements] = useState<string>('');
  const [profBio, setProfBio] = useState<string>('');
  const [profArea, setProfArea] = useState<string>('');
  const [profExpYears, setProfExpYears] = useState<string>('10');
  const [profDefaultFee, setProfDefaultFee] = useState<string>('1200');
  const [profImage, setProfImage] = useState<string>('');
  const [profVisibility, setProfVisibility] = useState<Record<string, boolean>>(
    {
      showDegrees: true,
      showAchievements: true,
      showBio: true,
      showProfilePic: true,
      showEmail: false,
      showPhone: false,
      showDefaultFee: true,
    }
  );

  const notify = (type: 'success' | 'error', text: string) => {
    setBannerMsg({ type, text });
  };

  const loadCoreData = useCallback(async () => {
    try {
      const [dashRes, affRes, notifRes] = await Promise.all([
        apiRequest<any>('/doctor/dashboard'),
        apiRequest<any>('/doctor/affiliations'),
        apiRequest<any>('/notifications?persona=DOCTOR'),
      ]);

      setDashboard(dashRes);
      setAffiliations(affRes.affiliations || []);
      setAvailableWorkspaces(affRes.availableWorkspaces || []);
      setNotifications(notifRes.notifications || []);

      if (affRes.availableWorkspaces?.length > 0 && !reqWorkspaceId) {
        setReqWorkspaceId(affRes.availableWorkspaces[0].id);
      }

      const doc = dashRes.doctor;
      if (doc) {
        setProfSpecialty(doc.specialty || '');
        setProfDegrees((doc.degrees || []).join(', '));
        setProfAchievements((doc.achievements || []).join(', '));
        setProfBio(doc.bio || '');
        setProfArea(doc.area || '');
        setProfExpYears(String(doc.experienceYears || 10));
        setProfDefaultFee(String(doc.defaultConsultationFee || 1000));
        setProfImage(doc.profileImage || '');
        if (doc.profileVisibility && typeof doc.profileVisibility === 'object') {
          setProfVisibility((prev) => ({
            ...prev,
            ...doc.profileVisibility,
          }));
        }
      }

      if (doc?.approvalStatus === 'APPROVED') {
        const qRes = await apiRequest<{ queue: any[] }>('/doctor/qr/queue');
        const qList = qRes.queue || [];
        setQrQueue(qList);
        setConsultSession((prev: any) => {
          if (!prev) return null;
          return qList.find((item) => item.id === prev.id) || null;
        });
      }
    } catch (err: any) {
      notify('error', err.message || 'Failed to load Doctor Portal.');
    }
  }, [reqWorkspaceId]);

  const loadHistory = useCallback(async () => {
    if (dashboard?.doctor?.approvalStatus !== 'APPROVED') return;
    try {
      const params = new URLSearchParams();
      params.set('workspaceId', historyWorkspaceFilter);
      params.set('sortBy', historySortBy);
      if (historySearch.trim()) params.set('search', historySearch.trim());

      const res = await apiRequest<{ prescriptions: any[] }>(
        `/doctor/history?${params.toString()}`
      );
      setHistoryPrescriptions(res.prescriptions || []);
    } catch (err: any) {
      notify('error', err.message || 'Failed to load prescription history.');
    }
  }, [
    dashboard?.doctor?.approvalStatus,
    historyWorkspaceFilter,
    historySortBy,
    historySearch,
  ]);

  useEffect(() => {
    loadCoreData();
  }, [loadCoreData]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleScanQrCode = async (
    e?: React.FormEvent,
    overrideCode?: string
  ) => {
    if (e) e.preventDefault();
    const codeToScan = (overrideCode ?? qrInput).trim();
    if (!codeToScan) {
      notify('error', 'Enter a 6-character pairing code or upload a QR image.');
      return;
    }
    try {
      const res = await apiRequest<{ message: string; session: any }>(
        '/doctor/qr/scan',
        {
          method: 'POST',
          body: {
            qrInput: codeToScan,
            workspaceId: scanWorkspaceId || undefined,
          },
        }
      );
      notify('success', res.message);
      setQrInput('');
      setScanModalOpen(false);
      await loadCoreData();
      setActiveSection('consultations');
      setConsultSession(res.session);
    } catch (err: any) {
      notify('error', err.message || 'QR scan failed.');
    }
  };

  const handleQrImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const decoded = jsQR(imageData.data, imageData.width, imageData.height);
        if (decoded && decoded.data) {
          setQrInput(decoded.data);
          handleScanQrCode(undefined, decoded.data);
        } else {
          notify(
            'error',
            'Could not detect a valid QR code in that image. Enter the 6-character pairing code instead.'
          );
        }
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleDismissFromQueue = async (sessionId: string) => {
    try {
      const res = await apiRequest<{ message: string }>(
        `/doctor/qr/queue/${sessionId}/dismiss`,
        { method: 'POST' }
      );
      notify('success', res.message);
      if (consultSession?.id === sessionId) {
        setConsultSession(null);
      }
      await loadCoreData();
    } catch (err: any) {
      notify('error', err.message);
    }
  };

  const handleIssuePrescription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consultSession) return;

    const cleanMeds = rxMedications.filter((m) => m.name.trim());
    if (!rxDiagnosis.trim() || cleanMeds.length === 0) {
      notify(
        'error',
        'Provide a primary diagnosis and at least one medication.'
      );
      return;
    }

    try {
      const res = await apiRequest<{ message: string; prescription: any }>(
        '/doctor/prescriptions',
        {
          method: 'POST',
          body: {
            qrSessionId: consultSession.id,
            workspaceId:
              scanWorkspaceId || consultSession.workspaceId || undefined,
            title:
              rxTitle.trim() || `Clinical Prescription — ${rxDiagnosis.trim()}`,
            diagnosis: rxDiagnosis.trim(),
            chiefComplaints: rxComplaints.trim(),
            vitals: {
              bp: rxBp,
              pulse: rxPulse,
              temp: rxTemp,
              weight: rxWeight,
            },
            medications: cleanMeds,
            recommendedTests: rxTests
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean),
            advice: rxAdvice.trim(),
            followUpDate: rxFollowUp || null,
          },
        }
      );
      notify('success', res.message);
      setRxTitle('');
      setRxDiagnosis('');
      setRxComplaints('');
      setConsultSession(null);
      await Promise.all([loadCoreData(), loadHistory()]);
    } catch (err: any) {
      notify('error', err.message);
    }
  };

  const handleVerifyImmutability = async (prescriptionId: string) => {
    try {
      await apiRequest(`/doctor/prescriptions/${prescriptionId}`, {
        method: 'PATCH',
        body: { diagnosis: 'Attempted Modification' },
      });
    } catch (err: any) {
      notify('error', `Record Locked (HTTP 403): ${err.message}`);
    }
  };

  const handleRequestAffiliation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiRequest<{ message: string }>(
        '/doctor/affiliations/request',
        {
          method: 'POST',
          body: {
            workspaceId: reqWorkspaceId,
            consultationFee: Number(reqFee) || 1000,
            schedule: reqSchedule,
            department: reqDepartment || profSpecialty,
          },
        }
      );
      notify('success', res.message);
      setRequestAffModalOpen(false);
      await loadCoreData();
    } catch (err: any) {
      notify('error', err.message);
    }
  };

  const handleRespondAffiliation = async (
    affId: string,
    status: 'ACTIVE' | 'REJECTED' | 'REVOKED' | 'PENDING',
    allowUndoBanner?: boolean
  ) => {
    try {
      const res = await apiRequest<{ message: string; auditLog?: any }>(
        `/doctor/affiliations/${affId}/respond`,
        {
          method: 'PATCH',
          body: { status },
        }
      );
      const logSuffix = res.auditLog?.action
        ? ` [${res.auditLog.action}]`
        : '';
      notify('success', `${res.message}${logSuffix}`);
      if (status === 'REVOKED' && allowUndoBanner) {
        setLastRevokedAffId(affId);
      } else if (lastRevokedAffId === affId) {
        setLastRevokedAffId(null);
      }
      await Promise.all([loadCoreData(), refreshUnreadCount()]);
    } catch (err: any) {
      notify('error', err.message);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await apiRequest('/notifications/read-all', {
        method: 'POST',
        body: { persona: 'DOCTOR' },
      });
      await Promise.all([loadCoreData(), refreshUnreadCount()]);
    } catch (err: any) {
      notify('error', err.message);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiRequest<{ message: string }>('/doctor/profile', {
        method: 'PATCH',
        body: {
          specialty: profSpecialty,
          degrees: profDegrees
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          achievements: profAchievements
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          bio: profBio,
          area: profArea,
          experienceYears: Number(profExpYears) || 0,
          defaultConsultationFee: Number(profDefaultFee) || 1000,
          profileImage: profImage || null,
          profileVisibility: profVisibility,
        },
      });
      notify('success', res.message);
      await Promise.all([loadCoreData(), refreshUserContext()]);
    } catch (err: any) {
      notify('error', err.message);
    }
  };

  const handleDoctorAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setProfImage(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const doctor = dashboard?.doctor || user?.doctorProfile;
  const activeWorkspaces = (doctor?.workspaceAffiliations || []).filter(
    (a: any) => a.status === 'ACTIVE'
  );

  const unifiedNotificationRows = useMemo(() => {
    const rows: any[] = [];

    // Pending incoming affiliation invitations from hospitals
    for (const aff of affiliations) {
      if (aff.status === 'PENDING' && aff.initiatedBy === 'WORKSPACE') {
        rows.push({
          rowId: `aff-inv-${aff.id}`,
          kind: 'AFFILIATION_INVITE',
          affId: aff.id,
          isInvitation: true,
          isUnread: true,
          category: 'Hospital Invitation',
          title: `${aff.workspace?.name} — Chamber Affiliation Invite`,
          message: `Proposed fee: ${Number(aff.consultationFee).toLocaleString()} Tk · Schedule: ${aff.schedule || 'Flexible'}`,
          createdAt: aff.createdAt,
        });
      }
    }

    for (const n of notifications) {
      rows.push({
        rowId: `notif-${n.id}`,
        notifId: n.id,
        kind: 'NOTIFICATION',
        isInvitation: n.type === 'DOCTOR_AFFILIATION',
        isUnread: !n.isRead,
        category: n.type ? n.type.replace(/_/g, ' ') : 'Clinical Notice',
        title: n.title,
        message: n.message,
        createdAt: n.createdAt,
      });
    }

    if (notifFilter === 'INVITATIONS')
      return rows.filter((r) => r.isInvitation);
    if (notifFilter === 'UNREAD') return rows.filter((r) => r.isUnread);
    return rows;
  }, [affiliations, notifications, notifFilter]);

  return (
    <div className="space-y-6">
      {/* Pending DGHS Approval Notice */}
      {doctor && doctor.approvalStatus !== 'APPROVED' && (
        <div className="rounded-md bg-gold-50 border border-gold-100 p-4 flex items-start gap-3 text-sm text-gold-700">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold">
              Registration Status: {doctor.approvalStatus} (Central Registry
              Review)
            </div>
            <p className="mt-0.5">
              You can configure your profile while awaiting DGHS verification,
              or switch to your Patient account from the top header.
            </p>
          </div>
        </div>
      )}

      {/* Feedback Banner */}
      {bannerMsg && (
        <div
          role="status"
          className={`rounded-md border px-4 py-3 text-sm font-medium flex flex-wrap items-center justify-between gap-3 ${
            bannerMsg.type === 'success'
              ? 'bg-brand-50 border-brand-200 text-brand-800'
              : 'bg-accent-50 border-accent-100 text-accent-600'
          }`}
        >
          <span>{bannerMsg.text}</span>
          <div className="inline-flex items-center gap-2 shrink-0">
            {lastRevokedAffId && bannerMsg.type === 'success' && (
              <button
                type="button"
                onClick={() =>
                  handleRespondAffiliation(lastRevokedAffId, 'ACTIVE')
                }
                className="btn-primary !px-2.5 !py-1 text-xs"
              >
                Undo Revoke
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setBannerMsg(null);
                setLastRevokedAffId(null);
              }}
              className="text-xs underline"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 1. OVERVIEW                                                         */}
      {/* =================================================================== */}
      {activeSection === 'overview' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-semibold text-ink">Overview</h1>
                {doctor?.approvalStatus && (
                  <StatusBadge label={doctor.approvalStatus} />
                )}
              </div>
              <p className="text-sm text-mut mt-0.5">
                {doctor?.patientUser?.name || user?.patient?.name} ·{' '}
                <span className="font-mono text-ink-2">
                  {doctor?.doctorIdCode}
                </span>{' '}
                · BMDC{' '}
                <span className="font-mono text-ink-2">
                  {doctor?.doctorLicense}
                </span>
              </p>
            </div>

            <button
              type="button"
              disabled={doctor?.approvalStatus !== 'APPROVED'}
              onClick={() => setScanModalOpen(true)}
              className="btn-primary"
            >
              <QrCode className="w-4 h-4" />
              <span>Scan Patient QR</span>
            </button>
          </div>

          {/* 4 Stat Boxes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-paper border border-line rounded-md p-4">
              <div className="text-sm text-mut">Active Patient Queue</div>
              <div className="text-2xl font-semibold text-brand-700 font-mono mt-1">
                {qrQueue.length}
              </div>
            </div>
            <div className="bg-paper border border-line rounded-md p-4">
              <div className="text-sm text-mut">Prescriptions Issued</div>
              <div className="text-2xl font-semibold text-ink font-mono mt-1">
                {dashboard?.metrics?.totalPrescriptionsIssued ??
                  historyPrescriptions.length}
              </div>
            </div>
            <div className="bg-paper border border-line rounded-md p-4">
              <div className="text-sm text-mut">Affiliated Hospitals</div>
              <div className="text-2xl font-semibold text-ink font-mono mt-1">
                {activeWorkspaces.length}
              </div>
            </div>
            <div className="bg-paper border border-line rounded-md p-4">
              <div className="text-sm text-mut">Scheduled Appointments</div>
              <div className="text-2xl font-semibold text-ink font-mono mt-1">
                {dashboard?.metrics?.totalAppointments ?? 0}
              </div>
            </div>
          </div>

          <DataList
            title="Active Consultation Queue"
            data={qrQueue.slice(0, 5)}
            getRowId={(s: any) => s.id}
            emptyMessage="No patients currently in your active QR queue."
            headerActions={
              <button
                type="button"
                onClick={() => setActiveSection('consultations')}
                className="btn-secondary"
              >
                Open Consultations
              </button>
            }
            columns={[
              {
                key: 'patient',
                header: 'Patient',
                render: (s: any) => (
                  <div>
                    <div className="font-semibold text-ink">
                      {s.patient?.name}
                    </div>
                    <div className="font-mono text-xs text-mut">
                      {s.patient?.uniqueId}
                    </div>
                  </div>
                ),
              },
              {
                key: 'code',
                header: 'QR Session',
                render: (s: any) => (
                  <span className="font-mono text-sm font-medium text-brand-700">
                    {s.shortCode}
                  </span>
                ),
              },
              {
                key: 'docs',
                header: 'Shared Records',
                render: (s: any) => (
                  <span className="font-mono text-sm">
                    {s.sharedDocuments?.length || 0} records
                  </span>
                ),
              },
              {
                key: 'actions',
                header: 'Actions',
                align: 'right',
                render: (s: any) => (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveSection('consultations');
                      setConsultSession(s);
                    }}
                    className="btn-primary !px-2.5 !py-1"
                  >
                    Consult & Prescribe
                  </button>
                ),
              },
            ]}
          />

          <DataList
            title="Recent Prescriptions"
            data={historyPrescriptions.slice(0, 5)}
            getRowId={(rx: any) => rx.id}
            emptyMessage="No prescriptions issued yet."
            headerActions={
              <button
                type="button"
                onClick={() => setActiveSection('history')}
                className="btn-secondary"
              >
                Full History
              </button>
            }
            columns={[
              {
                key: 'code',
                header: 'Code',
                render: (rx: any) => (
                  <span className="font-mono text-xs text-ink-2">
                    {rx.documentCode}
                  </span>
                ),
              },
              {
                key: 'patient',
                header: 'Patient',
                render: (rx: any) => (
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
                render: (rx: any) => <span>{rx.title}</span>,
              },
              {
                key: 'date',
                header: 'Issued',
                render: (rx: any) => (
                  <span className="font-mono text-sm text-mut">
                    {new Date(rx.createdAt).toLocaleDateString()}
                  </span>
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
                      onClick={() => setInspectedDoc(rx)}
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
      {/* 2. CONSULTATIONS (STACKED QR QUEUE + SCAN POPUP + PRESCRIBE POPUP)  */}
      {/* =================================================================== */}
      {activeSection === 'consultations' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-ink">Consultations</h1>
              <p className="text-sm text-mut mt-0.5">
                Stacked patient consultation queue ordered with the most recent
                QR scan at the top.
              </p>
            </div>
            <button
              type="button"
              disabled={doctor?.approvalStatus !== 'APPROVED'}
              onClick={() => setScanModalOpen(true)}
              className="btn-primary"
            >
              <QrCode className="w-4 h-4" />
              <span>Scan Patient QR</span>
            </button>
          </div>

          <DataList
            title={`Stacked Active Patient Queue (${qrQueue.length})`}
            data={qrQueue}
            getRowId={(s: any) => s.id}
            emptyMessage="No active patients in queue. Click Scan Patient QR to pair with a patient."
            columns={[
              {
                key: 'patient',
                header: 'Patient',
                render: (s: any) => (
                  <div>
                    <div className="font-semibold text-ink">
                      {s.patient?.name}
                    </div>
                    <div className="font-mono text-xs text-mut">
                      {s.patient?.uniqueId}
                      {s.patient?.bloodGroup
                        ? ` · Blood ${s.patient.bloodGroup}`
                        : ''}
                    </div>
                  </div>
                ),
              },
              {
                key: 'session',
                header: 'Pairing Code',
                render: (s: any) => (
                  <span className="font-mono font-semibold text-brand-700">
                    {s.shortCode}
                  </span>
                ),
              },
              {
                key: 'shared',
                header: 'Shared Records',
                render: (s: any) => (
                  <span className="font-mono text-sm">
                    {s.sharedDocuments?.length || 0} records
                  </span>
                ),
              },
              {
                key: 'expires',
                header: 'Access Expires',
                render: (s: any) => (
                  <span className="font-mono text-xs text-mut">
                    {new Date(s.expiresAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                ),
              },
              {
                key: 'actions',
                header: 'Actions',
                align: 'right',
                render: (s: any) => (
                  <div className="inline-flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => setConsultSession(s)}
                      className="btn-primary !px-2.5 !py-1"
                    >
                      Consult & Prescribe
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDismissFromQueue(s.id)}
                      className="btn-danger !px-2.5 !py-1"
                    >
                      Remove
                    </button>
                  </div>
                ),
              },
            ]}
          />
        </div>
      )}

      {/* =================================================================== */}
      {/* 3. PATIENT HISTORY                                                  */}
      {/* =================================================================== */}
      {activeSection === 'history' && (
        <div className="space-y-5">
          <div>
            <h1 className="text-2xl font-semibold text-ink">Patient History</h1>
            <p className="text-sm text-mut mt-0.5">
              Lifetime archive of permanently locked prescriptions sorted by
              date or hospital chamber.
            </p>
          </div>

          <DataList
            title={`Issued Prescriptions (${historyPrescriptions.length})`}
            data={historyPrescriptions}
            getRowId={(rx: any) => rx.id}
            emptyMessage="No prescriptions match your filter criteria."
            toolbar={
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <input
                  type="search"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="Search patient name, ID, or diagnosis..."
                  className="rounded-md border border-line bg-paper px-3 py-1.5 text-sm text-ink"
                />
                <select
                  value={historyWorkspaceFilter}
                  onChange={(e) => setHistoryWorkspaceFilter(e.target.value)}
                  aria-label="Filter by workspace"
                  className="rounded-md border border-line bg-paper px-3 py-1.5 text-sm text-ink"
                >
                  <option value="ALL">All Chambers & Hospitals</option>
                  {activeWorkspaces.map((aff: any) => (
                    <option key={aff.workspace.id} value={aff.workspace.id}>
                      {aff.workspace.name}
                    </option>
                  ))}
                </select>
                <select
                  value={historySortBy}
                  onChange={(e) => setHistorySortBy(e.target.value)}
                  aria-label="Sort prescriptions"
                  className="rounded-md border border-line bg-paper px-3 py-1.5 text-sm text-ink"
                >
                  <option value="date_desc">Sort: Newest First</option>
                  <option value="date_asc">Sort: Oldest First</option>
                  <option value="workspace">Sort: Hospital Name</option>
                </select>
              </div>
            }
            columns={[
              {
                key: 'code',
                header: 'Prescription Code',
                render: (rx: any) => (
                  <div className="space-y-0.5">
                    <div className="font-mono text-xs font-medium text-ink">
                      {rx.documentCode}
                    </div>
                    <span className="inline-flex items-center gap-1 text-xs text-brand-700">
                      <Lock className="w-3 h-3" /> Locked
                    </span>
                  </div>
                ),
              },
              {
                key: 'patient',
                header: 'Patient',
                render: (rx: any) => (
                  <div>
                    <div className="font-semibold text-ink">
                      {rx.patient?.name}
                    </div>
                    <div className="font-mono text-xs text-mut">
                      {rx.patient?.uniqueId}
                    </div>
                  </div>
                ),
              },
              {
                key: 'diagnosis',
                header: 'Diagnosis',
                render: (rx: any) => (
                  <div>
                    <div className="font-medium text-ink">{rx.title}</div>
                    {rx.summary && (
                      <div className="text-xs text-mut">{rx.summary}</div>
                    )}
                  </div>
                ),
              },
              {
                key: 'facility',
                header: 'Hospital / Chamber',
                render: (rx: any) => (
                  <span>
                    {rx.workspace?.name ||
                      rx.workspaceNameSnapshot ||
                      'Independent Chamber'}
                  </span>
                ),
              },
              {
                key: 'date',
                header: 'Date',
                render: (rx: any) => (
                  <span className="font-mono text-sm text-mut">
                    {new Date(rx.createdAt).toLocaleDateString()}
                  </span>
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
                      onClick={() => setInspectedDoc(rx)}
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
                      <span>PDF</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleVerifyImmutability(rx.id)}
                      className="btn-secondary !px-2.5 !py-1"
                    >
                      Verify Lock
                    </button>
                  </div>
                ),
              },
            ]}
          />
        </div>
      )}

      {/* =================================================================== */}
      {/* 4. AFFILIATIONS                                                     */}
      {/* =================================================================== */}
      {activeSection === 'affiliations' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-ink">Affiliations</h1>
              <p className="text-sm text-mut mt-0.5">
                Manage bidirectional hospital and clinic chamber affiliations.
              </p>
            </div>
            <button
              type="button"
              disabled={availableWorkspaces.length === 0}
              onClick={() => setRequestAffModalOpen(true)}
              className="btn-primary"
            >
              <Plus className="w-4 h-4" />
              <span>Request Affiliation</span>
            </button>
          </div>

          <DataList
            title={`Hospital Connections (${affiliations.length})`}
            data={affiliations}
            getRowId={(a: any) => a.id}
            emptyMessage="No hospital affiliations yet."
            columns={[
              {
                key: 'hospital',
                header: 'Hospital / Facility',
                render: (aff: any) => (
                  <div>
                    <div className="font-semibold text-ink">
                      {aff.workspace?.name}
                    </div>
                    <div className="text-xs text-mut">
                      {aff.workspace?.area} · {aff.workspace?.workspaceCode}
                    </div>
                  </div>
                ),
              },
              {
                key: 'schedule',
                header: 'Chamber Schedule',
                render: (aff: any) => (
                  <div className="text-sm">
                    <div>{aff.schedule || 'Flexible'}</div>
                    {aff.roomNumber && (
                      <div className="text-xs text-mut">{aff.roomNumber}</div>
                    )}
                  </div>
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
                render: (aff: any) => <StatusBadge label={aff.status} />,
              },
              {
                key: 'actions',
                header: 'Actions',
                align: 'right',
                render: (aff: any) => {
                  if (
                    aff.status === 'PENDING' &&
                    aff.initiatedBy === 'WORKSPACE'
                  ) {
                    return (
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            handleRespondAffiliation(aff.id, 'ACTIVE')
                          }
                          className="btn-primary !px-2.5 !py-1"
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleRespondAffiliation(aff.id, 'REJECTED')
                          }
                          className="btn-danger !px-2.5 !py-1"
                        >
                          Decline
                        </button>
                      </div>
                    );
                  }
                  if (aff.status === 'ACTIVE') {
                    return (
                      <button
                        type="button"
                        onClick={() =>
                          handleRespondAffiliation(aff.id, 'REVOKED', true)
                        }
                        className="btn-danger !px-2.5 !py-1"
                      >
                        Revoke
                      </button>
                    );
                  }
                  if (
                    aff.status === 'REVOKED' &&
                    aff.statusUpdatedBy === 'DOCTOR'
                  ) {
                    return (
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            handleRespondAffiliation(aff.id, 'ACTIVE')
                          }
                          className="btn-primary !px-2.5 !py-1"
                        >
                          Undo Revoke
                        </button>
                      </div>
                    );
                  }
                  if (
                    aff.status === 'REVOKED' ||
                    aff.status === 'REJECTED'
                  ) {
                    return (
                      <button
                        type="button"
                        onClick={() =>
                          handleRespondAffiliation(aff.id, 'PENDING')
                        }
                        className="btn-secondary !px-2.5 !py-1"
                      >
                        Re-request Affiliation
                      </button>
                    );
                  }
                  if (
                    aff.status === 'PENDING' &&
                    aff.initiatedBy === 'DOCTOR'
                  ) {
                    return (
                      <div className="inline-flex items-center justify-end gap-2">
                        <span className="text-xs text-mut">
                          Awaiting Hospital
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            handleRespondAffiliation(aff.id, 'REVOKED')
                          }
                          className="btn-danger !px-2.5 !py-1"
                        >
                          Cancel Request
                        </button>
                      </div>
                    );
                  }
                  return <span className="text-xs text-mut">Closed</span>;
                },
              },
            ]}
          />
        </div>
      )}

      {/* =================================================================== */}
      {/* 5. NOTIFICATIONS                                                    */}
      {/* =================================================================== */}
      {activeSection === 'notifications' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-ink">Notifications</h1>
              <p className="text-sm text-mut mt-0.5">
                Hospital affiliation invitations, DGHS status updates, and
                consultation alerts.
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
            title="Notifications & Invitations"
            data={unifiedNotificationRows}
            getRowId={(r: any) => r.rowId}
            emptyMessage="No notifications in this view."
            toolbar={
              <div className="flex flex-wrap items-center gap-2">
                {(['ALL', 'INVITATIONS', 'UNREAD'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setNotifFilter(t)}
                    className={
                      notifFilter === t ? 'btn-primary' : 'btn-secondary'
                    }
                  >
                    {t === 'ALL'
                      ? 'All'
                      : t === 'INVITATIONS'
                        ? 'Invitations'
                        : 'Unread'}
                  </button>
                ))}
              </div>
            }
            columns={[
              {
                key: 'type',
                header: 'Category',
                render: (row: any) => (
                  <StatusBadge
                    label={row.isInvitation ? 'Invitation' : row.category}
                    tone={row.isInvitation ? 'warning' : 'brand'}
                  />
                ),
              },
              {
                key: 'msg',
                header: 'Details',
                render: (row: any) => (
                  <div>
                    <div className="font-semibold text-ink">{row.title}</div>
                    <div className="text-sm text-mut mt-0.5">{row.message}</div>
                  </div>
                ),
              },
              {
                key: 'date',
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
                render: (row: any) =>
                  row.kind === 'AFFILIATION_INVITE' ? (
                    <div className="inline-flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          handleRespondAffiliation(row.affId, 'ACTIVE')
                        }
                        className="btn-primary !px-2.5 !py-1"
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleRespondAffiliation(row.affId, 'REJECTED')
                        }
                        className="btn-danger !px-2.5 !py-1"
                      >
                        Revoke
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-mut">
                      {row.isUnread ? 'Unread' : 'Read'}
                    </span>
                  ),
              },
            ]}
          />
        </div>
      )}

      {/* =================================================================== */}
      {/* 6. PROFILE (CENTERED)                                               */}
      {/* =================================================================== */}
      {activeSection === 'profile' && (
        <div className="mx-auto w-full max-w-3xl space-y-5">
          <div>
            <h1 className="text-2xl font-semibold text-ink">Profile</h1>
            <p className="text-sm text-mut mt-0.5">
              Customize your professional qualifications and control which
              fields are visible to patients.
            </p>
          </div>

          <form
            onSubmit={handleSaveProfile}
            className="bg-paper border border-line rounded-md p-6 space-y-5"
          >
            <div className="flex items-center gap-4 pb-4 border-b border-line">
              {profImage ? (
                <img
                  src={profImage}
                  alt="Doctor"
                  className="w-16 h-16 rounded-md object-cover border border-line"
                />
              ) : (
                <div className="w-16 h-16 rounded-md bg-brand-700 text-white flex items-center justify-center font-semibold text-lg">
                  Dr
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-ink-2 mb-1">
                  Profile Photo
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleDoctorAvatarUpload}
                  className="text-sm text-mut"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-ink-2 mb-1">
                  Clinical Specialty
                </label>
                <input
                  type="text"
                  required
                  value={profSpecialty}
                  onChange={(e) => setProfSpecialty(e.target.value)}
                  className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base text-ink"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-2 mb-1">
                  Degrees (comma-separated)
                </label>
                <input
                  type="text"
                  value={profDegrees}
                  onChange={(e) => setProfDegrees(e.target.value)}
                  placeholder="MBBS, FCPS, MD"
                  className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base text-ink"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-ink-2 mb-1">
                  Primary Area
                </label>
                <input
                  type="text"
                  value={profArea}
                  onChange={(e) => setProfArea(e.target.value)}
                  className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base text-ink"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-2 mb-1">
                  Experience (Years)
                </label>
                <input
                  type="number"
                  value={profExpYears}
                  onChange={(e) => setProfExpYears(e.target.value)}
                  className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base font-mono text-ink"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-2 mb-1">
                  Default Fee (Tk)
                </label>
                <input
                  type="number"
                  value={profDefaultFee}
                  onChange={(e) => setProfDefaultFee(e.target.value)}
                  className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base font-mono text-ink"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-2 mb-1">
                Professional Biography
              </label>
              <textarea
                rows={3}
                value={profBio}
                onChange={(e) => setProfBio(e.target.value)}
                className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base text-ink"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-2 mb-1">
                Achievements & Fellowships (comma-separated)
              </label>
              <input
                type="text"
                value={profAchievements}
                onChange={(e) => setProfAchievements(e.target.value)}
                className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base text-ink"
              />
            </div>

            <fieldset className="border border-line rounded-md p-4 bg-paper-2">
              <legend className="text-xs font-semibold text-mut px-1">
                Public Patient Directory Visibility
              </legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-1 text-sm">
                {[
                  ['showDegrees', 'Show Degrees & Qualifications'],
                  ['showBio', 'Show Biography'],
                  ['showAchievements', 'Show Achievements'],
                  ['showProfilePic', 'Show Profile Photo'],
                  ['showDefaultFee', 'Show Default Fee'],
                  ['showEmail', 'Show Email Address'],
                  ['showPhone', 'Show Phone Number'],
                ].map(([key, label]) => (
                  <label
                    key={key}
                    className="flex items-center gap-2 text-ink-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(profVisibility[key])}
                      onChange={(e) =>
                        setProfVisibility((prev) => ({
                          ...prev,
                          [key]: e.target.checked,
                        }))
                      }
                      className="w-4 h-4 accent-brand-700"
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="pt-2 flex justify-end">
              <button type="submit" className="btn-primary">
                Save Profile
              </button>
            </div>
          </form>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODALS / POPUPS                                                     */}
      {/* =================================================================== */}

      {/* 1. Scan Patient QR Modal */}
      <ModalDialog
        open={scanModalOpen}
        onClose={() => setScanModalOpen(false)}
        title="Scan Patient QR Code"
        subtitle="Enter the patient's 6-character pairing code or upload their QR image."
      >
        <form onSubmit={(e) => handleScanQrCode(e)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink-2 mb-1">
              Consultation Chamber
            </label>
            <select
              value={scanWorkspaceId}
              onChange={(e) => setScanWorkspaceId(e.target.value)}
              className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base text-ink"
            >
              <option value="">Independent Chamber</option>
              {activeWorkspaces.map((aff: any) => (
                <option key={aff.workspace.id} value={aff.workspace.id}>
                  {aff.workspace.name} ({aff.workspace.area})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-2 mb-1">
              6-Character Pairing Code
            </label>
            <input
              type="text"
              value={qrInput}
              onChange={(e) => setQrInput(e.target.value)}
              placeholder="QR-DEMO99"
              className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base font-mono text-ink"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <label className="btn-secondary cursor-pointer">
              <Upload className="w-4 h-4" />
              <span>Upload QR Image</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleQrImageUpload}
                className="visually-hidden"
              />
            </label>

            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-mut">Demo:</span>
              <button
                type="button"
                onClick={() => handleScanQrCode(undefined, 'QR-DEMO99')}
                className="btn-secondary !px-2 !py-1 font-mono"
              >
                QR-DEMO99
              </button>
              <button
                type="button"
                onClick={() => handleScanQrCode(undefined, 'QR-AYAAN1')}
                className="btn-secondary !px-2 !py-1 font-mono"
              >
                QR-AYAAN1
              </button>
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setScanModalOpen(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Pair & Add to Queue
            </button>
          </div>
        </form>
      </ModalDialog>

      {/* 2. Consultation & Write Immutable Prescription Modal */}
      <ModalDialog
        open={Boolean(consultSession)}
        onClose={() => setConsultSession(null)}
        title={
          consultSession
            ? `Consultation — ${consultSession.patient?.name} (${consultSession.patient?.uniqueId})`
            : 'Patient Consultation'
        }
        subtitle={
          consultSession
            ? `Active QR Session ${consultSession.shortCode} · Issued prescriptions are permanently locked upon submission.`
            : undefined
        }
        maxWidthClass="max-w-3xl"
      >
        {consultSession && (
          <div className="space-y-6">
            <DataList
              title={`Shared Patient Records (${consultSession.sharedDocuments?.length || 0})`}
              data={consultSession.sharedDocuments || []}
              getRowId={(d: any) => d.id}
              emptyMessage="No prior records were attached to this QR share."
              columns={[
                {
                  key: 'type',
                  header: 'Type',
                  render: (d: any) => <StatusBadge label={d.type} />,
                },
                {
                  key: 'title',
                  header: 'Title',
                  render: (d: any) => (
                    <span className="font-medium text-ink">{d.title}</span>
                  ),
                },
                {
                  key: 'date',
                  header: 'Date',
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
                        onClick={() => setInspectedDoc(d)}
                        className="btn-secondary !px-2 !py-1"
                      >
                        View
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          downloadClinicalDocumentPdf(
                            d,
                            consultSession.patient
                          )
                        }
                        className="btn-secondary !px-2 !py-1"
                      >
                        PDF
                      </button>
                    </div>
                  ),
                },
              ]}
            />

            <form
              onSubmit={handleIssuePrescription}
              className="border border-line rounded-md p-4 bg-paper-2 space-y-4"
            >
              <h3 className="text-base font-semibold text-ink">
                Issue Immutable Prescription
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-ink-2 mb-1">
                    Primary Diagnosis
                  </label>
                  <input
                    type="text"
                    required
                    value={rxDiagnosis}
                    onChange={(e) => setRxDiagnosis(e.target.value)}
                    placeholder="Essential Hypertension & Dyslipidemia"
                    className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base text-ink"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink-2 mb-1">
                    Chief Complaints
                  </label>
                  <input
                    type="text"
                    value={rxComplaints}
                    onChange={(e) => setRxComplaints(e.target.value)}
                    placeholder="Exertional chest tightness, fatigue"
                    className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base text-ink"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div>
                  <label className="block text-xs font-medium text-mut mb-1">
                    Blood Pressure
                  </label>
                  <input
                    type="text"
                    value={rxBp}
                    onChange={(e) => setRxBp(e.target.value)}
                    className="w-full rounded-md border border-line bg-paper px-2.5 py-1.5 text-sm font-mono text-ink"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-mut mb-1">
                    Pulse
                  </label>
                  <input
                    type="text"
                    value={rxPulse}
                    onChange={(e) => setRxPulse(e.target.value)}
                    className="w-full rounded-md border border-line bg-paper px-2.5 py-1.5 text-sm font-mono text-ink"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-mut mb-1">
                    Temperature
                  </label>
                  <input
                    type="text"
                    value={rxTemp}
                    onChange={(e) => setRxTemp(e.target.value)}
                    className="w-full rounded-md border border-line bg-paper px-2.5 py-1.5 text-sm font-mono text-ink"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-mut mb-1">
                    Weight
                  </label>
                  <input
                    type="text"
                    value={rxWeight}
                    onChange={(e) => setRxWeight(e.target.value)}
                    className="w-full rounded-md border border-line bg-paper px-2.5 py-1.5 text-sm font-mono text-ink"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-ink-2">
                    Medications
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setRxMedications((prev) => [
                        ...prev,
                        {
                          name: '',
                          dosage: '1 + 0 + 1',
                          duration: '7 Days',
                          instruction: 'After meal',
                        },
                      ])
                    }
                    className="btn-secondary !px-2.5 !py-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Medication</span>
                  </button>
                </div>

                {rxMedications.map((med, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center"
                  >
                    <input
                      type="text"
                      required
                      value={med.name}
                      onChange={(e) =>
                        setRxMedications((prev) =>
                          prev.map((m, i) =>
                            i === idx ? { ...m, name: e.target.value } : m
                          )
                        )
                      }
                      placeholder="Medication name"
                      className="sm:col-span-4 rounded-md border border-line bg-paper px-2.5 py-1.5 text-sm text-ink"
                    />
                    <input
                      type="text"
                      value={med.dosage}
                      onChange={(e) =>
                        setRxMedications((prev) =>
                          prev.map((m, i) =>
                            i === idx ? { ...m, dosage: e.target.value } : m
                          )
                        )
                      }
                      placeholder="1+0+1"
                      className="sm:col-span-2 rounded-md border border-line bg-paper px-2.5 py-1.5 text-sm font-mono text-ink"
                    />
                    <input
                      type="text"
                      value={med.duration}
                      onChange={(e) =>
                        setRxMedications((prev) =>
                          prev.map((m, i) =>
                            i === idx ? { ...m, duration: e.target.value } : m
                          )
                        )
                      }
                      placeholder="14 Days"
                      className="sm:col-span-2 rounded-md border border-line bg-paper px-2.5 py-1.5 text-sm text-ink"
                    />
                    <input
                      type="text"
                      value={med.instruction}
                      onChange={(e) =>
                        setRxMedications((prev) =>
                          prev.map((m, i) =>
                            i === idx
                              ? { ...m, instruction: e.target.value }
                              : m
                          )
                        )
                      }
                      placeholder="Instruction"
                      className="sm:col-span-3 rounded-md border border-line bg-paper px-2.5 py-1.5 text-sm text-ink"
                    />
                    <button
                      type="button"
                      disabled={rxMedications.length <= 1}
                      aria-label="Remove medication row"
                      onClick={() =>
                        setRxMedications((prev) =>
                          prev.filter((_, i) => i !== idx)
                        )
                      }
                      className="sm:col-span-1 btn-danger !p-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-ink-2 mb-1">
                    Recommended Investigations
                  </label>
                  <input
                    type="text"
                    value={rxTests}
                    onChange={(e) => setRxTests(e.target.value)}
                    className="w-full rounded-md border border-line bg-paper px-3 py-1.5 text-sm text-ink"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink-2 mb-1">
                    Follow-Up Date
                  </label>
                  <input
                    type="date"
                    value={rxFollowUp}
                    onChange={(e) => setRxFollowUp(e.target.value)}
                    className="w-full rounded-md border border-line bg-paper px-3 py-1.5 text-sm font-mono text-ink"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-2 mb-1">
                  Clinical Advice
                </label>
                <textarea
                  rows={2}
                  value={rxAdvice}
                  onChange={(e) => setRxAdvice(e.target.value)}
                  className="w-full rounded-md border border-line bg-paper px-3 py-1.5 text-sm text-ink"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setConsultSession(null)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  <Lock className="w-4 h-4" />
                  <span>Send & Lock Prescription</span>
                </button>
              </div>
            </form>
          </div>
        )}
      </ModalDialog>

      {/* 3. Request Hospital Affiliation Modal */}
      <ModalDialog
        open={requestAffModalOpen}
        onClose={() => setRequestAffModalOpen(false)}
        title="Request Hospital Affiliation"
        subtitle="Send an affiliation request to a registered hospital or clinic."
      >
        <form onSubmit={handleRequestAffiliation} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink-2 mb-1">
              Select Facility
            </label>
            <select
              required
              value={reqWorkspaceId}
              onChange={(e) => setReqWorkspaceId(e.target.value)}
              className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base text-ink"
            >
              {availableWorkspaces.map((ws: any) => (
                <option key={ws.id} value={ws.id}>
                  {ws.name} ({ws.area})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-ink-2 mb-1">
                Proposed Consultation Fee (Tk)
              </label>
              <input
                type="number"
                required
                value={reqFee}
                onChange={(e) => setReqFee(e.target.value)}
                className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base font-mono text-ink"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-2 mb-1">
                Department
              </label>
              <input
                type="text"
                value={reqDepartment}
                onChange={(e) => setReqDepartment(e.target.value)}
                placeholder={profSpecialty || 'Cardiology'}
                className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base text-ink"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-2 mb-1">
              Proposed Schedule
            </label>
            <input
              type="text"
              required
              value={reqSchedule}
              onChange={(e) => setReqSchedule(e.target.value)}
              className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base text-ink"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setRequestAffModalOpen(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Submit Request
            </button>
          </div>
        </form>
      </ModalDialog>

      {/* 4. Shared Document Viewer Modal */}
      <DocumentViewerModal
        doc={inspectedDoc}
        onClose={() => setInspectedDoc(null)}
        fallbackPatient={consultSession?.patient}
      />
    </div>
  );
};
