import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
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
  sectionNavTick: number;
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

const VALID_PERSONAS: ActivePersona[] = [
  'PATIENT',
  'DOCTOR',
  'WORKSPACE',
  'CENTRAL_REGISTRY',
];

function parseHashNavigation(): {
  persona?: ActivePersona;
  section?: string;
} {
  if (typeof window === 'undefined') return {};
  const raw = window.location.hash.replace(/^#\/?/, '').trim();
  if (!raw || raw.startsWith('auth/')) return {};
  const parts = raw.split('/').filter(Boolean);
  if (parts.length >= 2) {
    const candidatePersona = parts[0].toUpperCase() as ActivePersona;
    if (VALID_PERSONAS.includes(candidatePersona)) {
      return {
        persona: candidatePersona,
        section: parts[1].toLowerCase(),
      };
    }
  }
  return {};
}

function formatDocumentTitle(persona: ActivePersona, section: string): string {
  const sectionLabel = section
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
  const personaLabel =
    persona === 'CENTRAL_REGISTRY'
      ? 'DGHS Central Registry'
      : persona === 'WORKSPACE'
        ? 'Hospital Workspace'
        : persona === 'DOCTOR'
          ? 'Doctor Portal'
          : 'Patient Portal';
  return `${sectionLabel} · ${personaLabel} — Unified Health Platform`;
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
    const fromHash = parseHashNavigation().persona;
    if (fromHash) return fromHash;
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
  const [activeSection, setActiveSectionState] = useState<string>(() => {
    return parseHashNavigation().section || 'overview';
  });
  const [sectionNavTick, setSectionNavTick] = useState<number>(0);

  const isRestoringHistoryRef = useRef<boolean>(false);
  const historyInitializedRef = useRef<boolean>(false);

  const setActiveSection = useCallback((section: string) => {
    setActiveSectionState(section);
    setSectionNavTick((prev) => prev + 1);
  }, []);

  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('ump_sidebar_collapsed') === '1';
  });
  const [workspaceRolePerspective, setWorkspaceRolePerspective] =
    useState<string>('COMBINED');
  const [unreadNotificationCount, setUnreadNotificationCount] =
    useState<number>(0);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('ump_sidebar_collapsed', next ? '1' : '0');
      return next;
    });
  }, []);

  const setActivePersona = useCallback(
    (persona: ActivePersona) => {
      setActivePersonaState(persona);
      localStorage.setItem('ump_active_persona', persona);
      setActiveSection('overview');
    },
    [setActiveSection]
  );

  const setActiveWorkspaceId = useCallback(
    (wsId: string | null) => {
      setActiveWorkspaceIdState(wsId);
      setWorkspaceRolePerspective('COMBINED');
      setActiveSection('overview');
      if (wsId) {
        localStorage.setItem('ump_active_workspace_id', wsId);
      } else {
        localStorage.removeItem('ump_active_workspace_id');
      }
    },
    [setActiveSection]
  );

  const setActingPatientId = useCallback((patId: string | null) => {
    setActingPatientIdState(patId);
    if (patId) {
      localStorage.setItem('ump_acting_patient_id', patId);
    } else {
      localStorage.removeItem('ump_acting_patient_id');
    }
  }, []);

  // Synchronize in-app navigation with Browser History (pushState + popstate)
  // so clicking the Browser Back/Forward button navigates sections & personas instead of exiting the site.
  useEffect(() => {
    if (typeof window === 'undefined' || !user) {
      historyInitializedRef.current = false;
      return;
    }

    const targetHash = `#/${activePersona.toLowerCase()}/${activeSection}`;
    document.title = formatDocumentTitle(activePersona, activeSection);

    if (!historyInitializedRef.current) {
      historyInitializedRef.current = true;
      const rootHash = `#/${activePersona.toLowerCase()}/overview`;
      const baseState = {
        umpNav: true,
        persona: activePersona,
        section: 'overview',
        workspaceId: activeWorkspaceId,
        actingPatientId,
      };
      window.history.replaceState(baseState, '', rootHash);
      if (activeSection !== 'overview') {
        window.history.pushState(
          {
            umpNav: true,
            persona: activePersona,
            section: activeSection,
            workspaceId: activeWorkspaceId,
            actingPatientId,
          },
          '',
          targetHash
        );
      }
      return;
    }

    if (isRestoringHistoryRef.current) {
      return;
    }

    const currentState = window.history.state;
    const isSameState =
      currentState?.umpNav &&
      currentState.persona === activePersona &&
      currentState.section === activeSection &&
      currentState.workspaceId === activeWorkspaceId &&
      currentState.actingPatientId === actingPatientId;

    if (!isSameState) {
      window.history.pushState(
        {
          umpNav: true,
          persona: activePersona,
          section: activeSection,
          workspaceId: activeWorkspaceId,
          actingPatientId,
        },
        '',
        targetHash
      );
    }
  }, [user, activePersona, activeSection, activeWorkspaceId, actingPatientId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handlePopState = (event: PopStateEvent) => {
      if (!user) return;
      const state = event.state;
      if (state && state.umpNav) {
        isRestoringHistoryRef.current = true;
        const nextPersona: ActivePersona = VALID_PERSONAS.includes(
          state.persona
        )
          ? state.persona
          : 'PATIENT';
        const nextSection: string = state.section || 'overview';
        const nextWsId: string | null = state.workspaceId ?? null;
        const nextProxyId: string | null = state.actingPatientId ?? null;

        setActivePersonaState(nextPersona);
        localStorage.setItem('ump_active_persona', nextPersona);
        setActiveSectionState(nextSection);
        setSectionNavTick((prev) => prev + 1);
        setActiveWorkspaceIdState(nextWsId);
        if (nextWsId) {
          localStorage.setItem('ump_active_workspace_id', nextWsId);
        } else {
          localStorage.removeItem('ump_active_workspace_id');
        }
        setActingPatientIdState(nextProxyId);
        if (nextProxyId) {
          localStorage.setItem('ump_acting_patient_id', nextProxyId);
        } else {
          localStorage.removeItem('ump_acting_patient_id');
        }
        document.title = formatDocumentTitle(nextPersona, nextSection);
        window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
        queueMicrotask(() => {
          isRestoringHistoryRef.current = false;
        });
        return;
      }

      const parsed = parseHashNavigation();
      if (parsed.persona && parsed.section) {
        isRestoringHistoryRef.current = true;
        setActivePersonaState(parsed.persona);
        localStorage.setItem('ump_active_persona', parsed.persona);
        setActiveSectionState(parsed.section);
        setSectionNavTick((prev) => prev + 1);
        document.title = formatDocumentTitle(parsed.persona, parsed.section);
        window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
        queueMicrotask(() => {
          isRestoringHistoryRef.current = false;
        });
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [user]);

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
    [setActiveSection]
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

  const isScrollingRef = useRef<boolean>(false);
  const pendingUnreadRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;

    const flushDeferredWork = () => {
      isScrollingRef.current = false;
      if (pendingUnreadRef.current !== null) {
        const nextCount = pendingUnreadRef.current;
        pendingUnreadRef.current = null;
        setUnreadNotificationCount((prev) =>
          prev === nextCount ? prev : nextCount
        );
      }
    };

    const handleScroll = () => {
      isScrollingRef.current = true;
      if (!('onscrollend' in window)) {
        if (fallbackTimer) clearTimeout(fallbackTimer);
        fallbackTimer = setTimeout(flushDeferredWork, 120);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    if ('onscrollend' in window) {
      window.addEventListener('scrollend', flushDeferredWork, {
        passive: true,
      });
    }

    return () => {
      if (fallbackTimer) clearTimeout(fallbackTimer);
      window.removeEventListener('scroll', handleScroll);
      if ('onscrollend' in window) {
        window.removeEventListener('scrollend', flushDeferredWork);
      }
    };
  }, []);

  const refreshUnreadCount = useCallback(async () => {
    if (typeof document !== 'undefined' && document.hidden) {
      return;
    }
    if (!user || !localStorage.getItem('ump_auth_token')) {
      setUnreadNotificationCount((prev) => (prev === 0 ? prev : 0));
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
      const nextCount = (res.unreadCount || 0) + extraInvites;
      if (isScrollingRef.current) {
        pendingUnreadRef.current = nextCount;
      } else {
        setUnreadNotificationCount((prev) =>
          prev === nextCount ? prev : nextCount
        );
      }
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
    const timer = setInterval(() => {
      if (!isScrollingRef.current) {
        refreshUnreadCount();
      }
    }, 15000);
    return () => clearInterval(timer);
  }, [user, refreshUnreadCount]);

  const loginWithToken = useCallback(
    (
      newToken: string,
      userPayload: UserContextPayload,
      preferredPersona?: ActivePersona
    ) => {
      historyInitializedRef.current = false;
      localStorage.setItem('ump_auth_token', newToken);
      localStorage.removeItem('ump_acting_patient_id');
      setActingPatientIdState(null);
      setWorkspaceRolePerspective('COMBINED');
      setActiveSection('overview');
      setToken(newToken);
      applyUserContext(userPayload, preferredPersona);
    },
    [applyUserContext, setActiveSection]
  );

  const logout = useCallback(() => {
    historyInitializedRef.current = false;
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
    if (typeof window !== 'undefined') {
      window.history.replaceState(
        { umpAuthView: 'PATIENT_LOGIN' },
        '',
        '#/auth/patient_login'
      );
      document.title = 'Sign In — Unified Health Platform';
    }
  }, [setActiveSection]);

  const contextValue = useMemo<AuthContextValue>(
    () => ({
      token,
      user,
      loading,
      activePersona,
      activeWorkspaceId,
      actingPatientId,
      activeSection,
      sectionNavTick,
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
    }),
    [
      token,
      user,
      loading,
      activePersona,
      activeWorkspaceId,
      actingPatientId,
      activeSection,
      sectionNavTick,
      sidebarCollapsed,
      workspaceRolePerspective,
      effectiveWorkspacePermissions,
      unreadNotificationCount,
      setActivePersona,
      setActiveWorkspaceId,
      setActingPatientId,
      setActiveSection,
      toggleSidebar,
      refreshUnreadCount,
      loginWithToken,
      refreshUserContext,
      logout,
    ]
  );

  return (
    <AuthContext.Provider value={contextValue}>
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
