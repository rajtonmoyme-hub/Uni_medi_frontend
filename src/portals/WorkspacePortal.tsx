import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus,
  Trash2,
  Download,
  Eye,
  CheckCheck,
  Building2,
  AlertTriangle,
} from 'lucide-react';
import { apiRequest } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { DataList } from '../components/DataList';
import { ModalDialog } from '../components/ModalDialog';
import { DocumentViewerModal } from '../components/DocumentViewerModal';
import { StatusBadge } from '../components/StatusBadge';
import { TransientToast } from '../components/TransientToast';
import { downloadClinicalDocumentPdf } from '../utils/pdfDownload';

const PRESET_TIME_SLOTS = [
  '09:00 AM',
  '10:00 AM',
  '11:00 AM',
  '12:00 PM',
  '02:00 PM',
  '03:00 PM',
  '04:00 PM',
  '05:00 PM',
  '06:00 PM',
  '07:00 PM',
  '08:00 PM',
  '09:00 PM',
];

export const WorkspacePortal: React.FC = () => {
  const {
    user,
    activeWorkspaceId,
    setActiveWorkspaceId,
    activeSection,
    workspaceRolePerspective,
    setWorkspaceRolePerspective,
    refreshUserContext,
    refreshUnreadCount,
  } = useAuth();

  const currentWsSummary =
    user?.workspaces?.find((w) => w.workspaceId === activeWorkspaceId) ||
    user?.workspaces?.[0] ||
    null;

  const workspaceId = currentWsSummary?.workspaceId || null;

  const [wsContextData, setWsContextData] = useState<any>(null);
  const [bannerMsg, setBannerMsg] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Module Data
  const [appointments, setAppointments] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [doctorsData, setDoctorsData] = useState<{
    affiliations: any[];
    directoryDoctors: any[];
  }>({ affiliations: [], directoryDoctors: [] });
  const [packages, setPackages] = useState<any[]>([]);
  const [rolesList, setRolesList] = useState<any[]>([]);
  const [permissionCatalog, setPermissionCatalog] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [auditData, setAuditData] = useState<{
    logs: any[];
    staffPerformanceSummary: any[];
  }>({ logs: [], staffPerformanceSummary: [] });
  const [auditFilterMember, setAuditFilterMember] = useState<string>('');
  const [auditFilterCategory, setAuditFilterCategory] = useState<string>('ALL');
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notifFilter, setNotifFilter] = useState<
    'ALL' | 'INVITATIONS' | 'UNREAD'
  >('ALL');

  // Popup Modals State
  const [inspectedDoc, setInspectedDoc] = useState<any | null>(null);
  const [uploadReportOpen, setUploadReportOpen] = useState<boolean>(false);
  const [createInvoiceOpen, setCreateInvoiceOpen] = useState<boolean>(false);
  const [inviteDoctorOpen, setInviteDoctorOpen] = useState<boolean>(false);
  const [newPackageOpen, setNewPackageOpen] = useState<boolean>(false);
  const [inviteStaffOpen, setInviteStaffOpen] = useState<boolean>(false);
  const [transferOwnerOpen, setTransferOwnerOpen] = useState<boolean>(false);
  const [createRoleOpen, setCreateRoleOpen] = useState<boolean>(false);

  // Lab Report Upload Form
  const [repPatientId, setRepPatientId] = useState<string>('patient@demo.bd');
  const [repTitle, setRepTitle] = useState<string>(
    'Complete Blood Count (CBC) & Lipid Panel'
  );
  const [repCategory, setRepCategory] = useState<string>(
    'Pathology & Biochemistry'
  );
  const [repConclusion, setRepConclusion] = useState<string>(
    'Hemoglobin and leukocyte counts within normal reference limits.'
  );
  const [repParams, setRepParams] = useState<
    { name: string; result: string; referenceRange: string; flag: string }[]
  >([
    {
      name: 'Hemoglobin (Hb)',
      result: '14.6 g/dL',
      referenceRange: '13.0 - 17.0 g/dL',
      flag: 'NORMAL',
    },
    {
      name: 'Total Cholesterol',
      result: '192 mg/dL',
      referenceRange: '< 200 mg/dL',
      flag: 'NORMAL',
    },
  ]);

  // Billing Invoice Form
  const [billPatientId, setBillPatientId] = useState<string>('patient@demo.bd');
  const [billTitle, setBillTitle] = useState<string>(
    'Outpatient Consultation & Diagnostic Services'
  );
  const [billItems, setBillItems] = useState<
    { description: string; qty: number; amount: number }[]
  >([
    { description: 'Specialist Consultation', qty: 1, amount: 1500 },
    { description: 'Digital ECG & Lipid Panel', qty: 1, amount: 1800 },
  ]);
  const [billDiscount, setBillDiscount] = useState<string>('300');
  const [billStatus, setBillStatus] = useState<string>('PAID');
  const [billMethod, setBillMethod] = useState<string>('Card / bKash / Cash');

  // Invite Doctor Form
  const [invDocIdentifier, setInvDocIdentifier] =
    useState<string>('dr.nusrat@demo.bd');
  const [invDocFee, setInvDocFee] = useState<string>('1400');
  const [invDocSchedule, setInvDocSchedule] = useState<string>(
    'Sun, Tue, Thu: 4:00 PM - 8:00 PM'
  );
  const [invDocRoom, setInvDocRoom] = useState<string>('Room 405, Wing B');
  const [invDocSlots, setInvDocSlots] = useState<string[]>([
    '04:00 PM',
    '05:00 PM',
    '06:00 PM',
    '07:00 PM',
  ]);

  // Configure Doctor Schedule & Available Time Slots Modal
  const [editingWsAff, setEditingWsAff] = useState<any | null>(null);
  const [editWsAffFee, setEditWsAffFee] = useState<string>('1200');
  const [editWsAffSchedule, setEditWsAffSchedule] = useState<string>('');
  const [editWsAffRoom, setEditWsAffRoom] = useState<string>('');
  const [editWsAffSlots, setEditWsAffSlots] = useState<string[]>([]);

  // Create Health Package Form
  const [pkgTitle, setPkgTitle] = useState<string>('');
  const [pkgTagline, setPkgTagline] = useState<string>('');
  const [pkgPrice, setPkgPrice] = useState<string>('10000');
  const [pkgOriginalPrice, setPkgOriginalPrice] = useState<string>('14500');
  const [pkgTests, setPkgTests] = useState<string>(
    'CBC with ESR, Fasting Blood Sugar, HbA1c, Lipid Profile, Liver Function Test, Serum Creatinine, 12-Lead ECG, Chest X-Ray'
  );
  const [pkgDuration, setPkgDuration] = useState<string>(
    'Same Day Delivery (6 Hours)'
  );

  // Create Dynamic Role Form
  const [newRoleName, setNewRoleName] = useState<string>('');
  const [newRoleDesc, setNewRoleDesc] = useState<string>('');
  const [newRolePerms, setNewRolePerms] = useState<string[]>([
    'patients.lookup',
    'appointments.view',
  ]);

  // Invite Staff Form
  const [invStaffPatientId, setInvStaffPatientId] =
    useState<string>('patient@demo.bd');
  const [invStaffTitle, setInvStaffTitle] = useState<string>(
    'Front Desk & Patient Coordinator'
  );
  const [invStaffDept, setInvStaffDept] = useState<string>('Outpatient Desk');
  const [invStaffRoleIds, setInvStaffRoleIds] = useState<string[]>([]);
  const [invAutoAccept, setInvAutoAccept] = useState<boolean>(false);

  // Transfer Ownership Form
  const [transferTargetMemberId, setTransferTargetMemberId] =
    useState<string>('');
  const [transferPassword, setTransferPassword] = useState<string>('');

  // Profile State
  const [myStaffTitle, setMyStaffTitle] = useState<string>('');
  const [myStaffDept, setMyStaffDept] = useState<string>('');
  const [myStaffName, setMyStaffName] = useState<string>('');
  const [myStaffPhone, setMyStaffPhone] = useState<string>('');

  const [wsName, setWsName] = useState<string>('');
  const [wsArea, setWsArea] = useState<string>('');
  const [wsAddress, setWsAddress] = useState<string>('');
  const [wsPhone, setWsPhone] = useState<string>('');
  const [wsHours, setWsHours] = useState<string>('');
  const [wsDepts, setWsDepts] = useState<string>('');

  const notify = (type: 'success' | 'error', text: string) => {
    setBannerMsg({ type, text });
  };

  useEffect(() => {
    if (!activeWorkspaceId && user?.workspaces && user.workspaces.length > 0) {
      setActiveWorkspaceId(user.workspaces[0].workspaceId);
    }
  }, [activeWorkspaceId, user?.workspaces, setActiveWorkspaceId]);

  const loadWorkspaceContext = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const [res, notifRes] = await Promise.all([
        apiRequest<any>(`/workspaces/${workspaceId}/context`),
        apiRequest<any>(
          `/notifications?persona=WORKSPACE&workspaceId=${workspaceId}`
        ),
      ]);
      setWsContextData(res);
      setRolesList(res.roles || []);
      setPermissionCatalog(res.permissionCatalog || []);
      setNotifications(notifRes.notifications || []);

      if (res.myMembership) {
        setMyStaffTitle(res.myMembership.staffTitle || '');
        setMyStaffDept(res.myMembership.department || '');
        setMyStaffName(res.myMembership.patientUser?.name || '');
        setMyStaffPhone(res.myMembership.patientUser?.phone || '');
      }
      if (res.workspace) {
        setWsName(res.workspace.name || '');
        setWsArea(res.workspace.area || '');
        setWsAddress(res.workspace.address || '');
        setWsPhone(res.workspace.phone || '');
        setWsHours(res.workspace.operatingHours || '');
        setWsDepts((res.workspace.departments || []).join(', '));
      }
    } catch (err: any) {
      notify('error', err.message || 'Failed to load workspace context.');
    }
  }, [workspaceId]);

  useEffect(() => {
    loadWorkspaceContext();
  }, [loadWorkspaceContext]);

  const assignedRoles = useMemo(() => {
    return (
      wsContextData?.myMembership?.assignedRoles?.map((ar: any) => ar.role) ||
      currentWsSummary?.roles ||
      []
    );
  }, [wsContextData?.myMembership?.assignedRoles, currentWsSummary?.roles]);

  const combinedPermissions: string[] = useMemo(() => {
    return (
      wsContextData?.workspaceContext?.permissions ||
      currentWsSummary?.combinedPermissions ||
      []
    );
  }, [
    wsContextData?.workspaceContext?.permissions,
    currentWsSummary?.combinedPermissions,
  ]);

  const isOwner = Boolean(
    wsContextData?.workspaceContext?.isOwner ?? currentWsSummary?.isOwner
  );

  const activePermissions: string[] = useMemo(() => {
    if (workspaceRolePerspective === 'COMBINED') {
      return combinedPermissions;
    }
    const chosenRole = assignedRoles.find(
      (r: any) => r.id === workspaceRolePerspective
    );
    return chosenRole ? chosenRole.permissions || [] : combinedPermissions;
  }, [workspaceRolePerspective, combinedPermissions, assignedRoles]);

  const hasPerm = useCallback(
    (perm: string) => activePermissions.includes(perm),
    [activePermissions]
  );

  const loadSectionData = useCallback(async () => {
    if (!workspaceId) return;
    try {
      if (activeSection === 'appointments' && hasPerm('appointments.view')) {
        const res = await apiRequest<{ appointments: any[] }>(
          `/workspaces/${workspaceId}/appointments`
        );
        setAppointments(res.appointments || []);
      } else if (activeSection === 'laboratory' && hasPerm('reports.view')) {
        const res = await apiRequest<{ reports: any[] }>(
          `/workspaces/${workspaceId}/reports`
        );
        setReports(res.reports || []);
      } else if (activeSection === 'billing' && hasPerm('billing.view')) {
        const res = await apiRequest<{ invoices: any[] }>(
          `/workspaces/${workspaceId}/billing`
        );
        setInvoices(res.invoices || []);
      } else if (
        (activeSection === 'doctors' || activeSection === 'notifications') &&
        hasPerm('doctors.view')
      ) {
        const res = await apiRequest<{
          affiliations: any[];
          directoryDoctors: any[];
        }>(`/workspaces/${workspaceId}/doctors`);
        setDoctorsData({
          affiliations: res.affiliations || [],
          directoryDoctors: res.directoryDoctors || [],
        });
      } else if (activeSection === 'packages' && hasPerm('packages.view')) {
        const res = await apiRequest<{ packages: any[] }>(
          `/workspaces/${workspaceId}/packages`
        );
        setPackages(res.packages || []);
      } else if (activeSection === 'roles' && hasPerm('roles.manage')) {
        const res = await apiRequest<{
          roles: any[];
          permissionCatalog: any[];
        }>(`/workspaces/${workspaceId}/roles`);
        setRolesList(res.roles || []);
        setPermissionCatalog(res.permissionCatalog || []);
      } else if (activeSection === 'staff' && hasPerm('staff.view')) {
        const [staffRes, rolesRes] = await Promise.all([
          apiRequest<{ staff: any[] }>(`/workspaces/${workspaceId}/staff`),
          apiRequest<{ roles: any[] }>(`/workspaces/${workspaceId}/roles`),
        ]);
        setStaffList(staffRes.staff || []);
        setRolesList(rolesRes.roles || []);
      } else if (
        activeSection === 'audit_logs' &&
        hasPerm('staff.logs.view')
      ) {
        const params = new URLSearchParams();
        if (auditFilterMember) params.set('actorMemberId', auditFilterMember);
        if (auditFilterCategory !== 'ALL')
          params.set('category', auditFilterCategory);
        const res = await apiRequest<{
          logs: any[];
          staffPerformanceSummary: any[];
        }>(`/workspaces/${workspaceId}/audit-logs?${params.toString()}`);
        setAuditData({
          logs: res.logs || [],
          staffPerformanceSummary: res.staffPerformanceSummary || [],
        });
      }
    } catch (err: any) {
      notify('error', err.message);
    }
  }, [
    workspaceId,
    activeSection,
    hasPerm,
    auditFilterMember,
    auditFilterCategory,
  ]);

  useEffect(() => {
    loadSectionData();
  }, [loadSectionData]);

  // Action Handlers
  const handleUpdateAppointment = async (
    appointmentId: string,
    status: string,
    serialNumber?: number
  ) => {
    if (!workspaceId) return;
    try {
      const res = await apiRequest<{ message: string }>(
        `/workspaces/${workspaceId}/appointments/${appointmentId}`,
        {
          method: 'PATCH',
          body: { status, serialNumber },
        }
      );
      notify('success', res.message);
      await Promise.all([loadSectionData(), loadWorkspaceContext()]);
    } catch (err: any) {
      notify('error', err.message);
    }
  };

  const handleUploadReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId) return;
    try {
      const res = await apiRequest<{ message: string }>(
        `/workspaces/${workspaceId}/reports`,
        {
          method: 'POST',
          body: {
            patientIdentifier: repPatientId,
            title: repTitle,
            testCategory: repCategory,
            parameters: repParams,
            conclusion: repConclusion,
            verified: true,
          },
        }
      );
      notify('success', res.message);
      setUploadReportOpen(false);
      await Promise.all([loadSectionData(), loadWorkspaceContext()]);
    } catch (err: any) {
      notify('error', err.message);
    }
  };

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId) return;
    try {
      const res = await apiRequest<{ message: string }>(
        `/workspaces/${workspaceId}/billing`,
        {
          method: 'POST',
          body: {
            patientIdentifier: billPatientId,
            title: billTitle,
            items: billItems,
            discount: Number(billDiscount) || 0,
            paymentStatus: billStatus,
            paymentMethod: billMethod,
          },
        }
      );
      notify('success', res.message);
      setCreateInvoiceOpen(false);
      await Promise.all([loadSectionData(), loadWorkspaceContext()]);
    } catch (err: any) {
      notify('error', err.message);
    }
  };

  const handleInviteDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId) return;
    try {
      const res = await apiRequest<{ message: string; auditLog?: any }>(
        `/workspaces/${workspaceId}/doctors/invite`,
        {
          method: 'POST',
          body: {
            doctorIdentifier: invDocIdentifier,
            consultationFee: Number(invDocFee) || 1000,
            schedule: invDocSchedule,
            availableSlots: invDocSlots,
            roomNumber: invDocRoom,
          },
        }
      );
      const logSuffix = res.auditLog?.action
        ? ` [${res.auditLog.action}]`
        : '';
      notify('success', `${res.message}${logSuffix}`);
      setInviteDoctorOpen(false);
      await Promise.all([loadSectionData(), loadWorkspaceContext()]);
    } catch (err: any) {
      notify('error', err.message);
    }
  };

  const handleUpdateDoctorAffiliation = async (
    affiliationId: string,
    status: string
  ) => {
    if (!workspaceId) return;
    try {
      const res = await apiRequest<{ message: string; auditLog?: any }>(
        `/workspaces/${workspaceId}/doctors/${affiliationId}`,
        {
          method: 'PATCH',
          body: { status },
        }
      );
      const logSuffix = res.auditLog?.action
        ? ` [${res.auditLog.action}]`
        : '';
      notify('success', `${res.message}${logSuffix}`);
      await Promise.all([
        loadSectionData(),
        loadWorkspaceContext(),
        refreshUnreadCount(),
      ]);
    } catch (err: any) {
      notify('error', err.message);
    }
  };

  const openEditWsAffModal = (aff: any) => {
    setEditingWsAff(aff);
    setEditWsAffFee(String(aff.consultationFee || 1000));
    setEditWsAffSchedule(
      aff.scheduleLabel || aff.schedule || 'Sun, Tue, Thu: 5:00 PM - 9:00 PM'
    );
    setEditWsAffRoom(aff.roomNumber || '');
    setEditWsAffSlots(
      Array.isArray(aff.availableSlots) && aff.availableSlots.length > 0
        ? aff.availableSlots
        : ['05:00 PM', '06:00 PM', '07:00 PM', '08:00 PM']
    );
  };

  const handleSaveWsAffSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId || !editingWsAff) return;
    if (editWsAffSlots.length === 0) {
      notify('error', 'Select at least one available consultation time slot.');
      return;
    }
    try {
      const res = await apiRequest<{ message: string; auditLog?: any }>(
        `/workspaces/${workspaceId}/doctors/${editingWsAff.id}`,
        {
          method: 'PATCH',
          body: {
            consultationFee: Number(editWsAffFee) || 1000,
            schedule: editWsAffSchedule,
            availableSlots: editWsAffSlots,
            roomNumber: editWsAffRoom || null,
          },
        }
      );
      notify(
        'success',
        `${res.message} [${res.auditLog?.action || 'DOCTOR_SCHEDULE_UPDATED'}]`
      );
      setEditingWsAff(null);
      await Promise.all([loadSectionData(), loadWorkspaceContext()]);
    } catch (err: any) {
      notify('error', err.message || 'Failed to update doctor schedule.');
    }
  };

  const handleCreatePackage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId) return;
    try {
      const res = await apiRequest<{ message: string }>(
        `/workspaces/${workspaceId}/packages`,
        {
          method: 'POST',
          body: {
            title: pkgTitle,
            tagline:
              pkgTagline ||
              `Comprehensive Health Checkup — ${Number(pkgPrice).toLocaleString()} Tk`,
            price: Number(pkgPrice) || 10000,
            originalPrice: Number(pkgOriginalPrice) || null,
            includedTests: pkgTests
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean),
            durationLabel: pkgDuration,
            isFeatured: true,
          },
        }
      );
      notify('success', res.message);
      setPkgTitle('');
      setPkgTagline('');
      setNewPackageOpen(false);
      await Promise.all([loadSectionData(), loadWorkspaceContext()]);
    } catch (err: any) {
      notify('error', err.message);
    }
  };

  const handleTogglePackageActive = async (pkg: any) => {
    if (!workspaceId) return;
    try {
      await apiRequest(`/workspaces/${workspaceId}/packages/${pkg.id}`, {
        method: 'PATCH',
        body: { isActive: !pkg.isActive },
      });
      await loadSectionData();
    } catch (err: any) {
      notify('error', err.message);
    }
  };

  const handleCreateDynamicRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId) return;
    try {
      const res = await apiRequest<{ message: string }>(
        `/workspaces/${workspaceId}/roles`,
        {
          method: 'POST',
          body: {
            name: newRoleName,
            description: newRoleDesc,
            permissions: newRolePerms,
          },
        }
      );
      notify('success', res.message);
      setNewRoleName('');
      setNewRoleDesc('');
      setCreateRoleOpen(false);
      await Promise.all([loadSectionData(), loadWorkspaceContext()]);
    } catch (err: any) {
      notify('error', err.message);
    }
  };

  const handleDeleteDynamicRole = async (roleId: string) => {
    if (!workspaceId) return;
    try {
      const res = await apiRequest<{ message: string }>(
        `/workspaces/${workspaceId}/roles/${roleId}`,
        { method: 'DELETE' }
      );
      notify('success', res.message);
      await loadSectionData();
    } catch (err: any) {
      notify('error', err.message);
    }
  };

  const handleInviteStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId) return;
    try {
      const res = await apiRequest<{ message: string; auditLog?: any }>(
        `/workspaces/${workspaceId}/staff/invite`,
        {
          method: 'POST',
          body: {
            patientIdentifier: invStaffPatientId,
            roleIds: invStaffRoleIds,
            staffTitle: invStaffTitle,
            department: invStaffDept,
            autoAcceptForDemo: invAutoAccept,
          },
        }
      );
      const logSuffix = res.auditLog?.action
        ? ` [${res.auditLog.action}]`
        : '';
      notify('success', `${res.message}${logSuffix}`);
      setInviteStaffOpen(false);
      await Promise.all([loadSectionData(), loadWorkspaceContext()]);
    } catch (err: any) {
      notify('error', err.message);
    }
  };

  const handleRemoveStaff = async (memberId: string) => {
    if (!workspaceId) return;
    try {
      const res = await apiRequest<{ message: string }>(
        `/workspaces/${workspaceId}/staff/${memberId}`,
        { method: 'DELETE' }
      );
      notify('success', res.message);
      await Promise.all([loadSectionData(), loadWorkspaceContext()]);
    } catch (err: any) {
      notify('error', err.message);
    }
  };

  const handleTransferOwnership = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId) return;
    try {
      const res = await apiRequest<{ message: string }>(
        `/workspaces/${workspaceId}/transfer-ownership`,
        {
          method: 'POST',
          body: {
            targetMemberId: transferTargetMemberId,
            password: transferPassword,
          },
        }
      );
      notify('success', res.message);
      setTransferOwnerOpen(false);
      setTransferPassword('');
      await Promise.all([
        loadWorkspaceContext(),
        loadSectionData(),
        refreshUserContext(),
      ]);
    } catch (err: any) {
      notify('error', err.message);
    }
  };

  const handleMarkAllRead = async () => {
    if (!workspaceId) return;
    try {
      await apiRequest('/notifications/read-all', {
        method: 'POST',
        body: { workspaceId },
      });
      await Promise.all([loadWorkspaceContext(), refreshUnreadCount()]);
    } catch (err: any) {
      notify('error', err.message);
    }
  };

  const handleSaveMyStaffProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId) return;
    try {
      const res = await apiRequest<{ message: string }>(
        `/workspaces/${workspaceId}/my-staff-profile`,
        {
          method: 'PATCH',
          body: {
            staffTitle: myStaffTitle,
            department: myStaffDept,
            name: myStaffName,
            phone: myStaffPhone,
          },
        }
      );
      notify('success', res.message);
      await Promise.all([loadWorkspaceContext(), refreshUserContext()]);
    } catch (err: any) {
      notify('error', err.message);
    }
  };

  const handleSaveWorkspaceSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId) return;
    try {
      const res = await apiRequest<{ message: string }>(
        `/workspaces/${workspaceId}/profile`,
        {
          method: 'PATCH',
          body: {
            name: wsName,
            area: wsArea,
            address: wsAddress,
            phone: wsPhone,
            operatingHours: wsHours,
            departments: wsDepts
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean),
          },
        }
      );
      notify('success', res.message);
      await Promise.all([loadWorkspaceContext(), refreshUserContext()]);
    } catch (err: any) {
      notify('error', err.message);
    }
  };

  const permissionsByDomain = useMemo(() => {
    return permissionCatalog.reduce((acc: Record<string, any[]>, item: any) => {
      acc[item.domain] = acc[item.domain] || [];
      acc[item.domain].push(item);
      return acc;
    }, {});
  }, [permissionCatalog]);

  const unifiedNotificationRows = useMemo(() => {
    const rows: any[] = [];

    if (hasPerm('doctors.invite')) {
      for (const aff of doctorsData.affiliations) {
        if (aff.status === 'PENDING' && aff.initiatedBy === 'DOCTOR') {
          rows.push({
            rowId: `doc-req-${aff.id}`,
            kind: 'DOCTOR_REQUEST',
            affId: aff.id,
            isInvitation: true,
            isUnread: true,
            category: 'Doctor Request',
            title: `${aff.doctor?.patientUser?.name || 'Doctor'} — Affiliation Request`,
            message: `${aff.doctor?.specialty} · Proposed Fee: ${Number(aff.consultationFee).toLocaleString()} Tk · ${aff.schedule}`,
            createdAt: aff.createdAt,
          });
        }
      }
    }

    for (const n of notifications) {
      rows.push({
        rowId: `notif-${n.id}`,
        notifId: n.id,
        kind: 'NOTIFICATION',
        isInvitation: n.type === 'DOCTOR_AFFILIATION',
        isUnread: !n.isRead,
        category: n.requiredPermission || n.type || 'Update',
        title: n.title,
        message: n.message,
        createdAt: n.createdAt,
      });
    }

    if (notifFilter === 'INVITATIONS')
      return rows.filter((r) => r.isInvitation);
    if (notifFilter === 'UNREAD') return rows.filter((r) => r.isUnread);
    return rows;
  }, [doctorsData.affiliations, notifications, notifFilter, hasPerm]);

  if (!workspaceId) {
    return (
      <div className="bg-paper border border-line rounded-md p-8 text-center space-y-2">
        <Building2 className="w-8 h-8 text-brand-700 mx-auto" />
        <h2 className="text-lg font-semibold text-ink">
          No Active Workspace Membership
        </h2>
        <p className="text-sm text-mut">
          Switch to your Patient account and open Notifications to review
          pending hospital staff invitations.
        </p>
      </div>
    );
  }

  const ws = wsContextData?.workspace;
  const metrics = wsContextData?.metrics || {};

  return (
    <div className="space-y-6">
      {/* Facility Context Bar + Role Perspective Switcher */}
      <div className="bg-paper border border-line rounded-md p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-base text-ink">
              {ws?.name || currentWsSummary?.workspaceName}
            </span>
            <span className="font-mono text-xs text-mut">
              {ws?.workspaceCode || currentWsSummary?.workspaceCode}
            </span>
            {ws?.approvalStatus && <StatusBadge label={ws.approvalStatus} />}
          </div>
          <p className="text-xs text-mut mt-0.5">
            {wsContextData?.myMembership?.staffTitle || 'Workspace Member'}
            {wsContextData?.myMembership?.department
              ? ` · ${wsContextData.myMembership.department}`
              : ''}
          </p>
        </div>

        {assignedRoles.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-mut mr-1">Role View:</span>
            <button
              type="button"
              onClick={() => setWorkspaceRolePerspective('COMBINED')}
              className={`px-2.5 py-1 rounded text-xs font-medium border ${
                workspaceRolePerspective === 'COMBINED'
                  ? 'bg-brand-700 text-white border-brand-700'
                  : 'bg-paper text-ink-2 border-line'
              }`}
            >
              Combined ({combinedPermissions.length})
            </button>
            {assignedRoles.map((role: any) => (
              <button
                key={role.id}
                type="button"
                onClick={() => setWorkspaceRolePerspective(role.id)}
                className={`px-2.5 py-1 rounded text-xs font-medium border ${
                  workspaceRolePerspective === role.id
                    ? 'bg-brand-700 text-white border-brand-700'
                    : 'bg-paper text-ink-2 border-line'
                }`}
              >
                {role.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {ws && ws.approvalStatus !== 'APPROVED' && (
        <div className="rounded-md bg-gold-50 border border-gold-100 p-4 flex items-start gap-3 text-sm text-gold-700">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold">
              Facility Status: {ws.approvalStatus} (Central Registry Review)
            </div>
            <p className="mt-0.5">
              Public appointment booking and package listings unlock once DGHS
              approves this facility.
            </p>
          </div>
        </div>
      )}

      <TransientToast
        notification={bannerMsg}
        onDismiss={() => setBannerMsg(null)}
      />

      {/* =================================================================== */}
      {/* 1. OVERVIEW                                                         */}
      {/* =================================================================== */}
      {activeSection === 'overview' && (
        <div className="space-y-6">
          <h1 className="text-2xl font-semibold text-ink">Overview</h1>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-paper border border-line rounded-md p-4">
              <div className="text-sm text-mut">Appointments</div>
              <div className="text-2xl font-semibold text-ink font-mono mt-1">
                {metrics.totalAppointments ?? 0}
              </div>
            </div>
            <div className="bg-paper border border-line rounded-md p-4">
              <div className="text-sm text-mut">Laboratory Reports</div>
              <div className="text-2xl font-semibold text-ink font-mono mt-1">
                {metrics.totalLabReports ?? 0}
              </div>
            </div>
            <div className="bg-paper border border-line rounded-md p-4">
              <div className="text-sm text-mut">Billing Statements</div>
              <div className="text-2xl font-semibold text-ink font-mono mt-1">
                {metrics.totalInvoices ?? 0}
              </div>
            </div>
            <div className="bg-paper border border-line rounded-md p-4">
              <div className="text-sm text-mut">Active Staff & Doctors</div>
              <div className="text-2xl font-semibold text-brand-700 font-mono mt-1">
                {(metrics.activeStaffCount ?? 0) +
                  (metrics.activeDoctorsCount ?? 0)}
              </div>
            </div>
          </div>

          <DataList
            title={`Active Permissions (${activePermissions.length})`}
            description="Sidebar items and actions dynamically adapt to the active role view."
            data={permissionCatalog.filter((p: any) =>
              activePermissions.includes(p.key)
            )}
            getRowId={(p: any) => p.key}
            emptyMessage="No permissions active for this perspective."
            columns={[
              {
                key: 'domain',
                header: 'Module',
                render: (p: any) => (
                  <StatusBadge label={p.domain} tone="neutral" />
                ),
              },
              {
                key: 'key',
                header: 'Permission Key',
                render: (p: any) => (
                  <span className="font-mono text-xs text-brand-700">
                    {p.key}
                  </span>
                ),
              },
              {
                key: 'label',
                header: 'Capability',
                render: (p: any) => (
                  <span className="font-medium text-ink">{p.label}</span>
                ),
              },
            ]}
          />
        </div>
      )}

      {/* =================================================================== */}
      {/* 2. APPOINTMENTS                                                     */}
      {/* =================================================================== */}
      {activeSection === 'appointments' && (
        <div className="space-y-5">
          <div>
            <h1 className="text-2xl font-semibold text-ink">Appointments</h1>
            <p className="text-sm text-mut mt-0.5">
              Review patient consultation requests, assign serials, and update
              visit statuses.
            </p>
          </div>

          <DataList
            title={`Scheduled & Requested Appointments (${appointments.length})`}
            data={appointments}
            getRowId={(a: any) => a.id}
            emptyMessage="No appointments found for this facility."
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
                key: 'patient',
                header: 'Patient',
                render: (apt: any) => (
                  <div>
                    <div className="font-semibold text-ink">
                      {apt.patient?.name}
                    </div>
                    <div className="font-mono text-xs text-mut">
                      {apt.patient?.uniqueId}
                    </div>
                  </div>
                ),
              },
              {
                key: 'doctor',
                header: 'Doctor',
                render: (apt: any) => (
                  <div>
                    <div className="font-medium text-ink">
                      {apt.doctor?.patientUser?.name}
                    </div>
                    <div className="text-xs text-mut">
                      {apt.doctor?.specialty}
                    </div>
                  </div>
                ),
              },
              {
                key: 'slot',
                header: 'Date & Slot',
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
              {
                key: 'actions',
                header: 'Actions',
                align: 'right',
                render: (apt: any) =>
                  hasPerm('appointments.manage') ? (
                    <div className="inline-flex items-center justify-end gap-1.5">
                      {apt.status === 'PENDING' && (
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateAppointment(apt.id, 'APPROVED')
                          }
                          className="btn-primary !px-2.5 !py-1"
                        >
                          Approve
                        </button>
                      )}
                      {apt.status === 'APPROVED' && (
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateAppointment(apt.id, 'COMPLETED')
                          }
                          className="btn-primary !px-2.5 !py-1"
                        >
                          Complete
                        </button>
                      )}
                      {['PENDING', 'APPROVED'].includes(apt.status) && (
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateAppointment(apt.id, 'CANCELLED')
                          }
                          className="btn-danger !px-2.5 !py-1"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-mut">Read-only</span>
                  ),
              },
            ]}
          />
        </div>
      )}

      {/* =================================================================== */}
      {/* 3. LABORATORY                                                       */}
      {/* =================================================================== */}
      {activeSection === 'laboratory' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-ink">Laboratory</h1>
              <p className="text-sm text-mut mt-0.5">
                Diagnostic reports issued directly to patient medical records.
              </p>
            </div>
            {hasPerm('reports.upload') && (
              <button
                type="button"
                onClick={() => setUploadReportOpen(true)}
                className="btn-primary"
              >
                <Plus className="w-4 h-4" />
                <span>Upload Report</span>
              </button>
            )}
          </div>

          <DataList
            title={`Issued Laboratory Reports (${reports.length})`}
            data={reports}
            getRowId={(r: any) => r.id}
            emptyMessage="No laboratory reports uploaded yet."
            columns={[
              {
                key: 'code',
                header: 'Report Code',
                render: (r: any) => (
                  <span className="font-mono text-xs text-ink-2">
                    {r.documentCode}
                  </span>
                ),
              },
              {
                key: 'patient',
                header: 'Patient',
                render: (r: any) => (
                  <div>
                    <div className="font-semibold text-ink">
                      {r.patient?.name}
                    </div>
                    <div className="font-mono text-xs text-mut">
                      {r.patient?.uniqueId}
                    </div>
                  </div>
                ),
              },
              {
                key: 'title',
                header: 'Investigation',
                render: (r: any) => (
                  <div>
                    <div className="font-medium text-ink">{r.title}</div>
                    <div className="text-xs text-mut">
                      {r.structuredData?.testCategory}
                    </div>
                  </div>
                ),
              },
              {
                key: 'date',
                header: 'Date',
                render: (r: any) => (
                  <span className="font-mono text-sm text-mut">
                    {new Date(r.createdAt).toLocaleDateString()}
                  </span>
                ),
              },
              {
                key: 'actions',
                header: 'Actions',
                align: 'right',
                render: (r: any) => (
                  <div className="inline-flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => setInspectedDoc(r)}
                      className="btn-secondary !px-2.5 !py-1"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadClinicalDocumentPdf(r, r.patient)}
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
      {/* 4. BILLING                                                          */}
      {/* =================================================================== */}
      {activeSection === 'billing' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-ink">Billing</h1>
              <p className="text-sm text-mut mt-0.5">
                Patient billing invoices and payment statements.
              </p>
            </div>
            {hasPerm('billing.create') && (
              <button
                type="button"
                onClick={() => setCreateInvoiceOpen(true)}
                className="btn-primary"
              >
                <Plus className="w-4 h-4" />
                <span>Create Invoice</span>
              </button>
            )}
          </div>

          <DataList
            title={`Billing Statements (${invoices.length})`}
            data={invoices}
            getRowId={(inv: any) => inv.id}
            emptyMessage="No billing statements issued yet."
            columns={[
              {
                key: 'code',
                header: 'Invoice Code',
                render: (inv: any) => (
                  <span className="font-mono text-xs text-ink-2">
                    {inv.documentCode}
                  </span>
                ),
              },
              {
                key: 'patient',
                header: 'Patient',
                render: (inv: any) => (
                  <div>
                    <div className="font-semibold text-ink">
                      {inv.patient?.name}
                    </div>
                    <div className="font-mono text-xs text-mut">
                      {inv.patient?.uniqueId}
                    </div>
                  </div>
                ),
              },
              {
                key: 'title',
                header: 'Description',
                render: (inv: any) => <span>{inv.title}</span>,
              },
              {
                key: 'amount',
                header: 'Total',
                render: (inv: any) => (
                  <span className="font-mono font-semibold text-brand-700">
                    {Number(
                      inv.structuredData?.totalAmount || 0
                    ).toLocaleString()}{' '}
                    Tk
                  </span>
                ),
              },
              {
                key: 'status',
                header: 'Payment',
                render: (inv: any) => (
                  <StatusBadge
                    label={inv.structuredData?.paymentStatus || 'PAID'}
                  />
                ),
              },
              {
                key: 'actions',
                header: 'Actions',
                align: 'right',
                render: (inv: any) => (
                  <div className="inline-flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => setInspectedDoc(inv)}
                      className="btn-secondary !px-2.5 !py-1"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        downloadClinicalDocumentPdf(inv, inv.patient)
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
      {/* 5. DOCTORS                                                          */}
      {/* =================================================================== */}
      {activeSection === 'doctors' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-ink">Doctors</h1>
              <p className="text-sm text-mut mt-0.5">
                Affiliated consultants, chamber schedules, and consultation
                fees.
              </p>
            </div>
            {hasPerm('doctors.invite') && (
              <button
                type="button"
                onClick={() => setInviteDoctorOpen(true)}
                className="btn-primary"
              >
                <Plus className="w-4 h-4" />
                <span>Invite Doctor</span>
              </button>
            )}
          </div>

          <DataList
            title={`Doctor Affiliations (${doctorsData.affiliations.length})`}
            data={doctorsData.affiliations}
            getRowId={(a: any) => a.id}
            emptyMessage="No doctor affiliations configured yet."
            columns={[
              {
                key: 'doctor',
                header: 'Doctor',
                render: (aff: any) => (
                  <div>
                    <div className="font-semibold text-ink">
                      {aff.doctor?.patientUser?.name}
                    </div>
                    <div className="font-mono text-xs text-mut">
                      {aff.doctor?.doctorIdCode} · {aff.doctor?.specialty}
                    </div>
                  </div>
                ),
              },
              {
                key: 'schedule',
                header: 'Schedule, Room & Available Slots',
                render: (aff: any) => (
                  <div className="text-sm space-y-1">
                    <div>
                      {aff.scheduleLabel || aff.schedule}
                      {aff.roomNumber ? (
                        <span className="text-xs text-mut">
                          {' '}
                          · {aff.roomNumber}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {(aff.availableSlots || []).map((slot: string) => (
                        <span
                          key={slot}
                          className="inline-flex items-center rounded bg-paper-2 border border-line px-1.5 py-0.5 font-mono text-[11px] text-brand-700"
                        >
                          {slot}
                        </span>
                      ))}
                    </div>
                  </div>
                ),
              },
              {
                key: 'fee',
                header: 'Fee',
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
                render: (aff: any) => (
                  <div className="inline-flex items-center justify-end gap-1.5">
                    {aff.status === 'PENDING' &&
                      aff.initiatedBy === 'DOCTOR' &&
                      hasPerm('doctors.invite') && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdateDoctorAffiliation(aff.id, 'ACTIVE')
                            }
                            className="btn-primary !px-2.5 !py-1"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdateDoctorAffiliation(aff.id, 'REJECTED')
                            }
                            className="btn-danger !px-2.5 !py-1"
                          >
                            Decline
                          </button>
                        </>
                      )}
                    {(hasPerm('doctors.schedule') ||
                      hasPerm('doctors.invite')) && (
                      <button
                        type="button"
                        onClick={() => openEditWsAffModal(aff)}
                        className="btn-secondary !px-2.5 !py-1"
                      >
                        Configure Slots
                      </button>
                    )}
                    {aff.status === 'ACTIVE' && hasPerm('doctors.remove') && (
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateDoctorAffiliation(aff.id, 'REVOKED')
                        }
                        className="btn-danger !px-2.5 !py-1"
                      >
                        Revoke
                      </button>
                    )}
                    {aff.status === 'REVOKED' &&
                      aff.statusUpdatedBy === 'WORKSPACE' &&
                      hasPerm('doctors.invite') && (
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateDoctorAffiliation(aff.id, 'ACTIVE')
                          }
                          className="btn-primary !px-2.5 !py-1"
                        >
                          Undo Revoke
                        </button>
                      )}
                    {(aff.status === 'REVOKED' || aff.status === 'REJECTED') &&
                      aff.statusUpdatedBy !== 'WORKSPACE' &&
                      hasPerm('doctors.invite') && (
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateDoctorAffiliation(aff.id, 'PENDING')
                          }
                          className="btn-secondary !px-2.5 !py-1"
                        >
                          Re-invite
                        </button>
                      )}
                    {aff.status === 'PENDING' &&
                      aff.initiatedBy === 'WORKSPACE' &&
                      hasPerm('doctors.remove') && (
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateDoctorAffiliation(aff.id, 'REVOKED')
                          }
                          className="btn-danger !px-2.5 !py-1"
                        >
                          Cancel Invite
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
      {/* 6. PACKAGES                                                         */}
      {/* =================================================================== */}
      {activeSection === 'packages' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-ink">Packages</h1>
              <p className="text-sm text-mut mt-0.5">
                Diagnostic checkup and preventive care packages offered by this
                facility.
              </p>
            </div>
            {hasPerm('packages.manage') && (
              <button
                type="button"
                onClick={() => setNewPackageOpen(true)}
                className="btn-primary"
              >
                <Plus className="w-4 h-4" />
                <span>New Package</span>
              </button>
            )}
          </div>

          <DataList
            title={`Published Packages (${packages.length})`}
            data={packages}
            getRowId={(p: any) => p.id}
            emptyMessage="No health packages created yet."
            columns={[
              {
                key: 'title',
                header: 'Package Name',
                render: (p: any) => (
                  <div>
                    <div className="font-semibold text-ink">{p.title}</div>
                    <div className="text-xs text-mut">{p.durationLabel}</div>
                  </div>
                ),
              },
              {
                key: 'tests',
                header: 'Included Investigations',
                render: (p: any) => (
                  <div className="text-xs text-ink-2 max-w-md">
                    {(p.includedTests || []).join(', ')}
                  </div>
                ),
              },
              {
                key: 'price',
                header: 'Price',
                render: (p: any) => (
                  <span className="font-mono font-semibold text-brand-700">
                    {Number(p.price || 0).toLocaleString()} Tk
                  </span>
                ),
              },
              {
                key: 'status',
                header: 'Status',
                render: (p: any) => (
                  <StatusBadge label={p.isActive ? 'ACTIVE' : 'DISABLED'} />
                ),
              },
              {
                key: 'actions',
                header: 'Actions',
                align: 'right',
                render: (p: any) =>
                  hasPerm('packages.manage') ? (
                    <button
                      type="button"
                      onClick={() => handleTogglePackageActive(p)}
                      className="btn-secondary !px-2.5 !py-1"
                    >
                      {p.isActive ? 'Pause' : 'Activate'}
                    </button>
                  ) : null,
              },
            ]}
          />
        </div>
      )}

      {/* =================================================================== */}
      {/* 7. STAFF                                                            */}
      {/* =================================================================== */}
      {activeSection === 'staff' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-ink">Staff</h1>
              <p className="text-sm text-mut mt-0.5">
                Workspace members, multi-role assignments, and Single Primary
                Owner governance.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isOwner && (
                <button
                  type="button"
                  onClick={() => setTransferOwnerOpen(true)}
                  className="btn-secondary"
                >
                  Transfer Ownership
                </button>
              )}
              {hasPerm('staff.invite') && (
                <button
                  type="button"
                  onClick={() => setInviteStaffOpen(true)}
                  className="btn-primary"
                >
                  <Plus className="w-4 h-4" />
                  <span>Invite Staff</span>
                </button>
              )}
            </div>
          </div>

          <DataList
            title={`Staff Roster (${staffList.length})`}
            data={staffList}
            getRowId={(m: any) => m.id}
            emptyMessage="No staff members found."
            columns={[
              {
                key: 'member',
                header: 'Staff Member',
                render: (m: any) => (
                  <div>
                    <div className="font-semibold text-ink">
                      {m.patientUser?.name}
                    </div>
                    <div className="font-mono text-xs text-mut">
                      {m.patientUser?.uniqueId} · {m.patientUser?.email}
                    </div>
                  </div>
                ),
              },
              {
                key: 'designation',
                header: 'Title & Department',
                render: (m: any) => (
                  <div className="text-sm">
                    <div>{m.staffTitle || 'Staff'}</div>
                    <div className="text-xs text-mut">{m.department}</div>
                  </div>
                ),
              },
              {
                key: 'roles',
                header: 'Assigned Roles',
                render: (m: any) => (
                  <div className="flex flex-wrap gap-1">
                    {m.isOwner && <StatusBadge label="Primary Owner" tone="brand" />}
                    {(m.assignedRoles || []).map((ar: any) => (
                      <StatusBadge
                        key={ar.role?.id || ar.id}
                        label={ar.role?.name}
                        tone="neutral"
                      />
                    ))}
                  </div>
                ),
              },
              {
                key: 'status',
                header: 'Status',
                render: (m: any) => <StatusBadge label={m.invitationStatus} />,
              },
              {
                key: 'actions',
                header: 'Actions',
                align: 'right',
                render: (m: any) => {
                  const canRemove =
                    hasPerm('staff.remove') &&
                    !m.isOwner &&
                    m.invitationStatus !== 'REMOVED' &&
                    (!m.isAdmin || isOwner);
                  return canRemove ? (
                    <button
                      type="button"
                      onClick={() => handleRemoveStaff(m.id)}
                      className="btn-danger !px-2.5 !py-1"
                    >
                      Remove
                    </button>
                  ) : (
                    <span className="text-xs text-mut">
                      {m.isOwner ? 'Protected Owner' : '—'}
                    </span>
                  );
                },
              },
            ]}
          />
        </div>
      )}

      {/* =================================================================== */}
      {/* 8. ROLES & PERMISSIONS                                              */}
      {/* =================================================================== */}
      {activeSection === 'roles' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-ink">
                Roles & Permissions
              </h1>
              <p className="text-sm text-mut mt-0.5">
                Configure custom hospital roles from the 24 granular clinical
                and operational permissions.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCreateRoleOpen(true)}
              className="btn-primary"
            >
              <Plus className="w-4 h-4" />
              <span>Create Role</span>
            </button>
          </div>

          <DataList
            title={`Configured Roles (${rolesList.length})`}
            data={rolesList}
            getRowId={(r: any) => r.id}
            emptyMessage="No roles configured."
            columns={[
              {
                key: 'name',
                header: 'Role Name',
                render: (r: any) => (
                  <div>
                    <div className="font-semibold text-ink">{r.name}</div>
                    {r.description && (
                      <div className="text-xs text-mut">{r.description}</div>
                    )}
                  </div>
                ),
              },
              {
                key: 'kind',
                header: 'Type',
                render: (r: any) => (
                  <StatusBadge
                    label={r.isSystem ? 'System Role' : 'Custom Role'}
                    tone={r.isSystem ? 'brand' : 'neutral'}
                  />
                ),
              },
              {
                key: 'perms',
                header: 'Permissions',
                render: (r: any) => (
                  <span className="font-mono text-xs text-ink-2">
                    {r.permissions?.length || 0} permissions
                  </span>
                ),
              },
              {
                key: 'actions',
                header: 'Actions',
                align: 'right',
                render: (r: any) =>
                  !r.isSystem ? (
                    <button
                      type="button"
                      onClick={() => handleDeleteDynamicRole(r.id)}
                      className="btn-danger !px-2.5 !py-1"
                    >
                      Delete
                    </button>
                  ) : (
                    <span className="text-xs text-mut">Built-in</span>
                  ),
              },
            ]}
          />
        </div>
      )}

      {/* =================================================================== */}
      {/* 9. AUDIT LOGS                                                       */}
      {/* =================================================================== */}
      {activeSection === 'audit_logs' && (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-semibold text-ink">Audit Logs</h1>
            <p className="text-sm text-mut mt-0.5">
              Immutable staff performance metrics and action history, preserved
              even after staff removal.
            </p>
          </div>

          <DataList
            title="Staff Performance Summary"
            data={auditData.staffPerformanceSummary}
            getRowId={(s: any) => s.memberId}
            emptyMessage="No staff activity recorded yet."
            columns={[
              {
                key: 'staff',
                header: 'Staff Member',
                render: (s: any) => (
                  <div>
                    <div className="font-semibold text-ink">{s.name}</div>
                    <div className="font-mono text-xs text-mut">
                      {s.uniqueId}
                    </div>
                  </div>
                ),
              },
              {
                key: 'roles',
                header: 'Role / Designation',
                render: (s: any) => (
                  <span className="text-sm text-ink-2">
                    {(s.roles || []).join(', ') || s.staffTitle || 'Staff'}
                  </span>
                ),
              },
              {
                key: 'status',
                header: 'Membership Status',
                render: (s: any) => <StatusBadge label={s.status} />,
              },
              {
                key: 'count',
                header: 'Recorded Actions',
                align: 'right',
                render: (s: any) => (
                  <span className="font-mono font-semibold text-brand-700">
                    {s.totalActionsLogged ?? 0}
                  </span>
                ),
              },
            ]}
          />

          <DataList
            title={`Audit Trail (${auditData.logs.length})`}
            data={auditData.logs}
            getRowId={(l: any) => l.id}
            emptyMessage="No audit logs match the selected filters."
            toolbar={
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <select
                  value={auditFilterMember}
                  onChange={(e) => setAuditFilterMember(e.target.value)}
                  aria-label="Filter by staff member"
                  className="rounded-md border border-line bg-paper px-3 py-1.5 text-sm text-ink"
                >
                  <option value="">All Staff Members (Including Removed)</option>
                  {auditData.staffPerformanceSummary.map((s: any) => (
                    <option key={s.memberId} value={s.memberId}>
                      {s.name} ({s.status})
                    </option>
                  ))}
                </select>
                <select
                  value={auditFilterCategory}
                  onChange={(e) => setAuditFilterCategory(e.target.value)}
                  aria-label="Filter by category"
                  className="rounded-md border border-line bg-paper px-3 py-1.5 text-sm text-ink"
                >
                  <option value="ALL">All Categories</option>
                  <option value="APPOINTMENTS">Appointments</option>
                  <option value="REPORTS">Laboratory</option>
                  <option value="BILLING">Billing</option>
                  <option value="STAFF">Staff & Invitations</option>
                  <option value="DOCTORS">Doctor Affiliations</option>
                  <option value="PACKAGES">Packages</option>
                  <option value="ROLES">Roles & Governance</option>
                </select>
              </div>
            }
            columns={[
              {
                key: 'actor',
                header: 'Actor Snapshot',
                render: (l: any) => (
                  <div>
                    <div className="font-medium text-ink">
                      {l.actorNameSnapshot}
                    </div>
                    <div className="text-xs text-mut">
                      {Array.isArray(l.actorRolesSnapshot)
                        ? l.actorRolesSnapshot.join(', ')
                        : l.actorRoleSnapshot || 'Member'}
                    </div>
                  </div>
                ),
              },
              {
                key: 'cat',
                header: 'Category',
                render: (l: any) => (
                  <StatusBadge label={l.category} tone="neutral" />
                ),
              },
              {
                key: 'action',
                header: 'Action Details',
                render: (l: any) => (
                  <div>
                    <div className="font-mono text-xs text-brand-700">
                      {l.action}
                    </div>
                    <div className="text-sm text-ink-2">
                      {l.description || l.details}
                    </div>
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
      {/* 10. NOTIFICATIONS                                                   */}
      {/* =================================================================== */}
      {activeSection === 'notifications' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-ink">Notifications</h1>
              <p className="text-sm text-mut mt-0.5">
                Role-scoped facility notifications and incoming doctor
                affiliation requests.
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
            title="Workspace Notifications"
            data={unifiedNotificationRows}
            getRowId={(r: any) => r.rowId}
            emptyMessage="No notifications for your role permissions."
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
                header: 'Scope',
                render: (row: any) => (
                  <StatusBadge
                    label={row.isInvitation ? 'Request' : row.category}
                    tone={row.isInvitation ? 'warning' : 'brand'}
                  />
                ),
              },
              {
                key: 'msg',
                header: 'Message',
                render: (row: any) => (
                  <div>
                    <div className="font-semibold text-ink">{row.title}</div>
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
                render: (row: any) =>
                  row.kind === 'DOCTOR_REQUEST' ? (
                    <div className="inline-flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateDoctorAffiliation(row.affId, 'ACTIVE')
                        }
                        className="btn-primary !px-2.5 !py-1"
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateDoctorAffiliation(row.affId, 'REJECTED')
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
      {/* 11. PROFILE (CENTERED)                                              */}
      {/* =================================================================== */}
      {activeSection === 'profile' && (
        <div className="mx-auto w-full max-w-3xl space-y-6">
          <div>
            <h1 className="text-2xl font-semibold text-ink">Profile</h1>
            <p className="text-sm text-mut mt-0.5">
              Update your staff profile and, if permitted, facility settings.
            </p>
          </div>

          <form
            onSubmit={handleSaveMyStaffProfile}
            className="bg-paper border border-line rounded-md p-6 space-y-4"
          >
            <h2 className="text-lg font-semibold text-ink border-b border-line pb-3">
              Staff Member Profile
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-ink-2 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={myStaffName}
                  onChange={(e) => setMyStaffName(e.target.value)}
                  className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base text-ink"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-2 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={myStaffPhone}
                  onChange={(e) => setMyStaffPhone(e.target.value)}
                  className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base font-mono text-ink"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-2 mb-1">
                  Staff Title
                </label>
                <input
                  type="text"
                  value={myStaffTitle}
                  onChange={(e) => setMyStaffTitle(e.target.value)}
                  className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base text-ink"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-2 mb-1">
                  Department
                </label>
                <input
                  type="text"
                  value={myStaffDept}
                  onChange={(e) => setMyStaffDept(e.target.value)}
                  className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base text-ink"
                />
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button type="submit" className="btn-primary">
                Save Staff Profile
              </button>
            </div>
          </form>

          {hasPerm('workspace.profile.edit') && (
            <form
              onSubmit={handleSaveWorkspaceSettings}
              className="bg-paper border border-line rounded-md p-6 space-y-4"
            >
              <h2 className="text-lg font-semibold text-ink border-b border-line pb-3">
                Facility Information
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-ink-2 mb-1">
                    Facility Name
                  </label>
                  <input
                    type="text"
                    value={wsName}
                    onChange={(e) => setWsName(e.target.value)}
                    className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base text-ink"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink-2 mb-1">
                    Area
                  </label>
                  <input
                    type="text"
                    value={wsArea}
                    onChange={(e) => setWsArea(e.target.value)}
                    className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base text-ink"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink-2 mb-1">
                    Contact Phone
                  </label>
                  <input
                    type="tel"
                    value={wsPhone}
                    onChange={(e) => setWsPhone(e.target.value)}
                    className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base font-mono text-ink"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink-2 mb-1">
                    Operating Hours
                  </label>
                  <input
                    type="text"
                    value={wsHours}
                    onChange={(e) => setWsHours(e.target.value)}
                    className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base text-ink"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-2 mb-1">
                  Street Address
                </label>
                <input
                  type="text"
                  value={wsAddress}
                  onChange={(e) => setWsAddress(e.target.value)}
                  className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base text-ink"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-2 mb-1">
                  Departments (comma-separated)
                </label>
                <input
                  type="text"
                  value={wsDepts}
                  onChange={(e) => setWsDepts(e.target.value)}
                  className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base text-ink"
                />
              </div>
              <div className="flex justify-end pt-2">
                <button type="submit" className="btn-primary">
                  Save Facility Profile
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* POPUP MODALS                                                        */}
      {/* =================================================================== */}

      {/* 1. Document Viewer + PDF Download */}
      <DocumentViewerModal
        doc={inspectedDoc}
        onClose={() => setInspectedDoc(null)}
      />

      {/* 2. Upload Lab Report Popup */}
      <ModalDialog
        open={uploadReportOpen}
        onClose={() => setUploadReportOpen(false)}
        title="Upload Laboratory Report"
        subtitle="Publishes structured diagnostic results directly to the patient's medical records."
        maxWidthClass="max-w-2xl"
      >
        <form onSubmit={handleUploadReport} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-ink-2 mb-1">
                Patient ID, Email, or Phone
              </label>
              <input
                type="text"
                required
                value={repPatientId}
                onChange={(e) => setRepPatientId(e.target.value)}
                className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base text-ink"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-2 mb-1">
                Department / Category
              </label>
              <input
                type="text"
                required
                value={repCategory}
                onChange={(e) => setRepCategory(e.target.value)}
                className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base text-ink"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-2 mb-1">
              Report Title
            </label>
            <input
              type="text"
              required
              value={repTitle}
              onChange={(e) => setRepTitle(e.target.value)}
              className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base text-ink"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-ink-2">
                Measured Parameters
              </label>
              <button
                type="button"
                onClick={() =>
                  setRepParams((prev) => [
                    ...prev,
                    { name: '', result: '', referenceRange: '', flag: 'NORMAL' },
                  ])
                }
                className="btn-secondary !px-2.5 !py-1"
              >
                Add Row
              </button>
            </div>
            {repParams.map((p, idx) => (
              <div
                key={idx}
                className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center"
              >
                <input
                  type="text"
                  required
                  value={p.name}
                  onChange={(e) =>
                    setRepParams((prev) =>
                      prev.map((item, i) =>
                        i === idx ? { ...item, name: e.target.value } : item
                      )
                    )
                  }
                  placeholder="Parameter"
                  className="sm:col-span-4 rounded-md border border-line bg-paper px-2.5 py-1.5 text-sm text-ink"
                />
                <input
                  type="text"
                  required
                  value={p.result}
                  onChange={(e) =>
                    setRepParams((prev) =>
                      prev.map((item, i) =>
                        i === idx ? { ...item, result: e.target.value } : item
                      )
                    )
                  }
                  placeholder="Result"
                  className="sm:col-span-3 rounded-md border border-line bg-paper px-2.5 py-1.5 text-sm font-mono text-ink"
                />
                <input
                  type="text"
                  value={p.referenceRange}
                  onChange={(e) =>
                    setRepParams((prev) =>
                      prev.map((item, i) =>
                        i === idx
                          ? { ...item, referenceRange: e.target.value }
                          : item
                      )
                    )
                  }
                  placeholder="Ref Range"
                  className="sm:col-span-3 rounded-md border border-line bg-paper px-2.5 py-1.5 text-sm font-mono text-ink"
                />
                <button
                  type="button"
                  disabled={repParams.length <= 1}
                  onClick={() =>
                    setRepParams((prev) => prev.filter((_, i) => i !== idx))
                  }
                  className="sm:col-span-2 btn-danger !p-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-2 mb-1">
              Pathologist Remarks
            </label>
            <textarea
              rows={2}
              value={repConclusion}
              onChange={(e) => setRepConclusion(e.target.value)}
              className="w-full rounded-md border border-line bg-paper px-3 py-1.5 text-sm text-ink"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setUploadReportOpen(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Publish Report
            </button>
          </div>
        </form>
      </ModalDialog>

      {/* 3. Create Billing Invoice Popup */}
      <ModalDialog
        open={createInvoiceOpen}
        onClose={() => setCreateInvoiceOpen(false)}
        title="Create Billing Invoice"
        subtitle="Issues a billing statement to the patient's medical records."
        maxWidthClass="max-w-2xl"
      >
        <form onSubmit={handleCreateInvoice} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-ink-2 mb-1">
                Patient ID, Email, or Phone
              </label>
              <input
                type="text"
                required
                value={billPatientId}
                onChange={(e) => setBillPatientId(e.target.value)}
                className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base text-ink"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-2 mb-1">
                Invoice Title
              </label>
              <input
                type="text"
                required
                value={billTitle}
                onChange={(e) => setBillTitle(e.target.value)}
                className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base text-ink"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-ink-2">
                Line Items
              </label>
              <button
                type="button"
                onClick={() =>
                  setBillItems((prev) => [
                    ...prev,
                    { description: '', qty: 1, amount: 500 },
                  ])
                }
                className="btn-secondary !px-2.5 !py-1"
              >
                Add Item
              </button>
            </div>
            {billItems.map((it, idx) => (
              <div
                key={idx}
                className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center"
              >
                <input
                  type="text"
                  required
                  value={it.description}
                  onChange={(e) =>
                    setBillItems((prev) =>
                      prev.map((row, i) =>
                        i === idx
                          ? { ...row, description: e.target.value }
                          : row
                      )
                    )
                  }
                  placeholder="Service description"
                  className="sm:col-span-6 rounded-md border border-line bg-paper px-2.5 py-1.5 text-sm text-ink"
                />
                <input
                  type="number"
                  min={1}
                  value={it.qty}
                  onChange={(e) =>
                    setBillItems((prev) =>
                      prev.map((row, i) =>
                        i === idx
                          ? { ...row, qty: Number(e.target.value) || 1 }
                          : row
                      )
                    )
                  }
                  className="sm:col-span-2 rounded-md border border-line bg-paper px-2.5 py-1.5 text-sm font-mono text-ink"
                />
                <input
                  type="number"
                  value={it.amount}
                  onChange={(e) =>
                    setBillItems((prev) =>
                      prev.map((row, i) =>
                        i === idx
                          ? { ...row, amount: Number(e.target.value) || 0 }
                          : row
                      )
                    )
                  }
                  className="sm:col-span-3 rounded-md border border-line bg-paper px-2.5 py-1.5 text-sm font-mono text-ink"
                />
                <button
                  type="button"
                  disabled={billItems.length <= 1}
                  onClick={() =>
                    setBillItems((prev) => prev.filter((_, i) => i !== idx))
                  }
                  className="sm:col-span-1 btn-danger !p-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-ink-2 mb-1">
                Discount (Tk)
              </label>
              <input
                type="number"
                value={billDiscount}
                onChange={(e) => setBillDiscount(e.target.value)}
                className="w-full rounded-md border border-line bg-paper px-3 py-1.5 text-sm font-mono text-ink"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-2 mb-1">
                Payment Status
              </label>
              <select
                value={billStatus}
                onChange={(e) => setBillStatus(e.target.value)}
                className="w-full rounded-md border border-line bg-paper px-3 py-1.5 text-sm text-ink"
              >
                <option value="PAID">Paid</option>
                <option value="UNPAID">Unpaid</option>
                <option value="PARTIAL">Partial</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-2 mb-1">
                Method
              </label>
              <input
                type="text"
                value={billMethod}
                onChange={(e) => setBillMethod(e.target.value)}
                className="w-full rounded-md border border-line bg-paper px-3 py-1.5 text-sm text-ink"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setCreateInvoiceOpen(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Issue Invoice
            </button>
          </div>
        </form>
      </ModalDialog>

      {/* 4. Invite Doctor Popup */}
      <ModalDialog
        open={inviteDoctorOpen}
        onClose={() => setInviteDoctorOpen(false)}
        title="Invite Doctor for Affiliation"
        subtitle="Send a chamber affiliation invitation to an approved specialist."
      >
        <form onSubmit={handleInviteDoctor} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink-2 mb-1">
              Doctor ID, Email, or BMDC License
            </label>
            <input
              type="text"
              required
              value={invDocIdentifier}
              onChange={(e) => setInvDocIdentifier(e.target.value)}
              placeholder="dr.nusrat@demo.bd"
              className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base text-ink"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-ink-2 mb-1">
                Consultation Fee (Tk)
              </label>
              <input
                type="number"
                required
                value={invDocFee}
                onChange={(e) => setInvDocFee(e.target.value)}
                className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base font-mono text-ink"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-2 mb-1">
                Room / Wing
              </label>
              <input
                type="text"
                value={invDocRoom}
                onChange={(e) => setInvDocRoom(e.target.value)}
                className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base text-ink"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-2 mb-1">
              Chamber Schedule
            </label>
            <input
              type="text"
              required
              value={invDocSchedule}
              onChange={(e) => setInvDocSchedule(e.target.value)}
              className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base text-ink"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-2 mb-1.5">
              Configured Consultation Time Slots ({invDocSlots.length} selected)
            </label>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_TIME_SLOTS.map((slot) => {
                const active = invDocSlots.includes(slot);
                return (
                  <button
                    key={slot}
                    type="button"
                    onClick={() =>
                      setInvDocSlots((prev) =>
                        prev.includes(slot)
                          ? prev.filter((s) => s !== slot)
                          : [...prev, slot]
                      )
                    }
                    className={`rounded border px-2 py-1 text-xs font-mono transition-colors ${
                      active
                        ? 'border-brand-700 bg-brand-700 text-white'
                        : 'border-line bg-paper text-ink-2 hover:bg-paper-3'
                    }`}
                  >
                    {slot}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setInviteDoctorOpen(false)}
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

      {/* 4b. Configure Doctor Chamber Schedule & Time Slots Modal */}
      <ModalDialog
        open={Boolean(editingWsAff)}
        onClose={() => setEditingWsAff(null)}
        title="Configure Doctor Chamber Schedule & Slots"
        subtitle={
          editingWsAff
            ? `${editingWsAff.doctor?.patientUser?.name} — Patients can only choose from the time slots configured below.`
            : undefined
        }
      >
        {editingWsAff && (
          <form onSubmit={handleSaveWsAffSchedule} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-ink-2 mb-1">
                  Consultation Fee (Tk)
                </label>
                <input
                  type="number"
                  required
                  value={editWsAffFee}
                  onChange={(e) => setEditWsAffFee(e.target.value)}
                  className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base font-mono text-ink"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-2 mb-1">
                  Room / Wing
                </label>
                <input
                  type="text"
                  value={editWsAffRoom}
                  onChange={(e) => setEditWsAffRoom(e.target.value)}
                  placeholder="Room 302"
                  className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base text-ink"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-2 mb-1">
                Schedule Days & Hours Label
              </label>
              <input
                type="text"
                required
                value={editWsAffSchedule}
                onChange={(e) => setEditWsAffSchedule(e.target.value)}
                className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base text-ink"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-2 mb-1.5">
                Patient Selectable Time Slots ({editWsAffSlots.length} selected)
              </label>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_TIME_SLOTS.map((slot) => {
                  const active = editWsAffSlots.includes(slot);
                  return (
                    <button
                      key={slot}
                      type="button"
                      onClick={() =>
                        setEditWsAffSlots((prev) =>
                          prev.includes(slot)
                            ? prev.filter((s) => s !== slot)
                            : [...prev, slot]
                        )
                      }
                      className={`rounded border px-2 py-1 text-xs font-mono transition-colors ${
                        active
                          ? 'border-brand-700 bg-brand-700 text-white'
                          : 'border-line bg-paper text-ink-2 hover:bg-paper-3'
                      }`}
                    >
                      {slot}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingWsAff(null)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button type="submit" className="btn-primary">
                Save Schedule & Slots
              </button>
            </div>
          </form>
        )}
      </ModalDialog>

      {/* 5. Create Health Package Popup */}
      <ModalDialog
        open={newPackageOpen}
        onClose={() => setNewPackageOpen(false)}
        title="New Health Package"
        subtitle="Publish a diagnostic checkup package for patients."
      >
        <form onSubmit={handleCreatePackage} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink-2 mb-1">
              Package Title
            </label>
            <input
              type="text"
              required
              value={pkgTitle}
              onChange={(e) => setPkgTitle(e.target.value)}
              placeholder="Executive Full Body Checkup"
              className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base text-ink"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-ink-2 mb-1">
                Package Fee (Tk)
              </label>
              <input
                type="number"
                required
                value={pkgPrice}
                onChange={(e) => setPkgPrice(e.target.value)}
                className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base font-mono text-ink"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-2 mb-1">
                Regular Fee (Optional, Tk)
              </label>
              <input
                type="number"
                value={pkgOriginalPrice}
                onChange={(e) => setPkgOriginalPrice(e.target.value)}
                className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base font-mono text-ink"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-2 mb-1">
              Turnaround / Delivery
            </label>
            <input
              type="text"
              value={pkgDuration}
              onChange={(e) => setPkgDuration(e.target.value)}
              className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base text-ink"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-2 mb-1">
              Included Tests (comma-separated)
            </label>
            <textarea
              rows={3}
              value={pkgTests}
              onChange={(e) => setPkgTests(e.target.value)}
              className="w-full rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setNewPackageOpen(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Publish Package
            </button>
          </div>
        </form>
      </ModalDialog>

      {/* 6. Invite Staff Member Popup */}
      <ModalDialog
        open={inviteStaffOpen}
        onClose={() => setInviteStaffOpen(false)}
        title="Invite Staff Member"
        subtitle="Invite a registered Patient account and assign one or multiple roles."
      >
        <form onSubmit={handleInviteStaff} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink-2 mb-1">
              Patient ID, Email, or Phone
            </label>
            <input
              type="text"
              required
              value={invStaffPatientId}
              onChange={(e) => setInvStaffPatientId(e.target.value)}
              className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base text-ink"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-ink-2 mb-1">
                Staff Title
              </label>
              <input
                type="text"
                value={invStaffTitle}
                onChange={(e) => setInvStaffTitle(e.target.value)}
                className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base text-ink"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-2 mb-1">
                Department
              </label>
              <input
                type="text"
                value={invStaffDept}
                onChange={(e) => setInvStaffDept(e.target.value)}
                className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base text-ink"
              />
            </div>
          </div>

          <fieldset className="border border-line rounded-md p-3 bg-paper-2">
            <legend className="text-xs font-semibold text-mut px-1">
              Assign Roles (Multi-Select)
            </legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1 text-sm">
              {rolesList
                .filter((r: any) => r.name !== 'Owner')
                .map((r: any) => (
                  <label
                    key={r.id}
                    className="flex items-center gap-2 text-ink-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={invStaffRoleIds.includes(r.id)}
                      onChange={(e) =>
                        setInvStaffRoleIds((prev) =>
                          e.target.checked
                            ? [...prev, r.id]
                            : prev.filter((id) => id !== r.id)
                        )
                      }
                      className="w-4 h-4 accent-brand-700"
                    />
                    <span>{r.name}</span>
                  </label>
                ))}
            </div>
          </fieldset>

          <label className="flex items-center gap-2 text-sm text-ink-2 cursor-pointer">
            <input
              type="checkbox"
              checked={invAutoAccept}
              onChange={(e) => setInvAutoAccept(e.target.checked)}
              className="w-4 h-4 accent-brand-700"
            />
            <span>
              Activate immediately (leave unchecked so user accepts from
              Notifications page)
            </span>
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setInviteStaffOpen(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={invStaffRoleIds.length === 0}
              className="btn-primary"
            >
              Send Staff Invitation
            </button>
          </div>
        </form>
      </ModalDialog>

      {/* 7. Transfer Ownership Popup */}
      <ModalDialog
        open={transferOwnerOpen}
        onClose={() => setTransferOwnerOpen(false)}
        title="Transfer Primary Ownership"
        subtitle="Transfers Single Primary Owner authority to an active staff member and reassigns your account to Admin."
      >
        <form onSubmit={handleTransferOwnership} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink-2 mb-1">
              New Primary Owner
            </label>
            <select
              required
              value={transferTargetMemberId}
              onChange={(e) => setTransferTargetMemberId(e.target.value)}
              className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base text-ink"
            >
              <option value="">Select active staff member...</option>
              {staffList
                .filter(
                  (m: any) => !m.isOwner && m.invitationStatus === 'ACCEPTED'
                )
                .map((m: any) => (
                  <option key={m.id} value={m.id}>
                    {m.patientUser?.name} ({m.patientUser?.uniqueId})
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-2 mb-1">
              Confirm Your Password
            </label>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={transferPassword}
              onChange={(e) => setTransferPassword(e.target.value)}
              className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base text-ink"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setTransferOwnerOpen(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button type="submit" className="btn-danger">
              Confirm Transfer
            </button>
          </div>
        </form>
      </ModalDialog>

      {/* 8. Create Dynamic Role Popup */}
      <ModalDialog
        open={createRoleOpen}
        onClose={() => setCreateRoleOpen(false)}
        title="Create Dynamic Role"
        subtitle="Select the exact operational permissions granted to this role."
        maxWidthClass="max-w-2xl"
      >
        <form onSubmit={handleCreateDynamicRole} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-ink-2 mb-1">
                Role Name
              </label>
              <input
                type="text"
                required
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                placeholder="Radiology Desk Coordinator"
                className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base text-ink"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-2 mb-1">
                Description
              </label>
              <input
                type="text"
                value={newRoleDesc}
                onChange={(e) => setNewRoleDesc(e.target.value)}
                placeholder="Scoped access for imaging & appointments"
                className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base text-ink"
              />
            </div>
          </div>

          <div className="space-y-3">
            {Object.entries(permissionsByDomain).map(([domain, perms]) => (
              <fieldset
                key={domain}
                className="border border-line rounded-md p-3 bg-paper-2"
              >
                <legend className="text-xs font-semibold text-mut px-1">
                  {domain}
                </legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1 text-sm">
                  {(perms as any[]).map((p) => (
                    <label
                      key={p.key}
                      className="flex items-start gap-2 text-ink-2 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={newRolePerms.includes(p.key)}
                        onChange={(e) =>
                          setNewRolePerms((prev) =>
                            e.target.checked
                              ? [...prev, p.key]
                              : prev.filter((k) => k !== p.key)
                          )
                        }
                        className="w-4 h-4 accent-brand-700 mt-0.5"
                      />
                      <span>
                        <span className="block font-medium text-ink">
                          {p.label}
                        </span>
                        <span className="font-mono text-xs text-mut">
                          {p.key}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setCreateRoleOpen(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={newRolePerms.length === 0}
              className="btn-primary"
            >
              Save Role
            </button>
          </div>
        </form>
      </ModalDialog>
    </div>
  );
};
