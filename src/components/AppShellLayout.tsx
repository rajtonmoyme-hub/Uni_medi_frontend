import React, { useEffect, useMemo } from 'react';
import {
  PanelLeftClose,
  PanelLeftOpen,
  LayoutDashboard,
  FileText,
  Stethoscope,
  Calendar,
  Building2,
  Users,
  Bell,
  User,
  QrCode,
  FlaskConical,
  Receipt,
  Package,
  Shield,
  ClipboardList,
  LogOut,
  Monitor,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

export const AppShellLayout: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const {
    user,
    activePersona,
    activeWorkspaceId,
    actingPatientId,
    activeSection,
    sectionNavTick,
    sidebarCollapsed,
    effectiveWorkspacePermissions,
    unreadNotificationCount,
    setActivePersona,
    setActiveWorkspaceId,
    setActingPatientId,
    setActiveSection,
    toggleSidebar,
    logout,
  } = useAuth();

  const isElectron = Boolean((window as any).electronAPI?.isElectron);

  const navItems: NavItem[] = useMemo(() => {
    if (!user) return [];

    if (user.isCentralRegistry || activePersona === 'CENTRAL_REGISTRY') {
      return [
        { id: 'overview', label: 'Overview', icon: LayoutDashboard },
        { id: 'patients', label: 'Patients', icon: Users },
        { id: 'doctors', label: 'Doctors', icon: Stethoscope },
        { id: 'hospitals', label: 'Hospitals', icon: Building2 },
        {
          id: 'notifications',
          label: 'Notifications',
          icon: Bell,
          badge: unreadNotificationCount,
        },
        { id: 'profile', label: 'Profile', icon: User },
      ];
    }

    if (activePersona === 'DOCTOR' && user.doctorProfile) {
      return [
        { id: 'overview', label: 'Overview', icon: LayoutDashboard },
        { id: 'consultations', label: 'Consultations', icon: QrCode },
        { id: 'history', label: 'Patient History', icon: FileText },
        { id: 'affiliations', label: 'Affiliations', icon: Building2 },
        {
          id: 'notifications',
          label: 'Notifications',
          icon: Bell,
          badge: unreadNotificationCount,
        },
        { id: 'profile', label: 'Profile', icon: User },
      ];
    }

    if (
      activePersona === 'WORKSPACE' &&
      user.workspaces &&
      user.workspaces.length > 0
    ) {
      const hasPerm = (perm: string) =>
        effectiveWorkspacePermissions.includes(perm);
      const items: NavItem[] = [
        { id: 'overview', label: 'Overview', icon: LayoutDashboard },
      ];
      if (hasPerm('appointments.view')) {
        items.push({
          id: 'appointments',
          label: 'Appointments',
          icon: Calendar,
        });
      }
      if (hasPerm('reports.view')) {
        items.push({
          id: 'laboratory',
          label: 'Laboratory',
          icon: FlaskConical,
        });
      }
      if (hasPerm('billing.view')) {
        items.push({ id: 'billing', label: 'Billing', icon: Receipt });
      }
      if (hasPerm('doctors.view')) {
        items.push({ id: 'doctors', label: 'Doctors', icon: Stethoscope });
      }
      if (hasPerm('packages.view')) {
        items.push({ id: 'packages', label: 'Packages', icon: Package });
      }
      if (hasPerm('staff.view')) {
        items.push({ id: 'staff', label: 'Staff', icon: Users });
      }
      if (hasPerm('roles.manage')) {
        items.push({
          id: 'roles',
          label: 'Roles & Permissions',
          icon: Shield,
        });
      }
      if (hasPerm('staff.logs.view')) {
        items.push({
          id: 'audit_logs',
          label: 'Audit Logs',
          icon: ClipboardList,
        });
      }
      items.push({
        id: 'notifications',
        label: 'Notifications',
        icon: Bell,
        badge: unreadNotificationCount,
      });
      items.push({ id: 'profile', label: 'Profile', icon: User });
      return items;
    }

    // Default: Patient Portal
    return [
      { id: 'overview', label: 'Overview', icon: LayoutDashboard },
      { id: 'records', label: 'Medical Records', icon: FileText },
      { id: 'doctors', label: 'Doctors', icon: Stethoscope },
      { id: 'appointments', label: 'Appointments', icon: Calendar },
      { id: 'hospitals', label: 'Hospitals & Packages', icon: Building2 },
      { id: 'family', label: 'Family', icon: Users },
      {
        id: 'notifications',
        label: 'Notifications',
        icon: Bell,
        badge: unreadNotificationCount,
      },
      { id: 'profile', label: 'Profile', icon: User },
    ];
  }, [
    user,
    activePersona,
    effectiveWorkspacePermissions,
    unreadNotificationCount,
  ]);

  useEffect(() => {
    if (navItems.length > 0 && !navItems.some((n) => n.id === activeSection)) {
      setActiveSection('overview');
    }
  }, [navItems, activeSection, setActiveSection]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [activeSection, sectionNavTick, activePersona, activeWorkspaceId]);

  if (!user) return null;

  const activeDependents = (user.maintainedDependents || []).filter(
    (d: any) => d.status === 'ACTIVE'
  );

  const identityTitle = user.isCentralRegistry
    ? user.centralRegistry?.name || 'Central Registry'
    : user.patient?.name || 'User';

  const identityCode = user.isCentralRegistry
    ? user.centralRegistry?.code || 'DGHS'
    : activePersona === 'DOCTOR' && user.doctorProfile
      ? user.doctorProfile.doctorIdCode
      : activePersona === 'WORKSPACE' && user.workspaces?.length
        ? user.workspaces.find((w) => w.workspaceId === activeWorkspaceId)
            ?.workspaceCode || user.workspaces[0].workspaceCode
        : user.patient?.uniqueId || '';

  return (
    <div className="min-h-screen min-h-dvh flex flex-col bg-paper-2 text-ink">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-brand-700 focus:px-3 focus:py-1.5 focus:text-xs focus:font-semibold focus:text-white"
      >
        Skip to main content
      </a>

      {/* Single-Row Top Header (<12% viewport height) */}
      <header className="sticky top-0 z-40 h-14 bg-paper border-b border-line px-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label={
              sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'
            }
            aria-expanded={!sidebarCollapsed}
            className="btn-secondary !p-1.5"
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen className="w-4 h-4 text-ink-2" />
            ) : (
              <PanelLeftClose className="w-4 h-4 text-ink-2" />
            )}
          </button>

          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-8 w-8 rounded bg-brand-700 text-white flex items-center justify-center font-semibold text-base shrink-0">
              U
            </div>
            <span className="font-semibold text-base text-ink truncate">
              Unified Health Platform
            </span>
            {isElectron && (
              <span className="hidden sm:inline-flex items-center gap-1 rounded bg-paper-2 border border-line px-2 py-0.5 text-xs font-medium text-ink-2">
                <Monitor className="w-3.5 h-3.5" />
                <span>Desktop</span>
              </span>
            )}
          </div>
        </div>

        {/* Right Controls: Mode Switcher, Proxy Selector, Notifications Route, Profile Icon */}
        <div className="flex items-center gap-2.5">
          {user.isCentralRegistry ? (
            <>
              <span className="hidden md:inline-flex items-center gap-1.5 rounded bg-brand-50 border border-brand-200 px-2.5 py-1 text-xs font-medium text-brand-800">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Central Registry (DGHS)</span>
              </span>
              <button
                type="button"
                onClick={() => setActiveSection('notifications')}
                aria-label="Open Central Registry notifications"
                aria-current={
                  activeSection === 'notifications' ? 'page' : undefined
                }
                title="Notifications"
                className={`btn-secondary !px-2.5 !py-1.5 ${
                  activeSection === 'notifications'
                    ? '!border-brand-700 !bg-brand-50 !text-brand-800 ring-1 ring-brand-700/20'
                    : ''
                }`}
              >
                <Bell className="w-4 h-4 text-brand-700" />
                {unreadNotificationCount > 0 && (
                  <span className="inline-flex items-center justify-center rounded-full bg-accent-500 text-white text-xs font-semibold min-w-[1.25rem] h-5 px-1">
                    {unreadNotificationCount}
                  </span>
                )}
              </button>
            </>
          ) : (
            <>
              {/* Account Mode Switcher */}
              <div
                role="group"
                aria-label="Switch account mode"
                className="inline-flex items-center rounded-md border border-line bg-paper-2 p-0.5"
              >
                <button
                  type="button"
                  onClick={() => setActivePersona('PATIENT')}
                  className={`px-2.5 py-1 rounded text-xs font-medium ${
                    activePersona === 'PATIENT'
                      ? 'bg-brand-700 text-white font-semibold'
                      : 'text-ink-2 hover:bg-paper-3'
                  }`}
                >
                  Patient
                </button>
                {user.doctorProfile && (
                  <button
                    type="button"
                    onClick={() => setActivePersona('DOCTOR')}
                    className={`px-2.5 py-1 rounded text-xs font-medium ${
                      activePersona === 'DOCTOR'
                        ? 'bg-brand-700 text-white font-semibold'
                        : 'text-ink-2 hover:bg-paper-3'
                    }`}
                  >
                    Doctor
                  </button>
                )}
                {user.workspaces && user.workspaces.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActivePersona('WORKSPACE')}
                    className={`px-2.5 py-1 rounded text-xs font-medium ${
                      activePersona === 'WORKSPACE'
                        ? 'bg-brand-700 text-white font-semibold'
                        : 'text-ink-2 hover:bg-paper-3'
                    }`}
                  >
                    Workspace
                  </button>
                )}
              </div>

              {/* Active Workspace Selector (when in WORKSPACE mode with multiple memberships) */}
              {activePersona === 'WORKSPACE' &&
                user.workspaces &&
                user.workspaces.length > 1 && (
                  <select
                    aria-label="Select active workspace"
                    value={activeWorkspaceId || user.workspaces[0].workspaceId}
                    onChange={(e) => setActiveWorkspaceId(e.target.value)}
                    className="rounded-md border border-line bg-paper px-2.5 py-1 text-xs font-medium text-ink max-w-[200px]"
                  >
                    {user.workspaces.map((ws) => (
                      <option key={ws.workspaceId} value={ws.workspaceId}>
                        {ws.workspaceName}
                      </option>
                    ))}
                  </select>
                )}

              {/* Family Proxy Selector (when in PATIENT mode with active dependents) */}
              {activePersona === 'PATIENT' && activeDependents.length > 0 && (
                <select
                  aria-label="Select managed family account"
                  value={actingPatientId || ''}
                  onChange={(e) =>
                    setActingPatientId(e.target.value ? e.target.value : null)
                  }
                  className="hidden lg:block rounded-md border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-800 max-w-[220px]"
                >
                  <option value="">Myself ({user.patient?.name})</option>
                  {activeDependents.map((rel: any) => (
                    <option key={rel.id} value={rel.dependent.id}>
                      Managing: {rel.dependent.name} ({rel.dependent.accountType})
                    </option>
                  ))}
                </select>
              )}

              {/* Direct Route to Notifications Page */}
              <button
                type="button"
                onClick={() => setActiveSection('notifications')}
                aria-label="Open notifications page"
                aria-current={
                  activeSection === 'notifications' ? 'page' : undefined
                }
                title="Notifications"
                className={`btn-secondary !px-2.5 !py-1.5 ${
                  activeSection === 'notifications'
                    ? '!border-brand-700 !bg-brand-50 !text-brand-800 ring-1 ring-brand-700/20'
                    : ''
                }`}
              >
                <Bell className="w-4 h-4 text-brand-700" />
                {unreadNotificationCount > 0 && (
                  <span className="inline-flex items-center justify-center rounded-full bg-accent-500 text-white text-xs font-semibold min-w-[1.25rem] h-5 px-1">
                    {unreadNotificationCount}
                  </span>
                )}
              </button>
            </>
          )}

          {/* Profile Icon Button in Top Navbar */}
          <button
            type="button"
            onClick={() => setActiveSection('profile')}
            aria-label="Open profile"
            aria-current={activeSection === 'profile' ? 'page' : undefined}
            title={`Profile (${identityTitle})`}
            className={`btn-secondary !px-2.5 !py-1.5 ${
              activeSection === 'profile'
                ? '!border-brand-700 !bg-brand-50 !text-brand-800 ring-1 ring-brand-700/20'
                : ''
            }`}
          >
            <User className="w-4 h-4 text-brand-700" />
          </button>
        </div>
      </header>

      {/* Main Workspace Container: Sticky Left Sidebar + Unified Document Scroll Surface */}
      <div className="flex flex-1 min-h-0">
        <aside
          aria-label="Section navigation"
          className={`${
            sidebarCollapsed ? 'w-16' : 'w-60'
          } shrink-0 sticky top-14 self-start h-[calc(100vh-3.5rem)] h-[calc(100dvh-3.5rem)] bg-paper border-r border-line flex flex-col justify-between z-30`}
        >
          <nav
            aria-label="Primary sections"
            className="p-2.5 space-y-1 flex-1 overflow-y-auto overscroll-contain"
          >
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveSection(item.id)}
                  title={sidebarCollapsed ? item.label : undefined}
                  aria-label={sidebarCollapsed ? item.label : undefined}
                  aria-current={isActive ? 'page' : undefined}
                  className={`w-full flex items-center ${
                    sidebarCollapsed
                      ? 'justify-center px-2 py-2.5'
                      : 'justify-between px-3 py-2'
                  } rounded-md text-base transition-colors duration-150 ${
                    isActive
                      ? 'bg-brand-700 text-white font-semibold shadow-sm ring-1 ring-brand-900/15'
                      : 'text-ink-2 font-medium hover:bg-paper-2 hover:text-ink'
                  }`}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? 'text-white' : 'text-mut'
                      }`}
                    />
                    {!sidebarCollapsed && (
                      <span className="truncate">{item.label}</span>
                    )}
                  </span>
                  {!sidebarCollapsed &&
                    typeof item.badge === 'number' &&
                    item.badge > 0 && (
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-xs font-mono font-semibold ${
                          isActive
                            ? 'bg-white text-brand-800'
                            : 'bg-accent-50 text-accent-600 border border-accent-100'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                </button>
              );
            })}
          </nav>

          {/* Sticky Sidebar Footer: Signed-in Identity Summary + Logout Button at End */}
          <div className="p-3 border-t border-line bg-paper-2 shrink-0 space-y-2.5">
            {!sidebarCollapsed && (
              <div>
                <div className="text-sm font-semibold text-ink truncate">
                  {identityTitle}
                </div>
                <div className="text-xs font-mono text-mut truncate mt-0.5">
                  {identityCode}
                </div>
              </div>
            )}
            <button
              type="button"
              onClick={logout}
              title={sidebarCollapsed ? 'Log Out' : undefined}
              aria-label="Log Out"
              className={`btn-danger w-full justify-center ${
                sidebarCollapsed ? '!p-2' : '!py-2'
              }`}
            >
              <LogOut className="w-4 h-4 shrink-0" />
              {!sidebarCollapsed && <span>Log Out</span>}
            </button>
          </div>
        </aside>

        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 min-w-0 p-5 sm:p-6 main-scroll-surface focus:outline-none"
        >
          <div className="mx-auto max-w-[1360px] space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
};
