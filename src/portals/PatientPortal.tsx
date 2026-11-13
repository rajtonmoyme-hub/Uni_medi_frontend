import {
  Calendar,
  Check,
  CheckCheck,
  Clock,
  Copy,
  Download,
  Eye,
  FilePlus2,
  Plus,
  QrCode,
  Trash2,
  UserCheck,
  XCircle,
} from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { DataList } from "../components/DataList";
import { DocumentViewerModal } from "../components/DocumentViewerModal";
import { ModalDialog } from "../components/ModalDialog";
import { StatusBadge } from "../components/StatusBadge";
import { TransientToast } from "../components/TransientToast";
import { useAuth } from "../context/AuthContext";
import { apiRequest } from "../services/api";
import { downloadClinicalDocumentPdf } from "../utils/pdfDownload";

function computeDoctorFeeRange(doc: any): string {
  const affFees = (doc.affiliations || [])
    .map((a: any) => Number(a.consultationFee))
    .filter((n: number) => Number.isFinite(n) && n > 0);

  if (affFees.length === 0) {
    const fallback = Number(doc.defaultConsultationFee || 0);
    return fallback > 0 ? `${fallback.toLocaleString()} Tk` : "—";
  }

  const min = Math.min(...affFees);
  const max = Math.max(...affFees);
  if (min === max) {
    return `${min.toLocaleString()} Tk`;
  }
  return `${min.toLocaleString()} – ${max.toLocaleString()} Tk`;
}

function formatRemainingTime(expiresAtIso: string, nowMs: number): string {
  const diffMs = new Date(expiresAtIso).getTime() - nowMs;
  if (diffMs <= 0) return "Expired";
  const totalMinutes = Math.ceil(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours > 0) {
    return `${hours}h ${mins}m left`;
  }
  return `${mins}m left`;
}

function calculateAgeFromDob(dob?: string | null): string | null {
  if (!dob) return null;
  const parsed = new Date(dob);
  if (Number.isNaN(parsed.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - parsed.getFullYear();
  const m = now.getMonth() - parsed.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < parsed.getDate())) {
    age--;
  }
  return age >= 0 && age < 130 ? `${age} yrs` : null;
}

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
  const [notifFilter, setNotifFilter] = useState<
    "ALL" | "INVITATIONS" | "UNREAD"
  >("ALL");
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [nowTick, setNowTick] = useState<number>(() => Date.now());
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Medical Records Filters & Selection
  const [vaultSearch, setVaultSearch] = useState<string>("");
  const [vaultDoctorFilter, setVaultDoctorFilter] = useState<string>("");
  const [vaultWorkspaceFilter, setVaultWorkspaceFilter] = useState<string>("");
  const [vaultTypeFilter, setVaultTypeFilter] = useState<string>("");
  const [vaultSortBy, setVaultSortBy] = useState<string>("date_desc");
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);

  // Self-Upload Modal State
  const [uploadModalOpen, setUploadModalOpen] = useState<boolean>(false);
  const [uploadType, setUploadType] = useState<
    "PRESCRIPTION" | "LAB_REPORT" | "BILLING_DOC"
  >("PRESCRIPTION");
  const [uploadTitle, setUploadTitle] = useState<string>("");
  const [uploadSummary, setUploadSummary] = useState<string>("");
  const [uploadDoctorName, setUploadDoctorName] = useState<string>("");
  const [uploadWorkspaceName, setUploadWorkspaceName] = useState<string>("");
  const [uploadMedName, setUploadMedName] = useState<string>("");
  const [uploadMedDosage, setUploadMedDosage] = useState<string>("1 + 0 + 1");
  const [uploadMedDuration, setUploadMedDuration] = useState<string>("7 Days");
  const [uploadLabParam, setUploadLabParam] = useState<string>("");
  const [uploadLabResult, setUploadLabResult] = useState<string>("");
  const [uploadLabRef, setUploadLabRef] = useState<string>("");
  const [uploadSubmitting, setUploadSubmitting] = useState<boolean>(false);

  // Modals State
  const [inspectedDoc, setInspectedDoc] = useState<any | null>(null);
  const [inspectedPackage, setInspectedPackage] = useState<any | null>(null);
  const [qrPopupData, setQrPopupData] = useState<any | null>(null);
  const [activeSharesModalOpen, setActiveSharesModalOpen] =
    useState<boolean>(false);
  const [inspectedDoctor, setInspectedDoctor] = useState<any | null>(null);
  const [bookingDoctor, setBookingDoctor] = useState<any | null>(null);
  const [addFamilyModalOpen, setAddFamilyModalOpen] = useState<boolean>(false);

  // Doctor Directory Filters & Appointment Request Form
  const [docSearch, setDocSearch] = useState<string>("");
  const [docWorkspaceFilter, setDocWorkspaceFilter] = useState<string>("");
  const [docSpecialtyFilter, setDocSpecialtyFilter] = useState<string>("");
  const [docAreaFilter, setDocAreaFilter] = useState<string>("");
  const [bookingWorkspaceId, setBookingWorkspaceId] = useState<string>("");
  const [bookingDate, setBookingDate] = useState<string>(() =>
    new Date(Date.now() + 86400000).toISOString().slice(0, 10),
  );
  const [bookingSlot, setBookingSlot] = useState<string>("06:00 PM");
  const [bookingReason, setBookingReason] = useState<string>("");
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingSubmitting, setBookingSubmitting] = useState<boolean>(false);

  // Appointments Section Filters
  const [aptStatusFilter, setAptStatusFilter] = useState<
    "ALL" | "UPCOMING" | "COMPLETED" | "CANCELLED"
  >("ALL");
  const [aptSearch, setAptSearch] = useState<string>("");

  // Hospitals Directory Filters
  const [wsSearch, setWsSearch] = useState<string>("");
  const [wsArea, setWsArea] = useState<string>("");
  const [wsType, setWsType] = useState<string>("");
  const [wsSortBy, setWsSortBy] = useState<string>("name_asc");

  // Family Add Member Popup State
  const [famTargetId, setFamTargetId] = useState<string>("");
  const [famDirection, setFamDirection] = useState<string>("AS_MAINTAINER");
  const [famType, setFamType] = useState<string>("CHILD");
  const [famLabel, setFamLabel] = useState<string>("Son / Daughter");

  // Profile Form State
  const [profName, setProfName] = useState<string>("");
  const [profPhone, setProfPhone] = useState<string>("");
  const [profNewPassword, setProfNewPassword] = useState<string>("");
  const [profNid, setProfNid] = useState<string>("");
  const [profBloodGroup, setProfBloodGroup] = useState<string>("");
  const [profGender, setProfGender] = useState<string>("");
  const [profDob, setProfDob] = useState<string>("");
  const [profEmergencyContact, setProfEmergencyContact] = useState<string>("");
  const [profAddress, setProfAddress] = useState<string>("");
  const [profAvatar, setProfAvatar] = useState<string>("");
  const [secondaryEmails, setSecondaryEmails] = useState<string[]>([]);
  const [newSecEmail, setNewSecEmail] = useState<string>("");
  const [secondaryPhones, setSecondaryPhones] = useState<string[]>([]);
  const [newSecPhone, setNewSecPhone] = useState<string>("");

  // Live ticker for QR session countdowns
  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowTick(Date.now());
    }, 15000);
    return () => window.clearInterval(timer);
  }, []);

  // Synchronize aria-invalid with :user-invalid (and fallback class) after user interaction
  useEffect(() => {
    const supportsUserInvalid =
      typeof CSS !== "undefined" &&
      typeof CSS.supports === "function" &&
      CSS.supports("selector(:user-invalid)");
    const dirtyFields = new WeakMap<
      Element,
      { interacted: boolean; blurred: boolean }
    >();

    const syncField = (el: EventTarget | null) => {
      if (
        !(el instanceof HTMLElement) ||
        !el.matches("input, select, textarea")
      ) {
        return;
      }
      const control = el as
        | HTMLInputElement
        | HTMLSelectElement
        | HTMLTextAreaElement;
      const isInvalid = supportsUserInvalid
        ? control.matches(":user-invalid")
        : Boolean(
            dirtyFields.get(control)?.interacted &&
            dirtyFields.get(control)?.blurred &&
            !control.validity.valid,
          );

      if (!supportsUserInvalid) {
        control.classList.toggle("user-invalid-fallback", isInvalid);
      }
      control.setAttribute("aria-invalid", isInvalid ? "true" : "false");
    };

    const onInputOrChange = (e: Event) => {
      if (e.target instanceof HTMLElement) {
        const prev = dirtyFields.get(e.target) || {
          interacted: false,
          blurred: false,
        };
        dirtyFields.set(e.target, { ...prev, interacted: true });
      }
      syncField(e.target);
    };

    const onBlur = (e: Event) => {
      if (e.target instanceof HTMLElement) {
        const prev = dirtyFields.get(e.target) || {
          interacted: false,
          blurred: false,
        };
        dirtyFields.set(e.target, { ...prev, blurred: true });
      }
      syncField(e.target);
    };

    const onInvalid = (e: Event) => {
      if (e.target instanceof HTMLElement) {
        dirtyFields.set(e.target, { interacted: true, blurred: true });
      }
      syncField(e.target);
    };

    document.addEventListener("input", onInputOrChange);
    document.addEventListener("change", onInputOrChange, true);
    document.addEventListener("blur", onBlur, true);
    document.addEventListener("invalid", onInvalid, true);
    return () => {
      document.removeEventListener("input", onInputOrChange);
      document.removeEventListener("change", onInputOrChange, true);
      document.removeEventListener("blur", onBlur, true);
      document.removeEventListener("invalid", onInvalid, true);
    };
  }, []);

  const showFeedback = (type: "success" | "error", text: string) => {
    setFeedback({ type, text });
  };

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      window.setTimeout(() => setCopiedCode(null), 2000);
    } catch {
      showFeedback("error", "Unable to copy code to clipboard.");
    }
  };

  const loadCoreData = useCallback(async () => {
    try {
      const notifParams = new URLSearchParams({ persona: "PATIENT" });
      if (actingPatientId) notifParams.set("actingPatientId", actingPatientId);

      const [dashRes, qrRes, aptRes, invitesRes, famRes, notifRes] =
        await Promise.all([
          apiRequest("/patient/dashboard"),
          apiRequest("/patient/vault/qr-sessions"),
          apiRequest("/patient/appointments"),
          apiRequest("/patient/staff-invitations"),
          apiRequest("/patient/family"),
          apiRequest(`/notifications?${notifParams.toString()}`),
        ]);

      setDashboard(dashRes);
      setQrSessions(qrRes.sessions || []);
      setAppointments(aptRes.appointments || []);
      setStaffInvites(invitesRes.invitations || []);
      setFamilyData(famRes);
      setNotifications(notifRes.notifications || []);

      if (dashRes.patient) {
        setProfName(dashRes.patient.name || "");
        setProfPhone(dashRes.patient.phone || "");
        setProfNid(dashRes.patient.nationalId || "");
        setProfBloodGroup(dashRes.patient.bloodGroup || "");
        setProfGender(dashRes.patient.gender || "");
        setProfDob(dashRes.patient.dateOfBirth || "");
        setProfEmergencyContact(dashRes.patient.emergencyContact || "");
        setProfAddress(dashRes.patient.address || "");
        setProfAvatar(dashRes.patient.profileAvatar || "");
        setSecondaryEmails(dashRes.patient.secondaryEmails || []);
        setSecondaryPhones(dashRes.patient.secondaryPhones || []);
      }
    } catch (err: any) {
      showFeedback("error", err.message || "Failed to load patient records.");
    }
  }, [actingPatientId]);

  const loadVaultDocs = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (vaultSearch) params.set("search", vaultSearch);
      if (vaultDoctorFilter) params.set("doctorName", vaultDoctorFilter);
      if (vaultWorkspaceFilter)
        params.set("workspaceName", vaultWorkspaceFilter);
      if (vaultTypeFilter) params.set("type", vaultTypeFilter);
      params.set("sortBy", vaultSortBy);
      const res = await apiRequest(`/patient/vault?${params.toString()}`);
      setVaultDocs(res.documents || []);
    } catch (err: any) {
      showFeedback("error", err.message);
    }
  }, [
    vaultSearch,
    vaultDoctorFilter,
    vaultWorkspaceFilter,
    vaultTypeFilter,
    vaultSortBy,
    actingPatientId,
  ]);

  const loadDoctors = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (docSearch) params.set("search", docSearch);
      if (docWorkspaceFilter) params.set("workspaceName", docWorkspaceFilter);
      if (docSpecialtyFilter) params.set("specialty", docSpecialtyFilter);
      if (docAreaFilter) params.set("area", docAreaFilter);
      const res = await apiRequest(`/patient/doctors?${params.toString()}`);
      setDoctors(res.doctors || []);
    } catch (err: any) {
      showFeedback("error", err.message);
    }
  }, [docSearch, docWorkspaceFilter, docSpecialtyFilter, docAreaFilter]);

  const loadWorkspaces = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (wsSearch) params.set("search", wsSearch);
      if (wsArea) params.set("area", wsArea);
      if (wsType) params.set("type", wsType);
      params.set("sortBy", wsSortBy);
      const res = await apiRequest(`/patient/workspaces?${params.toString()}`);
      setWorkspacesData(res);
    } catch (err: any) {
      showFeedback("error", err.message);
    }
  }, [wsSearch, wsArea, wsType, wsSortBy]);

  useEffect(() => {
    loadCoreData();
    loadVaultDocs();
    loadDoctors();
    loadWorkspaces();
  }, [loadCoreData, loadVaultDocs, loadDoctors, loadWorkspaces]);

  const activeQrSessions = useMemo(() => {
    const now = new Date(nowTick);
    return qrSessions.filter(
      (s: any) =>
        ["GENERATED", "SCANNED_ACTIVE"].includes(s.status) &&
        new Date(s.expiresAt) > now,
    );
  }, [qrSessions, nowTick]);

  const handleToggleDocRow = (id: string) => {
    setSelectedDocIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleToggleAllDocs = (checked: boolean) => {
    if (checked) {
      setSelectedDocIds(vaultDocs.map((d) => d.id));
    } else {
      setSelectedDocIds([]);
    }
  };

  const handleGenerateQr = async (forceSelectAll = false) => {
    try {
      const useAll = forceSelectAll || selectedDocIds.length === 0;
      const res = await apiRequest("/patient/vault/qr-generate", {
        method: "POST",
        body: {
          selectAll: useAll,
          documentIds: useAll ? [] : selectedDocIds,
        },
      });
      setQrPopupData(res);
      await loadCoreData();
    } catch (err: any) {
      showFeedback("error", err.message);
    }
  };

  const handleRevokeQr = async (sessionId: string) => {
    try {
      const res = await apiRequest(
        `/patient/vault/qr-sessions/${sessionId}/revoke`,
        { method: "POST" },
      );
      showFeedback("success", res.message);
      if (qrPopupData?.session?.id === sessionId) {
        setQrPopupData(null);
      }
      await loadCoreData();
    } catch (err: any) {
      showFeedback("error", err.message);
    }
  };

  const handleSelfUploadRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadTitle.trim()) return;
    setUploadSubmitting(true);
    try {
      const structuredData: Record<string, any> = {
        notes: uploadSummary.trim() || undefined,
      };
      if (uploadType === "PRESCRIPTION") {
        structuredData.diagnosis = uploadSummary.trim() || uploadTitle.trim();
        if (uploadMedName.trim()) {
          structuredData.medications = [
            {
              name: uploadMedName.trim(),
              dosage: uploadMedDosage.trim() || "1 + 0 + 1",
              duration: uploadMedDuration.trim() || "7 Days",
              instruction: "As prescribed",
            },
          ];
        }
      } else if (uploadType === "LAB_REPORT") {
        structuredData.testCategory = "External Diagnostic Report";
        structuredData.conclusion =
          uploadSummary.trim() || "Recorded by patient";
        if (uploadLabParam.trim()) {
          structuredData.parameters = [
            {
              name: uploadLabParam.trim(),
              result: uploadLabResult.trim() || "Recorded",
              referenceRange: uploadLabRef.trim() || "Standard",
              flag: "NORMAL",
            },
          ];
        }
      } else {
        structuredData.paymentStatus = "PAID";
        structuredData.items = [
          {
            description: uploadTitle.trim(),
            qty: 1,
            amount: 0,
          },
        ];
      }

      const res = await apiRequest("/patient/vault/self-upload", {
        method: "POST",
        body: {
          type: uploadType,
          title: uploadTitle.trim(),
          summary: uploadSummary.trim() || undefined,
          doctorNameSnapshot: uploadDoctorName.trim() || undefined,
          workspaceNameSnapshot: uploadWorkspaceName.trim() || undefined,
          structuredData,
        },
      });
      showFeedback("success", res.message);
      setUploadModalOpen(false);
      setUploadTitle("");
      setUploadSummary("");
      setUploadDoctorName("");
      setUploadWorkspaceName("");
      setUploadMedName("");
      setUploadLabParam("");
      setUploadLabResult("");
      setUploadLabRef("");
      await Promise.all([loadCoreData(), loadVaultDocs()]);
    } catch (err: any) {
      showFeedback("error", err.message || "Unable to upload record.");
    } finally {
      setUploadSubmitting(false);
    }
  };

  const openBookAppointmentModal = (doc: any) => {
    setBookingError(null);
    setBookingDoctor(doc);
    const firstAff = doc.affiliations?.[0];
    const firstAffWs = firstAff?.workspaceId;
    setBookingWorkspaceId(firstAffWs || "INDEPENDENT_CHAMBER");
    const initialSlots: string[] = firstAffWs
      ? firstAff?.availableSlots?.length
        ? firstAff.availableSlots
        : ["05:00 PM", "06:00 PM", "07:00 PM", "08:00 PM"]
      : doc.independentSlots?.length
        ? doc.independentSlots
        : ["05:00 PM", "06:00 PM", "07:00 PM", "08:00 PM"];
    setBookingSlot(initialSlots[0] || "06:00 PM");
  };

  const handleBookAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingDoctor) return;
    if (!bookingDate) {
      setBookingError("Please select a preferred appointment date.");
      return;
    }
    setBookingError(null);
    setBookingSubmitting(true);
    try {
      const selectedWs =
        bookingWorkspaceId ||
        bookingDoctor.affiliations?.[0]?.workspaceId ||
        "INDEPENDENT_CHAMBER";
      const res = await apiRequest("/patient/appointments", {
        method: "POST",
        body: {
          doctorId: bookingDoctor.id,
          workspaceId: selectedWs,
          appointmentDate: bookingDate,
          timeSlot: bookingSlot,
          reason: bookingReason.trim() || "Specialist Consultation",
        },
      });
      showFeedback("success", res.message);
      setBookingDoctor(null);
      setBookingReason("");
      setBookingError(null);
      await loadCoreData();
    } catch (err: any) {
      const msg = err.message || "Unable to submit appointment request.";
      setBookingError(msg);
      showFeedback("error", msg);
    } finally {
      setBookingSubmitting(false);
    }
  };

  const handleCancelAppointment = async (appointmentId: string) => {
    try {
      const res = await apiRequest(
        `/patient/appointments/${appointmentId}/cancel`,
        {
          method: "PATCH",
          body: { reason: "Cancelled from Patient Dashboard" },
        },
      );
      showFeedback("success", res.message);
      await loadCoreData();
    } catch (err: any) {
      showFeedback("error", err.message || "Unable to cancel appointment.");
    }
  };

  const handleSendFamilyInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiRequest("/patient/family/invite", {
        method: "POST",
        body: {
          targetIdentifier: famTargetId,
          direction: famDirection,
          relationshipType: famType,
          relationshipLabel: famLabel,
        },
      });
      showFeedback("success", res.message);
      setFamTargetId("");
      setAddFamilyModalOpen(false);
      await Promise.all([loadCoreData(), refreshUserContext()]);
    } catch (err: any) {
      showFeedback("error", err.message);
    }
  };

  const handleToggleFamilyStatus = async (
    relId: string,
    status: "ACTIVE" | "REVOKED",
  ) => {
    try {
      const res = await apiRequest(`/patient/family/${relId}/status`, {
        method: "PATCH",
        body: { status },
      });
      showFeedback("success", res.message);
      await Promise.all([
        loadCoreData(),
        refreshUserContext(),
        refreshUnreadCount(),
      ]);
    } catch (err: any) {
      showFeedback("error", err.message);
    }
  };

  const handleRespondStaffInvite = async (
    memberId: string,
    action: "ACCEPT" | "REVOKE",
  ) => {
    try {
      const res = await apiRequest(
        `/patient/staff-invitations/${memberId}/respond`,
        {
          method: "PATCH",
          body: { action },
        },
      );
      showFeedback("success", res.message);
      await Promise.all([
        loadCoreData(),
        refreshUserContext(),
        refreshUnreadCount(),
      ]);
    } catch (err: any) {
      showFeedback("error", err.message);
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    try {
      await apiRequest("/notifications/read-all", {
        method: "POST",
        body: {
          actingPatientId: actingPatientId || undefined,
          persona: "PATIENT",
        },
      });
      await Promise.all([loadCoreData(), refreshUnreadCount()]);
    } catch (err: any) {
      showFeedback("error", err.message);
    }
  };

  const handleMarkOneRead = async (id: string) => {
    try {
      await apiRequest(`/notifications/${id}/read`, { method: "PATCH" });
      await Promise.all([loadCoreData(), refreshUnreadCount()]);
    } catch {
      // ignore
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiRequest("/patient/profile", {
        method: "PATCH",
        body: {
          name: profName,
          phone: profPhone,
          newPassword: profNewPassword || undefined,
          nationalId: profNid || undefined,
          bloodGroup: profBloodGroup,
          gender: profGender,
          dateOfBirth: profDob,
          emergencyContact: profEmergencyContact,
          address: profAddress,
          profileAvatar: profAvatar || undefined,
          secondaryEmails,
          secondaryPhones,
        },
      });
      showFeedback("success", res.message);
      setProfNewPassword("");
      await Promise.all([loadCoreData(), refreshUserContext()]);
    } catch (err: any) {
      showFeedback("error", err.message);
    }
  };

  const handleAvatarFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
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
        roleKind: "DEPENDENT" as const,
        personId: rel.dependent?.id,
        name: rel.dependent?.name,
        uniqueId: rel.dependent?.uniqueId,
        accountType: rel.dependent?.accountType || "CHILD",
        bloodGroup: rel.dependent?.bloodGroup || null,
        dateOfBirth: rel.dependent?.dateOfBirth || null,
        relationshipLabel: rel.relationshipLabel || "Dependent",
        status: rel.status,
        vaultCount: rel.dependent?._count?.vaultDocuments ?? 0,
        appointmentCount: rel.dependent?._count?.appointments ?? 0,
      }),
    );
    const maintainers = (familyData.managedByMaintainers || []).map(
      (rel: any) => ({
        id: rel.id,
        roleKind: "MAINTAINER" as const,
        personId: rel.maintainer?.id,
        name: rel.maintainer?.name,
        uniqueId: rel.maintainer?.uniqueId,
        accountType: "NORMAL",
        bloodGroup: null,
        dateOfBirth: null,
        relationshipLabel: `${rel.relationshipLabel || "Family"} (Maintainer)`,
        status: rel.status,
        vaultCount: null,
        appointmentCount: null,
      }),
    );
    return [...dependents, ...maintainers];
  }, [familyData]);

  // Filtered Appointments for Appointments Section
  const filteredAppointments = useMemo(() => {
    return appointments.filter((apt: any) => {
      if (aptStatusFilter === "UPCOMING") {
        if (!["PENDING", "APPROVED", "RESCHEDULED"].includes(apt.status)) {
          return false;
        }
      } else if (aptStatusFilter === "COMPLETED") {
        if (apt.status !== "COMPLETED") return false;
      } else if (aptStatusFilter === "CANCELLED") {
        if (apt.status !== "CANCELLED") return false;
      }

      if (aptSearch.trim()) {
        const q = aptSearch.trim().toLowerCase();
        const docName = (apt.doctor?.patientUser?.name || "").toLowerCase();
        const wsName = (
          apt.workspace?.name || "independent personal chamber"
        ).toLowerCase();
        const code = (apt.appointmentCode || "").toLowerCase();
        const reason = (apt.reason || "").toLowerCase();
        if (
          !docName.includes(q) &&
          !wsName.includes(q) &&
          !code.includes(q) &&
          !reason.includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [appointments, aptStatusFilter, aptSearch]);

  // Unified Notifications + Actionable Invitations Rows
  const unifiedNotificationRows = useMemo(() => {
    const rows: any[] = [];

    // 1. Actionable Hospital Staff Invitations (only when viewing own account)
    if (!actingPatientId) {
      for (const inv of staffInvites) {
        if (inv.invitationStatus === "PENDING") {
          rows.push({
            rowId: `staff-inv-${inv.id}`,
            kind: "STAFF_INVITE",
            isInvitation: true,
            isUnread: true,
            category: "Hospital Staff Invitation",
            title: `${inv.workspace?.name || "Hospital"} — Staff Role Invitation`,
            message: `Invited as ${
              inv.assignedRoles?.map((r: any) => r.role.name).join(", ") ||
              inv.staffTitle ||
              "Staff"
            }`,
            createdAt: inv.createdAt,
            memberId: inv.id,
          });
        }
      }
    }

    // 2. Actionable Pending Family Link Invitations
    for (const fam of unifiedFamilyRows) {
      if (fam.status === "PENDING") {
        rows.push({
          rowId: `fam-inv-${fam.id}`,
          kind: "FAMILY_INVITE",
          isInvitation: true,
          isUnread: true,
          category: "Family Invitation",
          title: `Family Account Link — ${fam.name} (${fam.uniqueId})`,
          message:
            fam.roleKind === "DEPENDENT"
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
        n.type === "STAFF_INVITATION" ||
        n.type === "FAMILY_INVITE" ||
        n.type === "FAMILY_INVITATION" ||
        n.type === "DOCTOR_AFFILIATION";
      rows.push({
        rowId: `notif-${n.id}`,
        notifId: n.id,
        kind: "NOTIFICATION",
        isInvitation: isInvType,
        isUnread: !n.isRead,
        category: n.type ? n.type.replace(/_/g, " ") : "Update",
        title: n.title,
        message: n.message,
        createdAt: n.createdAt,
      });
    }

    if (notifFilter === "INVITATIONS") {
      return rows.filter((r) => r.isInvitation);
    }
    if (notifFilter === "UNREAD") {
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
  const vaultSummary = dashboard?.vaultSummary;
  const activeMedications: any[] = vaultSummary?.activeMedications || [];
  const recentLabHighlights: any[] = vaultSummary?.recentLabHighlights || [];
  const recentActivityLogs: any[] = dashboard?.recentActivityLogs || [];

  const upcomingAppointmentsList = useMemo(
    () =>
      appointments.filter((a: any) =>
        ["PENDING", "APPROVED", "RESCHEDULED"].includes(a.status),
      ),
    [appointments],
  );

  // Selected chamber details in Request Appointment modal
  const selectedBookingChamber = useMemo(() => {
    if (!bookingDoctor) return null;
    if (!bookingWorkspaceId || bookingWorkspaceId === "INDEPENDENT_CHAMBER") {
      const indepSlots: string[] =
        Array.isArray(bookingDoctor.independentSlots) &&
        bookingDoctor.independentSlots.length > 0
          ? bookingDoctor.independentSlots
          : ["05:00 PM", "06:00 PM", "07:00 PM", "08:00 PM"];
      return {
        name: "Independent Personal Chamber",
        area: bookingDoctor.area || "Direct Consultation",
        fee: Number(bookingDoctor.defaultConsultationFee || 1000),
        schedule:
          bookingDoctor.independentSchedule ||
          "Sat, Mon, Wed: 5:00 PM - 9:00 PM",
        availableSlots: indepSlots,
        roomNumber: null,
      };
    }
    const found = (bookingDoctor.affiliations || []).find(
      (a: any) => a.workspaceId === bookingWorkspaceId,
    );
    if (!found) return null;
    const affSlots: string[] =
      Array.isArray(found.availableSlots) && found.availableSlots.length > 0
        ? found.availableSlots
        : ["05:00 PM", "06:00 PM", "07:00 PM", "08:00 PM"];
    return {
      name: found.workspaceName,
      area: found.area || "Hospital Chamber",
      fee: Number(found.consultationFee || 1000),
      schedule: found.schedule || "Standard Hours",
      availableSlots: affSlots,
      roomNumber: found.roomNumber || null,
    };
  }, [bookingDoctor, bookingWorkspaceId]);

  useEffect(() => {
    if (!selectedBookingChamber) return;
    const slots = selectedBookingChamber.availableSlots || [];
    if (slots.length > 0 && !slots.includes(bookingSlot)) {
      setBookingSlot(slots[0]);
    }
  }, [selectedBookingChamber, bookingSlot]);

  // Profile completeness calculation
  const profileCompleteness = useMemo(() => {
    if (!patient) return 100;
    const checks = [
      Boolean(patient.name),
      Boolean(patient.phone),
      Boolean(patient.bloodGroup),
      Boolean(patient.gender),
      Boolean(patient.dateOfBirth),
      Boolean(patient.nationalId),
      Boolean(patient.address),
      Boolean(patient.emergencyContact),
    ];
    const done = checks.filter(Boolean).length;
    return Math.round((done / checks.length) * 100);
  }, [patient]);

  const patientAge = calculateAgeFromDob(patient?.dateOfBirth);

  return (
    <div className="space-y-6">
      {/* Proxy Account Banner (Only when managing a Child or Senior Dependent) */}
      {actingPatientId && patient && (
        <div className="rounded-md bg-brand-50 border border-brand-200 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-2.5">
            <UserCheck className="w-4 h-4 text-brand-700 shrink-0" />
            <div>
              <span className="font-semibold text-brand-900">
                Managing Family Account:{" "}
              </span>
              <span className="text-brand-800 font-medium">
                {patient.name} ({patient.uniqueId})
              </span>
              {patient.accountType && (
                <span className="ml-2">
                  <StatusBadge label={patient.accountType} tone="brand" />
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActingPatientId(null)}
            className="btn-secondary !py-1"
          >
            Switch Back to My Account
          </button>
        </div>
      )}

      {/* Auto-Dismissing Feedback Notification */}
      <TransientToast
        notification={feedback}
        onDismiss={() => setFeedback(null)}
      />

      {/* =================================================================== */}
      {/* 1. OVERVIEW (CLEAN INSTITUTIONAL DASHBOARD)                         */}
      {/* =================================================================== */}
      {activeSection === "overview" && (
        <div className="space-y-6">
          {/* Clean Institutional Header */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-semibold text-ink">Overview</h1>
                {patient?.uniqueId && (
                  <span className="font-mono text-xs rounded bg-paper border border-line px-2 py-0.5 text-ink-2">
                    {patient.uniqueId}
                  </span>
                )}
                {patient?.accountType && patient.accountType !== "NORMAL" && (
                  <StatusBadge label={patient.accountType} tone="brand" />
                )}
              </div>
              <p className="text-sm text-mut mt-0.5">
                {patient?.name || "Patient Account"}
                {patient?.bloodGroup ? (
                  <>
                    {" · Blood "}
                    <span className="font-mono font-semibold text-brand-700">
                      {patient.bloodGroup}
                    </span>
                  </>
                ) : null}
                {patientAge ? ` · ${patientAge}` : ""}
                {patient?.phone ? (
                  <>
                    {" · "}
                    <span className="font-mono text-ink-2">
                      {patient.phone}
                    </span>
                  </>
                ) : null}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleGenerateQr(true)}
                className="btn-primary"
                title="Generate a 2-hour consultation QR sharing your clinical vault"
              >
                <QrCode className="w-4 h-4" />
                <span>Instant Consultation QR</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveSection("doctors")}
                className="btn-secondary"
              >
                <Calendar className="w-4 h-4" />
                <span>Book Doctor</span>
              </button>
              <button
                type="button"
                onClick={() => setUploadModalOpen(true)}
                className="btn-secondary"
              >
                <FilePlus2 className="w-4 h-4" />
                <span>Add Record</span>
              </button>
            </div>
          </div>

          {/* 4 KPI Stat Boxes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <button
              type="button"
              onClick={() => setActiveSection("records")}
              className="text-left bg-paper border border-line hover:border-brand-400 rounded-md p-4 transition-colors"
            >
              <div className="text-sm text-mut">Medical Vault Records</div>
              <div className="text-2xl font-semibold text-ink font-mono mt-1">
                {vaultSummary?.total ?? vaultDocs.length}
              </div>
              <div className="text-xs text-mut mt-1 font-mono">
                {vaultSummary
                  ? `${vaultSummary.prescriptions} Rx · ${vaultSummary.labReports} Lab · ${vaultSummary.billingDocs} Bills`
                  : "View & share records"}
              </div>
            </button>

            <button
              type="button"
              onClick={() => setActiveSection("appointments")}
              className="text-left bg-paper border border-line hover:border-brand-400 rounded-md p-4 transition-colors"
            >
              <div className="text-sm text-mut">Upcoming Appointments</div>
              <div className="text-2xl font-semibold text-ink font-mono mt-1">
                {upcomingAppointmentsList.length}
              </div>
              <div className="text-xs text-mut mt-1 truncate">
                {upcomingAppointmentsList[0]
                  ? `Next: ${upcomingAppointmentsList[0].appointmentDate} (${upcomingAppointmentsList[0].timeSlot})`
                  : "No active bookings"}
              </div>
            </button>

            <button
              type="button"
              onClick={() => setActiveSharesModalOpen(true)}
              className="text-left bg-paper border border-line hover:border-brand-400 rounded-md p-4 transition-colors"
            >
              <div className="text-sm text-mut">Active Shared QR</div>
              <div className="text-2xl font-semibold text-brand-700 font-mono mt-1">
                {activeQrSessions.length}
              </div>
              <div className="text-xs text-mut mt-1 font-mono">
                {activeQrSessions[0]
                  ? `${activeQrSessions[0].shortCode} · ${formatRemainingTime(activeQrSessions[0].expiresAt, nowTick)}`
                  : "No active 2h share"}
              </div>
            </button>

            <button
              type="button"
              onClick={() => setActiveSection("family")}
              className="text-left bg-paper border border-line hover:border-brand-400 rounded-md p-4 transition-colors"
            >
              <div className="text-sm text-mut">Family Accounts</div>
              <div className="text-2xl font-semibold text-ink font-mono mt-1">
                {unifiedFamilyRows.length}
              </div>
              <div className="text-xs text-mut mt-1">
                {actingPatientId
                  ? "Proxy session active"
                  : `${unifiedFamilyRows.filter((f) => f.status === "ACTIVE").length} active linked member(s)`}
              </div>
            </button>
          </div>

          {/* 1. Upcoming Appointments DataList */}
          <DataList
            title="Upcoming Appointments"
            data={upcomingAppointmentsList.slice(0, 5)}
            paginate={false}
            getRowId={(r: any) => r.id}
            emptyMessage="No upcoming appointments scheduled."
            headerActions={
              <button
                type="button"
                onClick={() => setActiveSection("appointments")}
                className="btn-secondary"
              >
                View All Appointments
              </button>
            }
            columns={[
              {
                key: "doctor",
                header: "Doctor",
                render: (apt: any) => (
                  <div>
                    <div className="font-semibold text-ink">
                      {apt.doctor?.patientUser?.name || "Specialist"}
                    </div>
                    <div className="text-xs text-mut">
                      {apt.doctor?.specialty}
                    </div>
                  </div>
                ),
              },
              {
                key: "facility",
                header: "Hospital / Chamber",
                render: (apt: any) => (
                  <div>
                    <div className="font-medium text-ink">
                      {apt.workspace?.name || "Independent Personal Chamber"}
                    </div>
                    <div className="text-xs text-mut font-mono">
                      Fee: {Number(apt.consultationFee || 0).toLocaleString()}{" "}
                      Tk
                      {apt.serialNumber ? ` · Serial #${apt.serialNumber}` : ""}
                    </div>
                  </div>
                ),
              },
              {
                key: "schedule",
                header: "Date & Configured Slot",
                render: (apt: any) => (
                  <span className="font-mono text-sm">
                    {apt.appointmentDate} · {apt.timeSlot}
                  </span>
                ),
              },
              {
                key: "status",
                header: "Status",
                render: (apt: any) => <StatusBadge label={apt.status} />,
              },
              {
                key: "actions",
                header: "Actions",
                align: "right",
                render: (apt: any) =>
                  ["PENDING", "APPROVED", "RESCHEDULED"].includes(
                    apt.status,
                  ) ? (
                    <button
                      type="button"
                      onClick={() => handleCancelAppointment(apt.id)}
                      className="btn-danger !px-2.5 !py-1 text-xs"
                    >
                      Cancel
                    </button>
                  ) : (
                    <span className="text-xs text-mut">—</span>
                  ),
              },
            ]}
          />

          {/* 2. Recent Medical Records DataList */}
          <DataList
            title="Recent Medical Records"
            data={(dashboard?.recentVaultDocs || vaultDocs).slice(0, 5)}
            paginate={false}
            getRowId={(r: any) => r.id}
            emptyMessage="No medical records in your account yet."
            headerActions={
              <button
                type="button"
                onClick={() => setActiveSection("records")}
                className="btn-secondary"
              >
                View All Records
              </button>
            }
            columns={[
              {
                key: "code",
                header: "Record Code",
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
                key: "title",
                header: "Title",
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
                key: "source",
                header: "Clinician / Facility",
                render: (doc: any) => (
                  <div className="text-sm">
                    <div>
                      {doc.doctor?.patientUser?.name ||
                        doc.doctorNameSnapshot ||
                        "Clinical Staff"}
                    </div>
                    <div className="text-xs text-mut">
                      {doc.workspace?.name ||
                        doc.workspaceNameSnapshot ||
                        "Independent Chamber"}
                    </div>
                  </div>
                ),
              },
              {
                key: "date",
                header: "Date",
                render: (doc: any) => (
                  <span className="font-mono text-sm text-mut">
                    {new Date(doc.createdAt).toLocaleDateString()}
                  </span>
                ),
              },
              {
                key: "actions",
                header: "Actions",
                align: "right",
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

          {/* 3. Hospital Health & Diagnostic Packages (Clean Institutional DataList) */}
          {(workspacesData?.featuredPackages?.length ?? 0) > 0 && (
            <DataList
              title="Hospital Health & Diagnostic Packages"
              subtitle="Preventive checkup packages offered by DGHS-approved hospitals and diagnostic centers."
              data={workspacesData.featuredPackages.slice(0, 4)}
              paginate={false}
              getRowId={(pkg: any) => pkg.id}
              emptyMessage="No active health packages available."
              headerActions={
                <button
                  type="button"
                  onClick={() => setActiveSection("hospitals")}
                  className="btn-secondary"
                >
                  View All Packages ({workspacesData.featuredPackages.length})
                </button>
              }
              columns={[
                {
                  key: "package",
                  header: "Package Name",
                  render: (pkg: any) => (
                    <div>
                      <div className="font-semibold text-ink">{pkg.title}</div>
                      <div className="text-xs text-mut">
                        {pkg.durationLabel || "Same Day Delivery"}
                        {pkg.packageCode ? ` · ${pkg.packageCode}` : ""}
                      </div>
                    </div>
                  ),
                },
                {
                  key: "facility",
                  header: "Hospital / Facility",
                  render: (pkg: any) => (
                    <div>
                      <div className="font-medium text-ink">
                        {pkg.workspace?.name || "Registered Facility"}
                      </div>
                      {pkg.workspace?.area && (
                        <div className="text-xs text-mut">
                          {pkg.workspace.area}
                        </div>
                      )}
                    </div>
                  ),
                },
                {
                  key: "tests",
                  header: "Included Investigations",
                  render: (pkg: any) => {
                    const tests: string[] = Array.isArray(pkg.includedTests)
                      ? pkg.includedTests
                      : [];
                    return (
                      <div className="text-xs text-ink-2 max-w-md">
                        <span className="font-mono font-semibold text-brand-700">
                          {tests.length || 1} Tests:
                        </span>{" "}
                        {tests.slice(0, 4).join(", ")}
                        {tests.length > 4 ? ` (+${tests.length - 4} more)` : ""}
                      </div>
                    );
                  },
                },
                {
                  key: "price",
                  header: "Package Fee",
                  render: (pkg: any) => {
                    const price = Number(pkg.price || 0);
                    const orig = Number(pkg.originalPrice || 0);
                    return (
                      <div className="font-mono">
                        <div className="font-semibold text-brand-700">
                          {price.toLocaleString()} Tk
                        </div>
                        {orig > price && (
                          <div className="text-xs text-mut line-through">
                            {orig.toLocaleString()} Tk
                          </div>
                        )}
                      </div>
                    );
                  },
                },
                {
                  key: "actions",
                  header: "Actions",
                  align: "right",
                  render: (pkg: any) => (
                    <div className="inline-flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => setInspectedPackage(pkg)}
                        className="btn-secondary !px-2.5 !py-1 text-xs"
                      >
                        Details
                      </button>
                      {pkg.workspace?.name && (
                        <button
                          type="button"
                          onClick={() => {
                            setDocWorkspaceFilter(pkg.workspace.name);
                            setActiveSection("doctors");
                          }}
                          className="btn-primary !px-2.5 !py-1 text-xs"
                        >
                          Doctors
                        </button>
                      )}
                    </div>
                  ),
                },
              ]}
            />
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* 2. MEDICAL RECORDS (SELECTABLE LIST + GENERATE QR POPUP + UPLOAD)   */}
      {/* =================================================================== */}
      {activeSection === "records" && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-ink">
                Medical Records
              </h1>
              <p className="text-sm text-mut mt-0.5">
                Select specific records or generate an instant 2-hour
                consultation QR code for your doctor, upload external records,
                or download official PDFs.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setUploadModalOpen(true)}
              className="btn-secondary"
            >
              <FilePlus2 className="w-4 h-4" />
              <span>Add External Record</span>
            </button>
          </div>

          {/* Quick Type Filter Pills */}
          <div className="flex flex-wrap items-center gap-2">
            {[
              {
                value: "",
                label: `All Records (${vaultSummary?.total ?? vaultDocs.length})`,
              },
              {
                value: "PRESCRIPTION",
                label: `Prescriptions (${vaultSummary?.prescriptions ?? vaultDocs.filter((d) => d.type === "PRESCRIPTION").length})`,
              },
              {
                value: "LAB_REPORT",
                label: `Lab Reports (${vaultSummary?.labReports ?? vaultDocs.filter((d) => d.type === "LAB_REPORT").length})`,
              },
              {
                value: "BILLING_DOC",
                label: `Billing Invoices (${vaultSummary?.billingDocs ?? vaultDocs.filter((d) => d.type === "BILLING_DOC").length})`,
              },
            ].map((pill) => (
              <button
                key={pill.value}
                type="button"
                onClick={() => setVaultTypeFilter(pill.value)}
                className={
                  vaultTypeFilter === pill.value
                    ? "btn-primary !py-1.5 text-xs"
                    : "btn-secondary !py-1.5 text-xs"
                }
              >
                {pill.label}
              </button>
            ))}
          </div>

          <DataList
            title={`Vault Documents (${vaultDocs.length})`}
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
                        selectedDocIds.length < vaultDocs.length,
                      )
                    }
                    className="btn-secondary"
                  >
                    {selectedDocIds.length === vaultDocs.length &&
                    vaultDocs.length > 0
                      ? "Clear Selection"
                      : "Select All"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleGenerateQr(selectedDocIds.length === 0)}
                  className="btn-primary"
                >
                  <QrCode className="w-4 h-4" />
                  <span>
                    {selectedDocIds.length > 0
                      ? `Generate QR (${selectedDocIds.length} Selected)`
                      : "Share All / Consultation QR"}
                  </span>
                </button>
              </>
            }
            toolbar={
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                <input
                  type="search"
                  value={vaultSearch}
                  onChange={(e) => setVaultSearch(e.target.value)}
                  placeholder="Search title, code, summary..."
                  className="rounded-md border border-line bg-paper px-3 py-1.5 text-sm text-ink"
                />
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
                key: "type",
                header: "Type & Code",
                render: (doc: any) => (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1">
                      <StatusBadge label={doc.type} />
                      {doc.isImmutable && (
                        <StatusBadge label="Verified" tone="brand" />
                      )}
                    </div>
                    <div className="font-mono text-xs text-mut">
                      {doc.documentCode}
                    </div>
                  </div>
                ),
              },
              {
                key: "title",
                header: "Document Title",
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
                key: "doctor",
                header: "Doctor",
                render: (doc: any) => (
                  <span>
                    {doc.doctor?.patientUser?.name ||
                      doc.doctorNameSnapshot ||
                      "—"}
                  </span>
                ),
              },
              {
                key: "facility",
                header: "Facility",
                render: (doc: any) => (
                  <span>
                    {doc.workspace?.name ||
                      doc.workspaceNameSnapshot ||
                      "Independent Chamber"}
                  </span>
                ),
              },
              {
                key: "date",
                header: "Issued Date",
                render: (doc: any) => (
                  <span className="font-mono text-sm text-mut">
                    {new Date(doc.createdAt).toLocaleDateString()}
                  </span>
                ),
              },
              {
                key: "actions",
                header: "Actions",
                align: "right",
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
      {activeSection === "doctors" && (
        <div className="space-y-5">
          <div>
            <h1 className="text-2xl font-semibold text-ink">Doctors</h1>
            <p className="text-sm text-mut mt-0.5">
              Browse DGHS-verified specialists, consultation fee ranges, and
              available hospital chambers.
            </p>
          </div>

          {/* Quick Specialty Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              "",
              "Cardiology",
              "Gynecology",
              "Orthopedics",
              "Neurology",
              "Pediatrics",
              "General Medicine",
            ].map((spec) => (
              <button
                key={spec || "ALL"}
                type="button"
                onClick={() => setDocSpecialtyFilter(spec)}
                className={
                  docSpecialtyFilter === spec
                    ? "btn-primary !py-1 text-xs"
                    : "btn-secondary !py-1 text-xs"
                }
              >
                {spec || "All Specialties"}
              </button>
            ))}
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
                  placeholder="Search doctor name or ID..."
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
                key: "doctor",
                header: "Doctor",
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
                          ? doc.degrees.join(", ")
                          : "Registered Physician"}
                        {doc.experienceYears
                          ? ` · ${doc.experienceYears} yrs exp`
                          : ""}
                      </div>
                      {doc.customHeadline && (
                        <div className="text-xs text-brand-700 font-medium mt-0.5">
                          {doc.customHeadline}
                        </div>
                      )}
                    </div>
                  </div>
                ),
              },
              {
                key: "specialty",
                header: "Specialty",
                render: (doc: any) => (
                  <div className="space-y-1">
                    <StatusBadge label={doc.specialty} tone="brand" />
                    <div className="font-mono text-xs text-mut">
                      {doc.doctorIdCode}
                    </div>
                  </div>
                ),
              },
              {
                key: "locations",
                header: "Available Locations",
                render: (doc: any) => {
                  const affs = doc.affiliations || [];
                  if (affs.length === 0) {
                    return (
                      <span className="text-sm text-mut">
                        {doc.area || "Independent Chamber"}
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
                              {" "}
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
                key: "feeRange",
                header: "Consultation Fee",
                render: (doc: any) => (
                  <span className="font-mono font-semibold text-brand-700">
                    {computeDoctorFeeRange(doc)}
                  </span>
                ),
              },
              {
                key: "actions",
                header: "Actions",
                align: "right",
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
      {/* 4. APPOINTMENTS (STATUS FILTERS + FEE + SERIAL + CANCEL ACTION)     */}
      {/* =================================================================== */}
      {activeSection === "appointments" && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-ink">Appointments</h1>
              <p className="text-sm text-mut mt-0.5">
                Track all requested, confirmed, and completed hospital or
                chamber consultations.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveSection("doctors")}
              className="btn-primary"
            >
              Request New Appointment
            </button>
          </div>

          <DataList
            title={`Appointments (${filteredAppointments.length})`}
            data={filteredAppointments}
            getRowId={(a: any) => a.id}
            emptyMessage="No appointments match your current filter."
            toolbar={
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  {(
                    [
                      { id: "ALL", label: `All (${appointments.length})` },
                      {
                        id: "UPCOMING",
                        label: `Upcoming (${upcomingAppointmentsList.length})`,
                      },
                      {
                        id: "COMPLETED",
                        label: `Completed (${appointments.filter((a) => a.status === "COMPLETED").length})`,
                      },
                      {
                        id: "CANCELLED",
                        label: `Cancelled (${appointments.filter((a) => a.status === "CANCELLED").length})`,
                      },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setAptStatusFilter(tab.id)}
                      className={
                        aptStatusFilter === tab.id
                          ? "btn-primary !py-1 text-xs"
                          : "btn-secondary !py-1 text-xs"
                      }
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                <input
                  type="search"
                  value={aptSearch}
                  onChange={(e) => setAptSearch(e.target.value)}
                  placeholder="Search doctor, hospital, or code..."
                  className="rounded-md border border-line bg-paper px-3 py-1.5 text-sm text-ink min-w-[240px]"
                />
              </div>
            }
            columns={[
              {
                key: "code",
                header: "Booking Code",
                render: (apt: any) => (
                  <div className="space-y-0.5">
                    <div className="font-mono text-xs text-ink-2">
                      {apt.appointmentCode}
                    </div>
                    {apt.reason && (
                      <div className="text-xs text-mut max-w-[180px] truncate">
                        {apt.reason}
                      </div>
                    )}
                  </div>
                ),
              },
              {
                key: "doctor",
                header: "Doctor",
                render: (apt: any) => (
                  <div>
                    <div className="font-medium text-ink">
                      {apt.doctor?.patientUser?.name || "—"}
                    </div>
                    <div className="text-xs text-mut">
                      {apt.doctor?.specialty}
                    </div>
                  </div>
                ),
              },
              {
                key: "hospital",
                header: "Hospital / Chamber",
                render: (apt: any) => (
                  <div>
                    <div className="font-medium text-ink">
                      {apt.workspace?.name || "Independent Personal Chamber"}
                    </div>
                    <div className="text-xs text-mut">
                      {apt.workspace?.area ||
                        apt.doctor?.area ||
                        "Direct Chamber"}
                    </div>
                  </div>
                ),
              },
              {
                key: "schedule",
                header: "Date & Slot",
                render: (apt: any) => (
                  <span className="font-mono text-sm">
                    {apt.appointmentDate} · {apt.timeSlot}
                  </span>
                ),
              },
              {
                key: "feeAndSerial",
                header: "Fee & Serial",
                render: (apt: any) => (
                  <div className="font-mono text-xs space-y-0.5">
                    <div className="font-semibold text-brand-700">
                      {Number(apt.consultationFee || 0).toLocaleString()} Tk
                    </div>
                    <div className="text-mut">
                      {apt.serialNumber
                        ? `Serial #${apt.serialNumber}`
                        : "Serial Pending"}
                    </div>
                  </div>
                ),
              },
              {
                key: "status",
                header: "Status",
                render: (apt: any) => <StatusBadge label={apt.status} />,
              },
              {
                key: "actions",
                header: "Actions",
                align: "right",
                render: (apt: any) =>
                  ["PENDING", "APPROVED", "RESCHEDULED"].includes(
                    apt.status,
                  ) ? (
                    <button
                      type="button"
                      onClick={() => handleCancelAppointment(apt.id)}
                      className="btn-danger !px-2.5 !py-1 text-xs"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Cancel</span>
                    </button>
                  ) : (
                    <span className="text-xs text-mut">Closed</span>
                  ),
              },
            ]}
          />
        </div>
      )}

      {/* =================================================================== */}
      {/* 5. HOSPITALS & PACKAGES (CLEAN UNIFIED DATALISTS)                   */}
      {/* =================================================================== */}
      {activeSection === "hospitals" && (
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

          <DataList
            title={`Health & Diagnostic Packages (${workspacesData?.featuredPackages?.length || 0})`}
            data={workspacesData?.featuredPackages || []}
            getRowId={(pkg: any) => pkg.id}
            emptyMessage="No active health packages match your current filters."
            columns={[
              {
                key: "package",
                header: "Package Name",
                render: (pkg: any) => (
                  <div>
                    <div className="font-semibold text-ink">{pkg.title}</div>
                    <div className="font-mono text-xs text-mut">
                      {pkg.packageCode || "CHECKUP"} ·{" "}
                      {pkg.durationLabel || "Same Day"}
                    </div>
                  </div>
                ),
              },
              {
                key: "hospital",
                header: "Hospital / Facility",
                render: (pkg: any) => (
                  <div>
                    <div className="text-sm font-medium text-ink">
                      {pkg.workspace?.name || "Registered Facility"}
                    </div>
                    <div className="text-xs text-mut">
                      {pkg.workspace?.area || "Standard Care"}
                    </div>
                  </div>
                ),
              },
              {
                key: "tests",
                header: "Included Investigations",
                render: (pkg: any) => {
                  const tests: string[] = Array.isArray(pkg.includedTests)
                    ? pkg.includedTests
                    : [];
                  return (
                    <div className="max-w-md">
                      <span className="inline-block rounded bg-paper-2 border border-line px-1.5 py-0.5 font-mono text-[11px] font-medium text-ink-2 mr-1.5">
                        {tests.length || 1} Tests
                      </span>
                      <span className="text-xs text-mut">
                        {tests.slice(0, 3).join(", ")}
                        {tests.length > 3 ? ` +${tests.length - 3} more` : ""}
                      </span>
                    </div>
                  );
                },
              },
              {
                key: "price",
                header: "Package Fee",
                render: (pkg: any) => {
                  const price = Number(pkg.price || 0);
                  const originalPrice = Number(pkg.originalPrice || 0);
                  return (
                    <div className="font-mono">
                      <div className="text-sm font-semibold text-brand-700">
                        {price.toLocaleString()} Tk
                      </div>
                      {originalPrice > price && (
                        <div className="text-[11px] text-mut line-through">
                          {originalPrice.toLocaleString()} Tk
                        </div>
                      )}
                    </div>
                  );
                },
              },
              {
                key: "actions",
                header: "Actions",
                align: "right",
                render: (pkg: any) => (
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => setInspectedPackage(pkg)}
                      className="btn-secondary !px-2.5 !py-1 text-xs"
                    >
                      Details
                    </button>
                    {pkg.workspace?.name && (
                      <button
                        type="button"
                        onClick={() => {
                          setDocWorkspaceFilter(pkg.workspace.name);
                          setActiveSection("doctors");
                        }}
                        className="btn-primary !px-2.5 !py-1 text-xs"
                      >
                        Doctors
                      </button>
                    )}
                  </div>
                ),
              },
            ]}
          />

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
                key: "name",
                header: "Facility",
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
                key: "type",
                header: "Category",
                render: (ws: any) => <StatusBadge label={ws.type} />,
              },
              {
                key: "location",
                header: "Area & Address",
                render: (ws: any) => (
                  <div className="text-sm">
                    <div className="font-medium text-ink">{ws.area}</div>
                    <div className="text-xs text-mut">{ws.address}</div>
                  </div>
                ),
              },
              {
                key: "depts",
                header: "Departments",
                render: (ws: any) => (
                  <div className="text-xs text-ink-2 max-w-sm">
                    {(ws.departments || []).join(", ") || "General Care"}
                  </div>
                ),
              },
              {
                key: "actions",
                header: "Contact & Doctors",
                align: "right",
                render: (ws: any) => (
                  <div className="inline-flex items-center justify-end gap-2">
                    <span className="font-mono text-xs text-mut">
                      {ws.phone || "—"}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setDocWorkspaceFilter(ws.name);
                        setActiveSection("doctors");
                      }}
                      className="btn-secondary !px-2.5 !py-1 text-xs"
                    >
                      Doctors ({ws.doctorAffiliations?.length || 0})
                    </button>
                  </div>
                ),
              },
            ]}
          />
        </div>
      )}

      {/* =================================================================== */}
      {/* 6. FAMILY (ACCOUNT SWITCHER CARDS + LIST + ADD MEMBER POPUP)        */}
      {/* =================================================================== */}
      {activeSection === "family" && (
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

          {/* Active Dependent Proxy Switcher Cards */}
          {unifiedFamilyRows.some(
            (r) => r.roleKind === "DEPENDENT" && r.status === "ACTIVE",
          ) && (
            <section className="space-y-2.5">
              <h2 className="text-sm font-semibold text-ink-2">
                Quick Proxy Account Switcher
              </h2>
              <div className="family-card-grid">
                {unifiedFamilyRows
                  .filter(
                    (r) => r.roleKind === "DEPENDENT" && r.status === "ACTIVE",
                  )
                  .map((dep) => {
                    const isCurrentlyManaging =
                      actingPatientId === dep.personId;
                    return (
                      <article
                        key={dep.id}
                        className={`family-card ${
                          isCurrentlyManaging
                            ? "!border-brand-700 !bg-brand-50/50"
                            : ""
                        }`}
                      >
                        <header className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="text-sm font-semibold text-ink">
                              {dep.name}
                            </h3>
                            <div className="font-mono text-xs text-mut">
                              {dep.uniqueId}
                            </div>
                          </div>
                          <StatusBadge label={dep.accountType} tone="brand" />
                        </header>
                        <div className="text-xs text-mut space-y-1">
                          <div>
                            Relation:{" "}
                            <strong className="text-ink-2">
                              {dep.relationshipLabel}
                            </strong>
                            {dep.bloodGroup ? ` · Blood ${dep.bloodGroup}` : ""}
                          </div>
                          <div className="font-mono">
                            {dep.vaultCount ?? 0} Vault Record(s) ·{" "}
                            {dep.appointmentCount ?? 0} Appointment(s)
                          </div>
                        </div>
                        <footer className="pt-2 border-t border-line flex justify-end">
                          {isCurrentlyManaging ? (
                            <button
                              type="button"
                              onClick={() => setActingPatientId(null)}
                              className="btn-secondary !px-2.5 !py-1 text-xs"
                            >
                              Switch Back to Myself
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setActingPatientId(dep.personId);
                                setActiveSection("overview");
                              }}
                              className="btn-primary !px-2.5 !py-1 text-xs"
                            >
                              Switch to Account
                            </button>
                          )}
                        </footer>
                      </article>
                    );
                  })}
              </div>
            </section>
          )}

          <DataList
            title={`Family Members (${unifiedFamilyRows.length})`}
            data={unifiedFamilyRows}
            getRowId={(r: any) => `${r.roleKind}-${r.id}`}
            emptyMessage="No family members linked yet. Click Add Member to link a child or senior account."
            columns={[
              {
                key: "member",
                header: "Family Member",
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
                key: "category",
                header: "Account Type",
                render: (row: any) => <StatusBadge label={row.accountType} />,
              },
              {
                key: "relation",
                header: "Relationship",
                render: (row: any) => (
                  <div>
                    <div className="text-sm text-ink-2">
                      {row.relationshipLabel}
                    </div>
                    {row.vaultCount !== null && (
                      <div className="text-xs text-mut font-mono">
                        {row.vaultCount} records · {row.appointmentCount ?? 0}{" "}
                        appointments
                      </div>
                    )}
                  </div>
                ),
              },
              {
                key: "status",
                header: "Status",
                render: (row: any) => <StatusBadge label={row.status} />,
              },
              {
                key: "actions",
                header: "Actions",
                align: "right",
                render: (row: any) => (
                  <div className="inline-flex items-center justify-end gap-1.5">
                    {row.roleKind === "DEPENDENT" &&
                      row.status === "ACTIVE" && (
                        <button
                          type="button"
                          onClick={() => {
                            setActingPatientId(row.personId);
                            setActiveSection("overview");
                          }}
                          className="btn-primary !px-2.5 !py-1"
                        >
                          Manage Account
                        </button>
                      )}
                    {row.status !== "ACTIVE" ? (
                      <button
                        type="button"
                        onClick={() =>
                          handleToggleFamilyStatus(row.id, "ACTIVE")
                        }
                        className="btn-primary !px-2.5 !py-1"
                      >
                        Accept
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          handleToggleFamilyStatus(row.id, "REVOKED")
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
      {activeSection === "notifications" && (
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
                {(["ALL", "INVITATIONS", "UNREAD"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setNotifFilter(tab)}
                    className={
                      notifFilter === tab ? "btn-primary" : "btn-secondary"
                    }
                  >
                    {tab === "ALL"
                      ? "All"
                      : tab === "INVITATIONS"
                        ? "Invitations"
                        : "Unread"}
                  </button>
                ))}
              </div>
            }
            columns={[
              {
                key: "category",
                header: "Type",
                render: (row: any) => (
                  <StatusBadge
                    label={row.isInvitation ? "Invitation" : row.category}
                    tone={
                      row.isInvitation
                        ? "warning"
                        : row.isUnread
                          ? "brand"
                          : "neutral"
                    }
                  />
                ),
              },
              {
                key: "details",
                header: "Details",
                render: (row: any) => (
                  <div>
                    <div
                      className={`${
                        row.isUnread ? "font-semibold" : "font-medium"
                      } text-ink`}
                    >
                      {row.title}
                    </div>
                    <div className="text-sm text-mut mt-0.5">{row.message}</div>
                  </div>
                ),
              },
              {
                key: "time",
                header: "Received",
                render: (row: any) => (
                  <span className="font-mono text-xs text-mut">
                    {new Date(row.createdAt).toLocaleString()}
                  </span>
                ),
              },
              {
                key: "actions",
                header: "Actions",
                align: "right",
                render: (row: any) => {
                  if (row.kind === "STAFF_INVITE") {
                    return (
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            handleRespondStaffInvite(row.memberId, "ACCEPT")
                          }
                          className="btn-primary !px-2.5 !py-1"
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleRespondStaffInvite(row.memberId, "REVOKE")
                          }
                          className="btn-danger !px-2.5 !py-1"
                        >
                          Revoke
                        </button>
                      </div>
                    );
                  }
                  if (row.kind === "FAMILY_INVITE") {
                    return (
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            handleToggleFamilyStatus(row.relId, "ACTIVE")
                          }
                          className="btn-primary !px-2.5 !py-1"
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleToggleFamilyStatus(row.relId, "REVOKED")
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
      {/* 8. PROFILE (PERSONAL & CLINICAL DEMOGRAPHICS — CENTERED)            */}
      {/* =================================================================== */}
      {activeSection === "profile" && (
        <div className="mx-auto w-full max-w-3xl space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-ink">Profile</h1>
              <p className="text-sm text-mut mt-0.5">
                Update your personal demographics, emergency triage details,
                contact numbers, and security credentials.
              </p>
            </div>
            {patient && (
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs rounded bg-paper border border-line px-2.5 py-1 text-ink-2">
                  {patient.uniqueId}
                </span>
                <StatusBadge
                  label={`${profileCompleteness}% Complete`}
                  tone={profileCompleteness === 100 ? "success" : "brand"}
                />
              </div>
            )}
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
                  {profName?.[0] || "P"}
                </div>
              )}
              <div>
                <label
                  htmlFor="prof-avatar-upload"
                  className="block text-sm font-medium text-ink-2 mb-1"
                >
                  Profile Photo
                </label>
                <input
                  id="prof-avatar-upload"
                  name="profileAvatar"
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarFileUpload}
                  className="text-sm text-mut"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="prof-full-name"
                  className="block text-sm font-medium text-ink-2 mb-1"
                >
                  Full Name <span aria-hidden="true">*</span>
                </label>
                <input
                  id="prof-full-name"
                  name="name"
                  type="text"
                  required
                  autoComplete="name"
                  value={profName}
                  onChange={(e) => setProfName(e.target.value)}
                  className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base text-ink"
                />
                <div className="error-msg">Please enter your full name.</div>
              </div>
              <div>
                <label
                  htmlFor="prof-phone"
                  className="block text-sm font-medium text-ink-2 mb-1"
                >
                  Primary Phone <span aria-hidden="true">*</span>
                </label>
                <input
                  id="prof-phone"
                  name="phone"
                  type="tel"
                  required
                  autoComplete="tel"
                  value={profPhone}
                  onChange={(e) => setProfPhone(e.target.value)}
                  className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base font-mono text-ink"
                />
                <div className="error-msg">
                  Please provide a valid contact phone number.
                </div>
              </div>
            </div>

            {/* Clinical Demographics: Blood Group, Gender, Date of Birth */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label
                  htmlFor="prof-blood-group"
                  className="block text-sm font-medium text-ink-2 mb-1"
                >
                  Blood Group
                </label>
                <select
                  id="prof-blood-group"
                  name="bloodGroup"
                  value={profBloodGroup}
                  onChange={(e) => setProfBloodGroup(e.target.value)}
                  className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base text-ink"
                >
                  <option value="">Select Blood Group</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                </select>
              </div>
              <div>
                <label
                  htmlFor="prof-gender"
                  className="block text-sm font-medium text-ink-2 mb-1"
                >
                  Gender
                </label>
                <select
                  id="prof-gender"
                  name="gender"
                  value={profGender}
                  onChange={(e) => setProfGender(e.target.value)}
                  className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base text-ink"
                >
                  <option value="">Select Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label
                  htmlFor="prof-dob"
                  className="block text-sm font-medium text-ink-2 mb-1"
                >
                  Date of Birth
                </label>
                <input
                  id="prof-dob"
                  name="dateOfBirth"
                  type="date"
                  autoComplete="bday"
                  value={profDob}
                  onChange={(e) => setProfDob(e.target.value)}
                  className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base font-mono text-ink"
                />
              </div>
            </div>

            {/* Emergency Contact & National ID & Password */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label
                  htmlFor="prof-emergency"
                  className="block text-sm font-medium text-ink-2 mb-1"
                >
                  Emergency Contact
                </label>
                <span className="field-hint">
                  Name & phone for hospital triage
                </span>
                <input
                  id="prof-emergency"
                  name="emergencyContact"
                  type="text"
                  value={profEmergencyContact}
                  onChange={(e) => setProfEmergencyContact(e.target.value)}
                  placeholder="Spouse / Parent +88017..."
                  className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base text-ink"
                />
              </div>
              <div>
                <label
                  htmlFor="prof-nid"
                  className="block text-sm font-medium text-ink-2 mb-1"
                >
                  National ID
                </label>
                <span className="field-hint">10 to 17 digit NID number</span>
                <input
                  id="prof-nid"
                  name="nationalId"
                  type="text"
                  inputMode="numeric"
                  autoCorrect="off"
                  spellCheck={false}
                  value={profNid}
                  onChange={(e) => setProfNid(e.target.value)}
                  className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base font-mono text-ink"
                />
              </div>
              <div>
                <label
                  htmlFor="prof-new-password"
                  className="block text-sm font-medium text-ink-2 mb-1"
                >
                  New Password (Optional)
                </label>
                <span className="field-hint">
                  At least 6 characters (blank to keep)
                </span>
                <input
                  id="prof-new-password"
                  name="newPassword"
                  type="password"
                  minLength={6}
                  autoComplete="new-password"
                  value={profNewPassword}
                  onChange={(e) => setProfNewPassword(e.target.value)}
                  placeholder="Leave blank to keep"
                  className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base text-ink"
                />
                <div className="error-msg">
                  Password must be at least 6 characters long.
                </div>
              </div>
            </div>

            <div>
              <label
                htmlFor="prof-address"
                className="block text-sm font-medium text-ink-2 mb-1"
              >
                Residential Address
              </label>
              <input
                id="prof-address"
                name="address"
                type="text"
                autoComplete="street-address"
                value={profAddress}
                onChange={(e) => setProfAddress(e.target.value)}
                className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base text-ink"
              />
            </div>

            {/* Secondary Emails & Phones */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-line">
              <div className="space-y-2">
                <label
                  htmlFor="prof-sec-email"
                  className="block text-sm font-medium text-ink-2"
                >
                  Additional Emails
                </label>
                <div className="flex gap-2">
                  <input
                    id="prof-sec-email"
                    type="email"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
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
                        setNewSecEmail("");
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
                          prev.filter((_, i) => i !== idx),
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
                <label
                  htmlFor="prof-sec-phone"
                  className="block text-sm font-medium text-ink-2"
                >
                  Additional Phone Numbers
                </label>
                <div className="flex gap-2">
                  <input
                    id="prof-sec-phone"
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
                        setNewSecPhone("");
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
                          prev.filter((_, i) => i !== idx),
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

      {/* 1b. Health Package Details Modal */}
      <ModalDialog
        open={Boolean(inspectedPackage)}
        onClose={() => setInspectedPackage(null)}
        title={inspectedPackage?.title || "Health Package Details"}
        subtitle={
          inspectedPackage?.workspace?.name
            ? `${inspectedPackage.workspace.name} (${inspectedPackage.workspace.area || "Facility"})`
            : undefined
        }
      >
        {inspectedPackage && (
          <div className="space-y-4 text-sm">
            {inspectedPackage.tagline && (
              <div className="rounded-md bg-brand-50 border border-brand-200 px-3 py-2 text-xs font-medium text-brand-800">
                {inspectedPackage.tagline}
              </div>
            )}
            <p className="text-ink-2">{inspectedPackage.description}</p>
            <div>
              <div className="text-xs font-semibold text-mut mb-1.5">
                Included Diagnostic Tests (
                {inspectedPackage.includedTests?.length || 0})
              </div>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {(inspectedPackage.includedTests || []).map(
                  (t: string, idx: number) => (
                    <li
                      key={idx}
                      className="rounded border border-line bg-paper-2 px-2.5 py-1 text-xs text-ink"
                    >
                      • {t}
                    </li>
                  ),
                )}
              </ul>
            </div>
            <div className="rounded-md border border-line bg-paper-2 p-3 flex items-center justify-between">
              <div>
                <div className="text-xs text-mut">Package Price</div>
                <div className="font-mono text-lg font-semibold text-brand-700">
                  {Number(inspectedPackage.price || 0).toLocaleString()} Tk
                </div>
              </div>
              <div className="text-right text-xs text-mut">
                <div>
                  {inspectedPackage.durationLabel || "Standard Delivery"}
                </div>
                {inspectedPackage.workspace?.phone && (
                  <div className="font-mono text-ink-2 mt-0.5">
                    Contact: {inspectedPackage.workspace.phone}
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setInspectedPackage(null)}
                className="btn-secondary"
              >
                Close
              </button>
              {inspectedPackage.workspace?.name && (
                <button
                  type="button"
                  onClick={() => {
                    const name = inspectedPackage.workspace.name;
                    setInspectedPackage(null);
                    setDocWorkspaceFilter(name);
                    setActiveSection("doctors");
                  }}
                  className="btn-primary"
                >
                  View Facility Doctors
                </button>
              )}
            </div>
          </div>
        )}
      </ModalDialog>

      {/* 1c. Self-Upload Historical / External Record Modal */}
      <ModalDialog
        open={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        title="Add External Medical Record"
        subtitle="Log a historical prescription, external diagnostic report, or billing receipt into your clinical Vault."
      >
        <form onSubmit={handleSelfUploadRecord} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="upload-type"
                className="block text-sm font-medium text-ink-2 mb-1"
              >
                Record Category
              </label>
              <select
                id="upload-type"
                value={uploadType}
                onChange={(e) =>
                  setUploadType(
                    e.target.value as
                      | "PRESCRIPTION"
                      | "LAB_REPORT"
                      | "BILLING_DOC",
                  )
                }
                className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base text-ink"
              >
                <option value="PRESCRIPTION">Prescription</option>
                <option value="LAB_REPORT">Laboratory Report</option>
                <option value="BILLING_DOC">Billing Invoice</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="upload-title"
                className="block text-sm font-medium text-ink-2 mb-1"
              >
                Document Title <span aria-hidden="true">*</span>
              </label>
              <input
                id="upload-title"
                type="text"
                required
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                placeholder="e.g. Cardiology Follow-up or Lipid Panel"
                className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base text-ink"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="upload-doc-name"
                className="block text-sm font-medium text-ink-2 mb-1"
              >
                Clinician / Doctor Name
              </label>
              <input
                id="upload-doc-name"
                type="text"
                value={uploadDoctorName}
                onChange={(e) => setUploadDoctorName(e.target.value)}
                placeholder="e.g. Dr. Mahmudul Hasan"
                className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base text-ink"
              />
            </div>
            <div>
              <label
                htmlFor="upload-ws-name"
                className="block text-sm font-medium text-ink-2 mb-1"
              >
                Hospital / Diagnostic Center
              </label>
              <input
                id="upload-ws-name"
                type="text"
                value={uploadWorkspaceName}
                onChange={(e) => setUploadWorkspaceName(e.target.value)}
                placeholder="e.g. Popular Diagnostic Centre"
                className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base text-ink"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="upload-summary"
              className="block text-sm font-medium text-ink-2 mb-1"
            >
              Clinical Summary / Diagnosis / Findings
            </label>
            <input
              id="upload-summary"
              type="text"
              value={uploadSummary}
              onChange={(e) => setUploadSummary(e.target.value)}
              placeholder="Key diagnosis, findings, or invoice summary..."
              className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base text-ink"
            />
          </div>

          {uploadType === "PRESCRIPTION" && (
            <div className="rounded-md border border-line bg-paper-2 p-3 space-y-2">
              <div className="text-xs font-semibold text-ink-2">
                Primary Medication (Optional)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  value={uploadMedName}
                  onChange={(e) => setUploadMedName(e.target.value)}
                  placeholder="Tab. Napa 500mg"
                  aria-label="Medication name"
                  className="rounded-md border border-line bg-paper px-2.5 py-1.5 text-sm text-ink"
                />
                <input
                  type="text"
                  value={uploadMedDosage}
                  onChange={(e) => setUploadMedDosage(e.target.value)}
                  placeholder="1 + 0 + 1"
                  aria-label="Dosage"
                  className="rounded-md border border-line bg-paper px-2.5 py-1.5 text-sm font-mono text-ink"
                />
                <input
                  type="text"
                  value={uploadMedDuration}
                  onChange={(e) => setUploadMedDuration(e.target.value)}
                  placeholder="7 Days"
                  aria-label="Duration"
                  className="rounded-md border border-line bg-paper px-2.5 py-1.5 text-sm text-ink"
                />
              </div>
            </div>
          )}

          {uploadType === "LAB_REPORT" && (
            <div className="rounded-md border border-line bg-paper-2 p-3 space-y-2">
              <div className="text-xs font-semibold text-ink-2">
                Key Test Parameter (Optional)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  value={uploadLabParam}
                  onChange={(e) => setUploadLabParam(e.target.value)}
                  placeholder="HbA1c / Creatinine"
                  aria-label="Parameter name"
                  className="rounded-md border border-line bg-paper px-2.5 py-1.5 text-sm text-ink"
                />
                <input
                  type="text"
                  value={uploadLabResult}
                  onChange={(e) => setUploadLabResult(e.target.value)}
                  placeholder="5.6 %"
                  aria-label="Result value"
                  className="rounded-md border border-line bg-paper px-2.5 py-1.5 text-sm font-mono text-ink"
                />
                <input
                  type="text"
                  value={uploadLabRef}
                  onChange={(e) => setUploadLabRef(e.target.value)}
                  placeholder="< 5.7 %"
                  aria-label="Reference range"
                  className="rounded-md border border-line bg-paper px-2.5 py-1.5 text-sm font-mono text-ink"
                />
              </div>
            </div>
          )}

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setUploadModalOpen(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploadSubmitting}
              className="btn-primary"
            >
              {uploadSubmitting ? "Saving..." : "Save to Vault"}
            </button>
          </div>
        </form>
      </ModalDialog>

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

            <div className="rounded-md border border-line bg-paper-2 p-3.5 space-y-1.5">
              <div className="text-xs text-mut">6-Character Pairing Code</div>
              <div className="flex items-center justify-center gap-2">
                <span className="font-mono text-2xl font-semibold tracking-wider text-brand-800">
                  {qrPopupData.session.shortCode}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopyCode(qrPopupData.session.shortCode)}
                  className="btn-secondary !px-2 !py-1 text-xs"
                  title="Copy pairing code"
                >
                  {copiedCode === qrPopupData.session.shortCode ? (
                    <Check className="w-3.5 h-3.5 text-brand-700" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {copiedCode === qrPopupData.session.shortCode
                      ? "Copied"
                      : "Copy"}
                  </span>
                </button>
              </div>
              <div className="flex items-center justify-center gap-2 text-xs text-mut pt-1">
                <Clock className="w-3.5 h-3.5 text-brand-700" />
                <span>
                  {formatRemainingTime(qrPopupData.session.expiresAt, nowTick)}{" "}
                  (until{" "}
                  {new Date(qrPopupData.session.expiresAt).toLocaleTimeString(
                    [],
                    { hour: "2-digit", minute: "2-digit" },
                  )}
                  )
                </span>
              </div>
              <div className="text-xs text-ink-2">
                Sharing{" "}
                <strong>
                  {qrPopupData.session.documentIds?.length || 0} record(s)
                </strong>{" "}
                + enabling immutable prescription issuance
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
              key: "code",
              header: "Pairing Code",
              render: (s: any) => (
                <div className="space-y-0.5">
                  <div className="font-mono font-semibold text-ink">
                    {s.shortCode}
                  </div>
                  <div className="text-xs text-mut font-mono">
                    {s.documentIds?.length ?? 0} doc(s) shared
                  </div>
                </div>
              ),
            },
            {
              key: "doctor",
              header: "Scanned By",
              render: (s: any) => (
                <div>
                  <div>
                    {s.scannedByDoctor?.patientUser?.name || "Not scanned yet"}
                  </div>
                  {s.workspace?.name && (
                    <div className="text-xs text-mut">{s.workspace.name}</div>
                  )}
                </div>
              ),
            },
            {
              key: "expires",
              header: "Expiry / Countdown",
              render: (s: any) => {
                const isActive =
                  ["GENERATED", "SCANNED_ACTIVE"].includes(s.status) &&
                  new Date(s.expiresAt).getTime() > nowTick;
                return (
                  <div className="font-mono text-xs">
                    {isActive ? (
                      <span className="text-brand-700 font-semibold">
                        {formatRemainingTime(s.expiresAt, nowTick)}
                      </span>
                    ) : (
                      <span className="text-mut">
                        {new Date(s.expiresAt).toLocaleString()}
                      </span>
                    )}
                  </div>
                );
              },
            },
            {
              key: "status",
              header: "Status",
              render: (s: any) => <StatusBadge label={s.status} />,
            },
            {
              key: "action",
              header: "Action",
              align: "right",
              render: (s: any) => {
                const isActive =
                  ["GENERATED", "SCANNED_ACTIVE"].includes(s.status) &&
                  new Date(s.expiresAt).getTime() > nowTick;
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

      {/* 4. Doctor Details Modal */}
      <ModalDialog
        open={Boolean(inspectedDoctor)}
        onClose={() => setInspectedDoctor(null)}
        title={inspectedDoctor?.name || "Doctor Details"}
        subtitle={
          inspectedDoctor
            ? `${inspectedDoctor.specialty} · Consultation Fee: ${computeDoctorFeeRange(inspectedDoctor)}`
            : undefined
        }
      >
        {inspectedDoctor && (
          <div className="space-y-4 text-sm">
            {inspectedDoctor.customHeadline && (
              <div className="rounded-md bg-brand-50 border border-brand-200 px-3 py-2 text-xs font-medium text-brand-800">
                {inspectedDoctor.customHeadline}
              </div>
            )}

            {inspectedDoctor.degrees?.length > 0 && (
              <div>
                <div className="text-xs text-mut">Qualifications</div>
                <div className="font-medium text-ink mt-0.5">
                  {inspectedDoctor.degrees.join(", ")}
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
                      className="rounded-md border border-line bg-paper-2 p-2.5 flex items-center justify-between gap-2"
                    >
                      <div>
                        <div className="font-medium text-ink">
                          {aff.workspaceName} {aff.area ? `(${aff.area})` : ""}
                        </div>
                        <div className="text-xs text-mut mt-0.5">
                          {aff.schedule}
                          {aff.roomNumber ? ` · ${aff.roomNumber}` : ""}
                        </div>
                      </div>
                      <span className="font-mono text-xs font-semibold text-brand-700 shrink-0">
                        {Number(aff.consultationFee || 0).toLocaleString()} Tk
                      </span>
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

      {/* 5. Request Appointment Modal */}
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
              <label
                htmlFor="booking-workspace"
                className="block text-sm font-medium text-ink-2 mb-1"
              >
                Select Hospital / Chamber
              </label>
              <select
                id="booking-workspace"
                required
                value={bookingWorkspaceId}
                onChange={(e) => setBookingWorkspaceId(e.target.value)}
                className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base text-ink"
              >
                {(bookingDoctor.affiliations || []).map((aff: any) => (
                  <option key={aff.workspaceId} value={aff.workspaceId}>
                    {aff.workspaceName} ({aff.area || "Facility"}) —{" "}
                    {Number(aff.consultationFee || 0).toLocaleString()} Tk ·{" "}
                    {aff.schedule || "Standard Hours"}
                  </option>
                ))}
                <option value="INDEPENDENT_CHAMBER">
                  Independent Personal Chamber (
                  {bookingDoctor.area || "Direct Consultation"}) —{" "}
                  {Number(
                    bookingDoctor.defaultConsultationFee || 1000,
                  ).toLocaleString()}{" "}
                  Tk
                </option>
              </select>
            </div>

            {selectedBookingChamber && (
              <div className="rounded-md border border-line bg-paper-2 p-3 space-y-2 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-ink">
                      {selectedBookingChamber.name} (
                      {selectedBookingChamber.area})
                    </div>
                    <div className="text-mut mt-0.5">
                      Schedule: {selectedBookingChamber.schedule}
                      {selectedBookingChamber.roomNumber
                        ? ` · ${selectedBookingChamber.roomNumber}`
                        : ""}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-mut">Consultation Fee</div>
                    <div className="font-mono text-sm font-semibold text-brand-700">
                      {selectedBookingChamber.fee.toLocaleString()} Tk
                    </div>
                  </div>
                </div>
                <div className="pt-1.5 border-t border-line flex flex-wrap items-center gap-1.5">
                  <span className="text-mut font-medium">
                    Configured Slots:
                  </span>
                  {(selectedBookingChamber.availableSlots || []).map(
                    (slot: string) => (
                      <span
                        key={slot}
                        className="inline-flex items-center rounded bg-paper border border-line px-1.5 py-0.5 font-mono text-[11px] text-brand-700"
                      >
                        {slot}
                      </span>
                    ),
                  )}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="booking-date"
                  className="block text-sm font-medium text-ink-2 mb-1"
                >
                  Preferred Date
                </label>
                <input
                  id="booking-date"
                  type="date"
                  required
                  value={bookingDate}
                  onChange={(e) => setBookingDate(e.target.value)}
                  className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base font-mono text-ink"
                />
              </div>
              <div>
                <label
                  htmlFor="booking-slot"
                  className="block text-sm font-medium text-ink-2 mb-1"
                >
                  Available Time Slot (Configured by Chamber)
                </label>
                <select
                  id="booking-slot"
                  required
                  value={bookingSlot}
                  onChange={(e) => setBookingSlot(e.target.value)}
                  className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base font-mono text-ink"
                >
                  {(
                    selectedBookingChamber?.availableSlots || [
                      "05:00 PM",
                      "06:00 PM",
                      "07:00 PM",
                      "08:00 PM",
                    ]
                  ).map((slot: string) => (
                    <option key={slot} value={slot}>
                      {slot}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-mut mt-1">
                  Only time slots configured by the Doctor or Hospital are
                  available.
                </p>
              </div>
            </div>

            <div>
              <label
                htmlFor="booking-reason"
                className="block text-sm font-medium text-ink-2 mb-1"
              >
                Reason for Consultation
              </label>
              <input
                id="booking-reason"
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
                {bookingSubmitting ? "Submitting..." : "Submit Request"}
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
            <label
              htmlFor="fam-direction"
              className="block text-sm font-medium text-ink-2 mb-1"
            >
              Link Role
            </label>
            <select
              id="fam-direction"
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
            <label
              htmlFor="fam-target-id"
              className="block text-sm font-medium text-ink-2 mb-1"
            >
              Member Patient ID, Email, or Phone
            </label>
            <input
              id="fam-target-id"
              type="text"
              required
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              value={famTargetId}
              onChange={(e) => setFamTargetId(e.target.value)}
              placeholder="PAT-2026-100002 or child@demo.bd"
              className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base text-ink"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="fam-type"
                className="block text-sm font-medium text-ink-2 mb-1"
              >
                Account Category
              </label>
              <select
                id="fam-type"
                value={famType}
                onChange={(e) => setFamType(e.target.value)}
                className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base text-ink"
              >
                <option value="CHILD">Child Account</option>
                <option value="OLD">Senior Account</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="fam-label"
                className="block text-sm font-medium text-ink-2 mb-1"
              >
                Relationship Label
              </label>
              <input
                id="fam-label"
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
