import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import { apiRequest } from '../services/api';

export type ActivePersona =
  | 'PATIENT'
  | 'DOCTOR'
  | 'WORKSPACE'
  | 'CENTRAL_REGISTRY';

export interface WorkspaceMembershipSummary {
  memberId: string;
  workspaceId: string;
  workspaceCode: string;
  workspaceName: string;
  workspaceType: string;
  approvalStatus: string;
  area: string;
  isOwner: boolean;
  isAdmin: boolean;
  staffTitle?: string;
  department?: string;
  roles: { id: string; name: string; permissions: string[] }[];
  roleNames: string[];
  combinedPermissions: string[];
}

export interface UserContextPayload {
  isCentralRegistry: boolean;
  centralRegistry?: {
    name: string;
    email: string;
    code: string;
    phone: string;
  };
  patient?: any;
  doctorProfile?: any;
  workspaces?: WorkspaceMembershipSummary[];
  pendingStaffInvites?: any[];
  maintainedDependents?: any[];
  managedByMaintainers?: any[];
}

interface AuthContextValue {
  token: string | null;
  user: UserContextPayload | null;
  loading: boolean;
  activePersona: ActivePersona;
  activeWorkspaceId: string | null;
  actingPatientId: string | null;
  activeSection: string;
  sidebarCollapsed: boolean;
  workspaceRolePerspective: string;
  effectiveWorkspacePermissions: string[];
  unreadNotificationCount: number;
  setActivePersona: (persona: ActivePersona) => void;
  setActiveWorkspaceId: (workspaceId: string | null) => void;
  setActingPatientId: (patientId: string | null) => void;
  setActiveSection: (section: string) => void;
  toggleSidebar: () => void;
  setWorkspaceRolePerspective: (perspective: string) => void;
  refreshUnreadCount: () => Promise<void>;
  loginWithToken: (
    token: string,
    userPayload: UserContextPayload,
    preferredPersona?: ActivePersona
  ) => void;
  refreshUserContext: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem('ump_auth_token')
  );
  const [user, setUser] = useState<UserContextPayload | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(token));
  const [activePersona, setActivePersonaState] = useState<ActivePersona>(() => {
    return (
      (localStorage.getItem('ump_active_persona') as ActivePersona) || 'PATIENT'
    );
  });
  const [activeWorkspaceId, setActiveWorkspaceIdState] = useState<string | null>(
    () => localStorage.getItem('ump_active_workspace_id')
  );
  const [actingPatientId, setActingPatientIdState] = useState<string | null>(
    () => localStorage.getItem('ump_acting_patient_id')
  );
  const [activeSection, setActiveSection] = useState<string>('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('ump_sidebar_collapsed') === '1';
  });
  const [workspaceRolePerspective, setWorkspaceRolePerspective] =
    useState<string>('COMBINED');
  const [unreadNotificationCount, setUnreadNotificationCount] =
    useState<number>(0);

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('ump_sidebar_collapsed', next ? '1' : '0');
      return next;
    });
  };

  const setActivePersona = (persona: ActivePersona) => {
    setActivePersonaState(persona);
    localStorage.setItem('ump_active_persona', persona);
    setActiveSection('overview');
  };

  const setActiveWorkspaceId = (wsId: string | null) => {
    setActiveWorkspaceIdState(wsId);
    setWorkspaceRolePerspective('COMBINED');
    setActiveSection('overview');
    if (wsId) {
      localStorage.setItem('ump_active_workspace_id', wsId);
    } else {
      localStorage.removeItem('ump_active_workspace_id');
    }
  };

  const setActingPatientId = (patId: string | null) => {
    setActingPatientIdState(patId);
    if (patId) {
      localStorage.setItem('ump_acting_patient_id', patId);
    } else {
      localStorage.removeItem('ump_acting_patient_id');
    }
  };

  const currentWorkspaceSummary = useMemo(() => {
    if (!user?.workspaces || user.workspaces.length === 0) return null;
    return (
      user.workspaces.find((w) => w.workspaceId === activeWorkspaceId) ||
      user.workspaces[0]
    );
  }, [user?.workspaces, activeWorkspaceId]);

  const effectiveWorkspacePermissions = useMemo(() => {
    if (!currentWorkspaceSummary) return [];
    if (workspaceRolePerspective === 'COMBINED') {
      return currentWorkspaceSummary.combinedPermissions || [];
    }
    const matchingRole = currentWorkspaceSummary.roles?.find(
      (r) => r.id === workspaceRolePerspective
    );
    return matchingRole
      ? matchingRole.permissions || []
      : currentWorkspaceSummary.combinedPermissions || [];
  }, [currentWorkspaceSummary, workspaceRolePerspective]);

  const applyUserContext = useCallback(
    (payload: UserContextPayload, preferredPersona?: ActivePersona) => {
      setUser(payload);

      if (payload.isCentralRegistry) {
        setActivePersonaState('CENTRAL_REGISTRY');
        localStorage.setItem('ump_active_persona', 'CENTRAL_REGISTRY');
        setActiveSection('overview');
        return;
      }

      if (preferredPersona) {
        setActivePersonaState(preferredPersona);
        localStorage.setItem('ump_active_persona', preferredPersona);
        setActiveSection('overview');
      }

      // Validate stored actingPatientId against active maintainedDependents so stale IDs never cause 403s
      const storedProxyId = localStorage.getItem('ump_acting_patient_id');
      if (storedProxyId) {
        const hasActiveProxy = (payload.maintainedDependents || []).some(
          (rel: any) =>
            rel.status === 'ACTIVE' && rel.dependent?.id === storedProxyId
        );
        if (!hasActiveProxy) {
          localStorage.removeItem('ump_acting_patient_id');
          setActingPatientIdState(null);
        }
      }

      if (payload.workspaces && payload.workspaces.length > 0) {
        const currentValid = payload.workspaces.some(
          (w) => w.workspaceId === localStorage.getItem('ump_active_workspace_id')
        );
        if (!currentValid) {
          const firstId = payload.workspaces[0].workspaceId;
          setActiveWorkspaceIdState(firstId);
          localStorage.setItem('ump_active_workspace_id', firstId);
        }
      }
    },
    []
  );

  const refreshUserContext = useCallback(async () => {
    if (!localStorage.getItem('ump_auth_token')) {
      setLoading(false);
      return;
    }
    try {
      const res = await apiRequest<{ user: UserContextPayload }>('/auth/me');
      applyUserContext(res.user);
    } catch {
      localStorage.removeItem('ump_auth_token');
      localStorage.removeItem('ump_acting_patient_id');
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [applyUserContext]);

  const refreshUnreadCount = useCallback(async () => {
    if (!user || !localStorage.getItem('ump_auth_token')) {
      setUnreadNotificationCount(0);
      return;
    }
    try {
      const params = new URLSearchParams();
      params.set('persona', activePersona);
      if (activePersona === 'WORKSPACE' && activeWorkspaceId) {
        params.set('workspaceId', activeWorkspaceId);
      }
      if (activePersona === 'PATIENT' && actingPatientId) {
        params.set('actingPatientId', actingPatientId);
      }
      const res = await apiRequest<{ unreadCount: number }>(
        `/notifications?${params.toString()}`
      );
      let extraInvites = 0;
      if (activePersona === 'PATIENT' && !actingPatientId) {
        extraInvites += user.pendingStaffInvites?.length || 0;
      }
      setUnreadNotificationCount((res.unreadCount || 0) + extraInvites);
    } catch {
      // Ignore background fetch errors
    }
  }, [user, activePersona, activeWorkspaceId, actingPatientId]);

  useEffect(() => {
    if (token) {
      refreshUserContext();
    } else {
      setLoading(false);
    }
  }, [token, refreshUserContext]);

  useEffect(() => {
    if (!user) return;
    refreshUnreadCount();
    const timer = setInterval(refreshUnreadCount, 15000);
    return () => clearInterval(timer);
  }, [user, refreshUnreadCount]);

  const loginWithToken = (
    newToken: string,
    userPayload: UserContextPayload,
    preferredPersona?: ActivePersona
  ) => {
    localStorage.setItem('ump_auth_token', newToken);
    localStorage.removeItem('ump_acting_patient_id');
    setActingPatientIdState(null);
    setWorkspaceRolePerspective('COMBINED');
    setActiveSection('overview');
    setToken(newToken);
    applyUserContext(userPayload, preferredPersona);
  };

  const logout = () => {
    localStorage.removeItem('ump_auth_token');
    localStorage.removeItem('ump_active_persona');
    localStorage.removeItem('ump_active_workspace_id');
    localStorage.removeItem('ump_acting_patient_id');
    setToken(null);
    setUser(null);
    setActivePersonaState('PATIENT');
    setActiveWorkspaceIdState(null);
    setActingPatientIdState(null);
    setWorkspaceRolePerspective('COMBINED');
    setActiveSection('overview');
    setUnreadNotificationCount(0);
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        loading,
        activePersona,
        activeWorkspaceId,
        actingPatientId,
        activeSection,
        sidebarCollapsed,
        workspaceRolePerspective,
        effectiveWorkspacePermissions,
        unreadNotificationCount,
        setActivePersona,
        setActiveWorkspaceId,
        setActingPatientId,
        setActiveSection,
        toggleSidebar,
        setWorkspaceRolePerspective,
        refreshUnreadCount,
        loginWithToken,
        refreshUserContext,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
