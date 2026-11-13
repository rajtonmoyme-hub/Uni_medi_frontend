import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppShellLayout } from './components/AppShellLayout';
import { LandingAndAuthPortal } from './portals/LandingAndAuthPortal';
import { CentralRegistryPortal } from './portals/CentralRegistryPortal';
import { PatientPortal } from './portals/PatientPortal';
import { DoctorPortal } from './portals/DoctorPortal';
import { WorkspacePortal } from './portals/WorkspacePortal';
import { useSmoothWheelScroll } from './hooks/useSmoothWheelScroll';

const AppShell: React.FC = () => {
  useSmoothWheelScroll();
  const { user, loading, activePersona } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-paper-2 flex items-center justify-center px-4">
        <div className="rounded-md bg-paper border border-line p-6 text-center space-y-2 max-w-sm w-full">
          <div className="h-9 w-9 rounded bg-brand-700 text-white flex items-center justify-center font-semibold text-lg mx-auto">
            U
          </div>
          <div className="font-semibold text-base text-ink">
            Loading Unified Health Platform
          </div>
          <p className="text-sm text-mut">
            Restoring session and clinical workspace...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LandingAndAuthPortal />;
  }

  return (
    <AppShellLayout>
      {user.isCentralRegistry || activePersona === 'CENTRAL_REGISTRY' ? (
        <CentralRegistryPortal />
      ) : activePersona === 'DOCTOR' && user.doctorProfile ? (
        <DoctorPortal />
      ) : activePersona === 'WORKSPACE' &&
        user.workspaces &&
        user.workspaces.length > 0 ? (
        <WorkspacePortal />
      ) : (
        <PatientPortal />
      )}
    </AppShellLayout>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
};

export default App;
