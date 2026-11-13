import React, { useState, useEffect } from 'react';
import {
  Stethoscope,
  Building2,
  ShieldCheck,
  Eye,
  EyeOff,
  ChevronRight,
  ArrowLeft,
} from 'lucide-react';
import { apiRequest } from '../services/api';
import { useAuth, ActivePersona } from '../context/AuthContext';

type PortalView =
  | 'PATIENT_LOGIN'
  | 'PATIENT_REGISTER'
  | 'PATIENT_OTP'
  | 'NOT_A_PATIENT_HUB'
  | 'DOCTOR_LOGIN'
  | 'DOCTOR_REGISTER'
  | 'WORKSPACE_LOGIN'
  | 'WORKSPACE_REGISTER'
  | 'DGHS_LOGIN';

export const LandingAndAuthPortal: React.FC = () => {
  const { loginWithToken } = useAuth();
  const [view, setView] = useState<PortalView>('PATIENT_LOGIN');
  const [error, setError] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);

  useEffect(() => {
    if (!error && !successMsg) return;
    const timer = setTimeout(() => {
      setError('');
      setSuccessMsg('');
    }, 4500);
    return () => clearTimeout(timer);
  }, [error, successMsg]);

  // Login Form State
  const [loginIdentifier, setLoginIdentifier] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');

  // Patient Registration State
  const [patName, setPatName] = useState<string>('');
  const [patEmail, setPatEmail] = useState<string>('');
  const [patPhone, setPatPhone] = useState<string>('');
  const [patPassword, setPatPassword] = useState<string>('');
  const [patAccountType, setPatAccountType] = useState<
    'NORMAL' | 'CHILD' | 'OLD'
  >('NORMAL');
  const [patMaintainerId, setPatMaintainerId] = useState<string>('');
  const [patRelationshipLabel, setPatRelationshipLabel] = useState<string>('');

  // OTP Verification State
  const [otpIdentifier, setOtpIdentifier] = useState<string>('');
  const [otpUniqueId, setOtpUniqueId] = useState<string>('');
  const [otpCode, setOtpCode] = useState<string>('');
  const [demoOtpHint, setDemoOtpHint] = useState<string>('');

  // Doctor Registration State
  const [docName, setDocName] = useState<string>('');
  const [docEmail, setDocEmail] = useState<string>('');
  const [docPhone, setDocPhone] = useState<string>('');
  const [docPassword, setDocPassword] = useState<string>('');
  const [docLicense, setDocLicense] = useState<string>('');
  const [docNid, setDocNid] = useState<string>('');
  const [docSpecialty, setDocSpecialty] = useState<string>('Cardiology');
  const [docDegrees, setDocDegrees] = useState<string>('MBBS, FCPS');
  const [docArea, setDocArea] = useState<string>('Dhanmondi, Dhaka');
  const [docFee, setDocFee] = useState<string>('1200');

  // Hospital / Workspace Registration State
  const [wsName, setWsName] = useState<string>('');
  const [wsType, setWsType] = useState<string>('HOSPITAL');
  const [wsLicense, setWsLicense] = useState<string>('');
  const [wsAddress, setWsAddress] = useState<string>('');
  const [wsArea, setWsArea] = useState<string>('Dhaka');
  const [ownerName, setOwnerName] = useState<string>('');
  const [ownerEmail, setOwnerEmail] = useState<string>('');
  const [ownerPhone, setOwnerPhone] = useState<string>('');
  const [ownerNid, setOwnerNid] = useState<string>('');
  const [ownerPassword, setOwnerPassword] = useState<string>('');

  const switchView = (nextView: PortalView, pushHistory = true) => {
    setError('');
    setSuccessMsg('');
    setShowPassword(false);
    setView(nextView);
    if (pushHistory && typeof window !== 'undefined') {
      window.history.pushState(
        { umpAuthView: nextView },
        '',
        `#/auth/${nextView.toLowerCase()}`
      );
    }
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.history.replaceState(
      { umpAuthView: 'PATIENT_LOGIN' },
      '',
      '#/auth/patient_login'
    );
    const handlePopState = (event: PopStateEvent) => {
      const nextView = event.state?.umpAuthView as PortalView | undefined;
      if (nextView) {
        setError('');
        setSuccessMsg('');
        setShowPassword(false);
        setView(nextView);
        window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleLoginSubmit = async (
    e: React.FormEvent,
    preferredPersona: ActivePersona
  ) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setSubmitting(true);
    try {
      const res = await apiRequest('/auth/login', {
        method: 'POST',
        body: {
          identifier: loginIdentifier,
          password: loginPassword,
        },
      });
      loginWithToken(res.token, res.user, preferredPersona);
    } catch (err: any) {
      if (err.data?.requiresOtp) {
        setOtpIdentifier(err.data.email || loginIdentifier);
        setOtpUniqueId(err.data.uniqueId || '');
        if (err.data.demoOtpHint) setDemoOtpHint(err.data.demoOtpHint);
        setView('PATIENT_OTP');
        setError('Please complete OTP verification to activate your account.');
      } else {
        setError(err.message || 'Authentication failed.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickDemoLogin = async (
    identifier: string,
    password: string,
    persona: ActivePersona
  ) => {
    setError('');
    setSuccessMsg('');
    setSubmitting(true);
    try {
      const res = await apiRequest('/auth/login', {
        method: 'POST',
        body: { identifier, password },
      });
      loginWithToken(res.token, res.user, persona);
    } catch (err: any) {
      setError(err.message || 'Demo sign-in failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePatientRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setSubmitting(true);
    try {
      const res = await apiRequest('/auth/patient/register', {
        method: 'POST',
        body: {
          name: patName,
          email: patEmail,
          phone: patPhone,
          password: patPassword,
          accountType: patAccountType,
          maintainerIdentifier:
            patAccountType !== 'NORMAL' ? patMaintainerId : undefined,
          relationshipLabel:
            patAccountType !== 'NORMAL' ? patRelationshipLabel : undefined,
        },
      });
      setOtpIdentifier(res.email);
      setOtpUniqueId(res.uniqueId);
      setDemoOtpHint(res.demoOtpHint || '');
      setSuccessMsg(
        `Account created (${res.uniqueId}). Enter the 6-digit verification code below.`
      );
      setView('PATIENT_OTP');
    } catch (err: any) {
      setError(err.message || 'Registration failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setSubmitting(true);
    try {
      const res = await apiRequest('/auth/patient/verify-otp', {
        method: 'POST',
        body: {
          identifier: otpIdentifier,
          otpCode,
        },
      });
      loginWithToken(res.token, res.user, 'PATIENT');
    } catch (err: any) {
      setError(err.message || 'OTP verification failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDoctorRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setSubmitting(true);
    try {
      const res = await apiRequest('/auth/doctor/register', {
        method: 'POST',
        body: {
          name: docName,
          email: docEmail,
          phone: docPhone,
          password: docPassword,
          doctorLicense: docLicense,
          nationalId: docNid,
          specialty: docSpecialty,
          degrees: docDegrees,
          area: docArea,
          defaultConsultationFee: Number(docFee) || 1000,
        },
      });
      loginWithToken(res.token, res.user, 'DOCTOR');
    } catch (err: any) {
      setError(err.message || 'Doctor registration failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleWorkspaceRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setSubmitting(true);
    try {
      const res = await apiRequest('/auth/workspace/register', {
        method: 'POST',
        body: {
          workspaceName: wsName,
          type: wsType,
          registrationLicense: wsLicense,
          address: wsAddress,
          area: wsArea,
          workspaceEmail: ownerEmail,
          workspacePhone: ownerPhone,
          ownerName,
          ownerEmail,
          ownerPhone,
          ownerNationalId: ownerNid,
          ownerPassword,
        },
      });
      loginWithToken(res.token, res.user, 'WORKSPACE');
    } catch (err: any) {
      setError(err.message || 'Hospital registration failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const isWideForm =
    view === 'DOCTOR_REGISTER' || view === 'WORKSPACE_REGISTER';

  const renderPasswordField = (
    id: string,
    label: string,
    value: string,
    onChange: (val: string) => void,
    autoComplete: 'current-password' | 'new-password'
  ) => (
    <div>
      <label
        htmlFor={id}
        className="block text-sm font-medium text-ink-2 mb-1"
      >
        {label}
      </label>
      <div className="flex gap-1.5">
        <input
          id={id}
          name="password"
          type={showPassword ? 'text' : 'password'}
          required
          minLength={autoComplete === 'new-password' ? 6 : undefined}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 rounded-md border border-line bg-paper px-3 py-2 text-base text-ink"
        />
        <button
          type="button"
          aria-pressed={showPassword}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
          onClick={() => setShowPassword((p) => !p)}
          className="btn-secondary !px-2.5"
        >
          {showPassword ? (
            <EyeOff className="w-4 h-4 text-mut" />
          ) : (
            <Eye className="w-4 h-4 text-mut" />
          )}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen min-h-dvh flex flex-col bg-paper-2 text-ink">
      {/* Compact Single-Row Header */}
      <header className="h-14 bg-paper border-b border-line px-4 sm:px-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded bg-brand-700 text-white flex items-center justify-center font-semibold text-base">
            U
          </div>
          <span className="font-semibold text-base text-ink">
            Unified Health Platform
          </span>
        </div>

        <div>
          {view === 'PATIENT_LOGIN' || view === 'PATIENT_REGISTER' ? (
            <button
              type="button"
              onClick={() => switchView('NOT_A_PATIENT_HUB')}
              className="btn-secondary"
            >
              <span>Not a Patient?</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => switchView('PATIENT_LOGIN')}
              className="btn-secondary"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Patient Sign In</span>
            </button>
          )}
        </div>
      </header>

      {/* Centered Auth Workspace */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-10">
        <div
          className={`w-full ${
            isWideForm ? 'max-w-xl' : 'max-w-md'
          } space-y-4`}
        >
          <div className="bg-paper border border-line rounded-md surface-clip">
            {error && (
              <div
                role="alert"
                className="bg-accent-50 border-b border-accent-100 px-5 py-3 text-sm font-medium text-accent-600"
              >
                {error}
              </div>
            )}
            {successMsg && (
              <div
                role="status"
                className="bg-brand-50 border-b border-brand-200 px-5 py-3 text-sm font-medium text-brand-800"
              >
                {successMsg}
              </div>
            )}

            {/* 1. PATIENT SIGN IN */}
            {view === 'PATIENT_LOGIN' && (
              <div className="p-6 space-y-5">
                <div className="flex items-start justify-between gap-3 border-b border-line pb-4">
                  <div>
                    <h1 className="text-xl font-semibold text-ink">
                      Patient Sign In
                    </h1>
                    <p className="text-sm text-mut mt-0.5">
                      Access your medical records, appointments, and family
                      accounts.
                    </p>
                  </div>
                </div>

                <form
                  onSubmit={(e) => handleLoginSubmit(e, 'PATIENT')}
                  className="space-y-4"
                >
                  <div>
                    <label
                      htmlFor="pat-login-id"
                      className="block text-sm font-medium text-ink-2 mb-1"
                    >
                      Email, Phone, or Patient ID
                    </label>
                    <input
                      id="pat-login-id"
                      name="identifier"
                      type="text"
                      required
                      autoComplete="username"
                      autoCorrect="off"
                      autoCapitalize="none"
                      spellCheck={false}
                      value={loginIdentifier}
                      onChange={(e) => setLoginIdentifier(e.target.value)}
                      placeholder="patient@demo.bd or +8801711000001"
                      className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base text-ink"
                    />
                  </div>

                  {renderPasswordField(
                    'pat-login-pass',
                    'Password',
                    loginPassword,
                    setLoginPassword,
                    'current-password'
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="btn-primary w-full py-2"
                  >
                    {submitting ? 'Signing in...' : 'Sign In'}
                  </button>
                </form>

                <div className="pt-4 border-t border-line flex items-center justify-between text-sm">
                  <button
                    type="button"
                    onClick={() => switchView('PATIENT_REGISTER')}
                    className="font-medium text-brand-700 hover:underline"
                  >
                    Create Patient Account
                  </button>
                  <button
                    type="button"
                    onClick={() => switchView('NOT_A_PATIENT_HUB')}
                    className="font-medium text-ink-2 hover:text-ink"
                  >
                    Not a Patient?
                  </button>
                </div>
              </div>
            )}

            {/* 2. PATIENT REGISTRATION */}
            {view === 'PATIENT_REGISTER' && (
              <div className="p-6 space-y-5">
                <div className="border-b border-line pb-4">
                  <h1 className="text-xl font-semibold text-ink">
                    Create Patient Account
                  </h1>
                  <p className="text-sm text-mut mt-0.5">
                    Register with your contact details and verify via one-time
                    code.
                  </p>
                </div>

                <form onSubmit={handlePatientRegister} className="space-y-4">
                  <div>
                    <label
                      htmlFor="reg-name"
                      className="block text-sm font-medium text-ink-2 mb-1"
                    >
                      Full Name
                    </label>
                    <input
                      id="reg-name"
                      name="name"
                      type="text"
                      required
                      autoComplete="name"
                      value={patName}
                      onChange={(e) => setPatName(e.target.value)}
                      placeholder="Tanvir Ahmed"
                      className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base text-ink"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor="reg-email"
                        className="block text-sm font-medium text-ink-2 mb-1"
                      >
                        Email Address
                      </label>
                      <input
                        id="reg-email"
                        name="email"
                        type="email"
                        required
                        autoComplete="email"
                        autoCorrect="off"
                        autoCapitalize="none"
                        value={patEmail}
                        onChange={(e) => setPatEmail(e.target.value)}
                        placeholder="name@example.com"
                        className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base text-ink"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="reg-phone"
                        className="block text-sm font-medium text-ink-2 mb-1"
                      >
                        Phone Number
                      </label>
                      <input
                        id="reg-phone"
                        name="phone"
                        type="tel"
                        required
                        autoComplete="tel"
                        value={patPhone}
                        onChange={(e) => setPatPhone(e.target.value)}
                        placeholder="+88017XXXXXXXX"
                        className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base text-ink"
                      />
                    </div>
                  </div>

                  {renderPasswordField(
                    'reg-password',
                    'Password (minimum 6 characters)',
                    patPassword,
                    setPatPassword,
                    'new-password'
                  )}

                  <fieldset className="border border-line rounded-md p-3 bg-paper-2">
                    <legend className="text-xs font-medium text-mut px-1">
                      Account Category
                    </legend>
                    <div className="grid grid-cols-3 gap-2 mt-1">
                      {(['NORMAL', 'CHILD', 'OLD'] as const).map((t) => (
                        <label
                          key={t}
                          className={`flex items-center justify-center rounded border px-2.5 py-1.5 text-sm font-medium cursor-pointer ${
                            patAccountType === t
                              ? 'bg-brand-700 text-white border-brand-700'
                              : 'bg-paper text-ink-2 border-line'
                          }`}
                        >
                          <input
                            type="radio"
                            name="accountType"
                            value={t}
                            checked={patAccountType === t}
                            onChange={() => setPatAccountType(t)}
                            className="visually-hidden"
                          />
                          <span>
                            {t === 'NORMAL'
                              ? 'Standard'
                              : t === 'CHILD'
                                ? 'Child'
                                : 'Senior'}
                          </span>
                        </label>
                      ))}
                    </div>

                    {patAccountType !== 'NORMAL' && (
                      <div className="mt-3 pt-3 border-t border-line space-y-2.5">
                        <input
                          type="text"
                          value={patMaintainerId}
                          onChange={(e) => setPatMaintainerId(e.target.value)}
                          placeholder="Optional Maintainer ID, Email, or Phone"
                          className="w-full rounded-md border border-line bg-paper px-3 py-1.5 text-sm text-ink"
                        />
                        <input
                          type="text"
                          value={patRelationshipLabel}
                          onChange={(e) =>
                            setPatRelationshipLabel(e.target.value)
                          }
                          placeholder="Relationship (e.g. Son, Daughter, Parent)"
                          className="w-full rounded-md border border-line bg-paper px-3 py-1.5 text-sm text-ink"
                        />
                      </div>
                    )}
                  </fieldset>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="btn-primary w-full py-2"
                  >
                    {submitting ? 'Creating account...' : 'Register & Send OTP'}
                  </button>
                </form>

                <div className="pt-4 border-t border-line text-sm">
                  <button
                    type="button"
                    onClick={() => switchView('PATIENT_LOGIN')}
                    className="font-medium text-brand-700 hover:underline"
                  >
                    Already have an account? Sign In
                  </button>
                </div>
              </div>
            )}

            {/* 3. OTP VERIFICATION */}
            {view === 'PATIENT_OTP' && (
              <div className="p-6 space-y-5">
                <div className="border-b border-line pb-4">
                  <h1 className="text-xl font-semibold text-ink">
                    Verify One-Time Code
                  </h1>
                  {otpUniqueId && (
                    <p className="text-sm font-mono text-brand-700 mt-1">
                      Patient ID: {otpUniqueId}
                    </p>
                  )}
                </div>

                {demoOtpHint && (
                  <div className="rounded-md bg-paper-2 border border-line p-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs text-mut">Verification Code</div>
                      <div className="font-mono text-lg font-semibold text-ink">
                        {demoOtpHint}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setOtpCode(demoOtpHint)}
                      className="btn-secondary"
                    >
                      Fill Code
                    </button>
                  </div>
                )}

                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div>
                    <label
                      htmlFor="otp-input"
                      className="block text-sm font-medium text-ink-2 mb-1"
                    >
                      6-Digit Verification Code
                    </label>
                    <input
                      id="otp-input"
                      name="otpCode"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="\d{6}"
                      maxLength={6}
                      required
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      placeholder="123456"
                      className="w-full rounded-md border border-line bg-paper px-3 py-2.5 text-center font-mono text-xl font-semibold tracking-widest text-ink"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="btn-primary w-full py-2"
                  >
                    {submitting ? 'Verifying...' : 'Verify & Continue'}
                  </button>
                </form>
              </div>
            )}

            {/* 4. NOT A PATIENT HUB */}
            {view === 'NOT_A_PATIENT_HUB' && (
              <div className="p-6 space-y-4">
                <div className="border-b border-line pb-4">
                  <h1 className="text-xl font-semibold text-ink">
                    Provider & Governance Portals
                  </h1>
                  <p className="text-sm text-mut mt-0.5">
                    Select your institutional role to sign in or submit an
                    application.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="rounded-md border border-line p-4 bg-paper-2 space-y-3">
                    <div className="flex items-center gap-2.5">
                      <Stethoscope className="w-4 h-4 text-brand-700" />
                      <h2 className="text-base font-semibold text-ink">
                        Doctor Portal
                      </h2>
                    </div>
                    <p className="text-sm text-mut">
                      Scan patient QR codes, issue prescriptions, and manage
                      hospital affiliations.
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => switchView('DOCTOR_LOGIN')}
                        className="btn-primary flex-1"
                      >
                        Doctor Sign In
                      </button>
                      <button
                        type="button"
                        onClick={() => switchView('DOCTOR_REGISTER')}
                        className="btn-secondary flex-1"
                      >
                        Apply as Doctor
                      </button>
                    </div>
                  </div>

                  <div className="rounded-md border border-line p-4 bg-paper-2 space-y-3">
                    <div className="flex items-center gap-2.5">
                      <Building2 className="w-4 h-4 text-brand-700" />
                      <h2 className="text-base font-semibold text-ink">
                        Hospital & Workspace Portal
                      </h2>
                    </div>
                    <p className="text-sm text-mut">
                      Manage appointments, laboratory reports, billing, staff
                      roles, and health packages.
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => switchView('WORKSPACE_LOGIN')}
                        className="btn-primary flex-1"
                      >
                        Hospital Sign In
                      </button>
                      <button
                        type="button"
                        onClick={() => switchView('WORKSPACE_REGISTER')}
                        className="btn-secondary flex-1"
                      >
                        Register Facility
                      </button>
                    </div>
                  </div>

                  <div className="rounded-md border border-line p-4 bg-paper-2 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <ShieldCheck className="w-4 h-4 text-brand-700" />
                      <div>
                        <h2 className="text-base font-semibold text-ink">
                          Central Registry (DGHS)
                        </h2>
                        <p className="text-xs text-mut">
                          National verification & oversight
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => switchView('DGHS_LOGIN')}
                      className="btn-secondary"
                    >
                      Registry Sign In
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 5. DOCTOR SIGN IN */}
            {view === 'DOCTOR_LOGIN' && (
              <div className="p-6 space-y-5">
                <div className="border-b border-line pb-4">
                  <h1 className="text-xl font-semibold text-ink">
                    Doctor Sign In
                  </h1>
                  <p className="text-sm text-mut mt-0.5">
                    Sign in to your clinical portal. You can switch to your
                    Patient account anytime from the header.
                  </p>
                </div>

                <form
                  onSubmit={(e) => handleLoginSubmit(e, 'DOCTOR')}
                  className="space-y-4"
                >
                  <div>
                    <label
                      htmlFor="doc-login-id"
                      className="block text-sm font-medium text-ink-2 mb-1"
                    >
                      Email, Phone, or Doctor ID
                    </label>
                    <input
                      id="doc-login-id"
                      type="text"
                      required
                      autoComplete="username"
                      value={loginIdentifier}
                      onChange={(e) => setLoginIdentifier(e.target.value)}
                      placeholder="dr.rahman@demo.bd"
                      className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base text-ink"
                    />
                  </div>

                  {renderPasswordField(
                    'doc-login-pass',
                    'Password',
                    loginPassword,
                    setLoginPassword,
                    'current-password'
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="btn-primary w-full py-2"
                  >
                    {submitting ? 'Signing in...' : 'Sign In as Doctor'}
                  </button>
                </form>

                <div className="pt-4 border-t border-line flex items-center justify-between text-sm">
                  <button
                    type="button"
                    onClick={() => switchView('DOCTOR_REGISTER')}
                    className="font-medium text-brand-700 hover:underline"
                  >
                    Apply for Doctor Registration
                  </button>
                  <button
                    type="button"
                    onClick={() => switchView('NOT_A_PATIENT_HUB')}
                    className="text-mut hover:text-ink"
                  >
                    Back
                  </button>
                </div>
              </div>
            )}

            {/* 6. DOCTOR REGISTRATION */}
            {view === 'DOCTOR_REGISTER' && (
              <div className="p-6 space-y-5">
                <div className="border-b border-line pb-4">
                  <h1 className="text-xl font-semibold text-ink">
                    Doctor Registration Application
                  </h1>
                  <p className="text-sm text-mut mt-0.5">
                    Automatically provisions your base Patient identity and
                    submits your BMDC license for Central Registry approval.
                  </p>
                </div>

                <form onSubmit={handleDoctorRegister} className="space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-ink-2 mb-1">
                        Full Name
                      </label>
                      <input
                        type="text"
                        required
                        value={docName}
                        onChange={(e) => setDocName(e.target.value)}
                        placeholder="Dr. A. K. M. Fazlul Haque"
                        className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base text-ink"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-ink-2 mb-1">
                        BMDC License Number
                      </label>
                      <input
                        type="text"
                        required
                        value={docLicense}
                        onChange={(e) => setDocLicense(e.target.value)}
                        placeholder="BMDC-A-48219"
                        className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base font-mono text-ink"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-ink-2 mb-1">
                        Email Address
                      </label>
                      <input
                        type="email"
                        required
                        value={docEmail}
                        onChange={(e) => setDocEmail(e.target.value)}
                        placeholder="doctor@example.com"
                        className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base text-ink"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-ink-2 mb-1">
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        required
                        value={docPhone}
                        onChange={(e) => setDocPhone(e.target.value)}
                        placeholder="+88017XXXXXXXX"
                        className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base text-ink"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-ink-2 mb-1">
                        National ID (NID)
                      </label>
                      <input
                        type="text"
                        required
                        value={docNid}
                        onChange={(e) => setDocNid(e.target.value)}
                        placeholder="1985269481204"
                        className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base font-mono text-ink"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-ink-2 mb-1">
                        Specialty
                      </label>
                      <input
                        type="text"
                        required
                        value={docSpecialty}
                        onChange={(e) => setDocSpecialty(e.target.value)}
                        className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base text-ink"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-ink-2 mb-1">
                        Degrees
                      </label>
                      <input
                        type="text"
                        value={docDegrees}
                        onChange={(e) => setDocDegrees(e.target.value)}
                        className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base text-ink"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-ink-2 mb-1">
                        Primary Area
                      </label>
                      <input
                        type="text"
                        value={docArea}
                        onChange={(e) => setDocArea(e.target.value)}
                        className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base text-ink"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-ink-2 mb-1">
                        Default Fee (Tk)
                      </label>
                      <input
                        type="number"
                        value={docFee}
                        onChange={(e) => setDocFee(e.target.value)}
                        className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base font-mono text-ink"
                      />
                    </div>
                  </div>

                  {renderPasswordField(
                    'doc-reg-pass',
                    'Password',
                    docPassword,
                    setDocPassword,
                    'new-password'
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="btn-primary w-full py-2"
                  >
                    {submitting
                      ? 'Submitting application...'
                      : 'Submit Doctor Application'}
                  </button>
                </form>

                <div className="pt-3 border-t border-line flex justify-between text-sm">
                  <button
                    type="button"
                    onClick={() => switchView('DOCTOR_LOGIN')}
                    className="font-medium text-brand-700 hover:underline"
                  >
                    Already registered? Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => switchView('NOT_A_PATIENT_HUB')}
                    className="text-mut hover:text-ink"
                  >
                    Back
                  </button>
                </div>
              </div>
            )}

            {/* 7. WORKSPACE / HOSPITAL SIGN IN */}
            {view === 'WORKSPACE_LOGIN' && (
              <div className="p-6 space-y-5">
                <div className="border-b border-line pb-4">
                  <h1 className="text-xl font-semibold text-ink">
                    Hospital & Workspace Sign In
                  </h1>
                  <p className="text-sm text-mut mt-0.5">
                    Sign in with your Owner, Admin, or Staff credentials.
                  </p>
                </div>

                <form
                  onSubmit={(e) => handleLoginSubmit(e, 'WORKSPACE')}
                  className="space-y-4"
                >
                  <div>
                    <label
                      htmlFor="ws-login-id"
                      className="block text-sm font-medium text-ink-2 mb-1"
                    >
                      Email, Phone, or Patient ID
                    </label>
                    <input
                      id="ws-login-id"
                      type="text"
                      required
                      autoComplete="username"
                      value={loginIdentifier}
                      onChange={(e) => setLoginIdentifier(e.target.value)}
                      placeholder="owner.evercare@demo.bd"
                      className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base text-ink"
                    />
                  </div>

                  {renderPasswordField(
                    'ws-login-pass',
                    'Password',
                    loginPassword,
                    setLoginPassword,
                    'current-password'
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="btn-primary w-full py-2"
                  >
                    {submitting ? 'Signing in...' : 'Sign In to Workspace'}
                  </button>
                </form>

                <div className="pt-4 border-t border-line flex items-center justify-between text-sm">
                  <button
                    type="button"
                    onClick={() => switchView('WORKSPACE_REGISTER')}
                    className="font-medium text-brand-700 hover:underline"
                  >
                    Register New Facility
                  </button>
                  <button
                    type="button"
                    onClick={() => switchView('NOT_A_PATIENT_HUB')}
                    className="text-mut hover:text-ink"
                  >
                    Back
                  </button>
                </div>
              </div>
            )}

            {/* 8. WORKSPACE / HOSPITAL REGISTRATION */}
            {view === 'WORKSPACE_REGISTER' && (
              <div className="p-6 space-y-5">
                <div className="border-b border-line pb-4">
                  <h1 className="text-xl font-semibold text-ink">
                    Register Hospital or Facility
                  </h1>
                  <p className="text-sm text-mut mt-0.5">
                    Assigns Single Primary Owner and submits facility license to
                    Central Registry.
                  </p>
                </div>

                <form onSubmit={handleWorkspaceRegister} className="space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-ink-2 mb-1">
                        Facility Name
                      </label>
                      <input
                        type="text"
                        required
                        value={wsName}
                        onChange={(e) => setWsName(e.target.value)}
                        placeholder="City Care Specialized Hospital"
                        className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base text-ink"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-ink-2 mb-1">
                        Facility Type
                      </label>
                      <select
                        value={wsType}
                        onChange={(e) => setWsType(e.target.value)}
                        className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base text-ink"
                      >
                        <option value="HOSPITAL">Hospital</option>
                        <option value="CLINIC">Clinic</option>
                        <option value="DIAGNOSTIC_CENTER">
                          Diagnostic Center
                        </option>
                        <option value="CHAMBER">Doctor Chamber</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-ink-2 mb-1">
                        DGHS Facility License
                      </label>
                      <input
                        type="text"
                        required
                        value={wsLicense}
                        onChange={(e) => setWsLicense(e.target.value)}
                        placeholder="DGHS-HOSP-2026-881"
                        className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base font-mono text-ink"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-ink-2 mb-1">
                        Area / City
                      </label>
                      <input
                        type="text"
                        required
                        value={wsArea}
                        onChange={(e) => setWsArea(e.target.value)}
                        placeholder="Gulshan, Dhaka"
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
                      required
                      value={wsAddress}
                      onChange={(e) => setWsAddress(e.target.value)}
                      placeholder="Plot 12, Road 45, Gulshan-2, Dhaka"
                      className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base text-ink"
                    />
                  </div>

                  <div className="pt-2 border-t border-line">
                    <div className="text-xs font-semibold text-mut mb-2">
                      Primary Owner Identity (Base Patient Account)
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-ink-2 mb-1">
                          Owner Full Name
                        </label>
                        <input
                          type="text"
                          required
                          value={ownerName}
                          onChange={(e) => setOwnerName(e.target.value)}
                          className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base text-ink"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-ink-2 mb-1">
                          Owner National ID
                        </label>
                        <input
                          type="text"
                          required
                          value={ownerNid}
                          onChange={(e) => setOwnerNid(e.target.value)}
                          className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base font-mono text-ink"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                      <div>
                        <label className="block text-sm font-medium text-ink-2 mb-1">
                          Owner Email
                        </label>
                        <input
                          type="email"
                          required
                          value={ownerEmail}
                          onChange={(e) => setOwnerEmail(e.target.value)}
                          className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base text-ink"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-ink-2 mb-1">
                          Owner Phone
                        </label>
                        <input
                          type="tel"
                          required
                          value={ownerPhone}
                          onChange={(e) => setOwnerPhone(e.target.value)}
                          className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base text-ink"
                        />
                      </div>
                    </div>

                    <div className="mt-3">
                      {renderPasswordField(
                        'ws-owner-pass',
                        'Owner Password',
                        ownerPassword,
                        setOwnerPassword,
                        'new-password'
                      )}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="btn-primary w-full py-2"
                  >
                    {submitting
                      ? 'Submitting application...'
                      : 'Submit Facility Registration'}
                  </button>
                </form>

                <div className="pt-3 border-t border-line flex justify-between text-sm">
                  <button
                    type="button"
                    onClick={() => switchView('WORKSPACE_LOGIN')}
                    className="font-medium text-brand-700 hover:underline"
                  >
                    Already registered? Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => switchView('NOT_A_PATIENT_HUB')}
                    className="text-mut hover:text-ink"
                  >
                    Back
                  </button>
                </div>
              </div>
            )}

            {/* 9. CENTRAL REGISTRY (DGHS) SIGN IN */}
            {view === 'DGHS_LOGIN' && (
              <div className="p-6 space-y-5">
                <div className="border-b border-line pb-4">
                  <h1 className="text-xl font-semibold text-ink">
                    Central Registry Sign In
                  </h1>
                  <p className="text-sm text-mut mt-0.5">
                    Directorate General of Health Services (DGHS) governance
                    access.
                  </p>
                </div>

                <form
                  onSubmit={(e) => handleLoginSubmit(e, 'CENTRAL_REGISTRY')}
                  className="space-y-4"
                >
                  <div>
                    <label
                      htmlFor="dghs-login-id"
                      className="block text-sm font-medium text-ink-2 mb-1"
                    >
                      Registry Email or Code
                    </label>
                    <input
                      id="dghs-login-id"
                      type="text"
                      required
                      autoComplete="username"
                      value={loginIdentifier}
                      onChange={(e) => setLoginIdentifier(e.target.value)}
                      placeholder="dghs@health.gov.bd"
                      className="w-full rounded-md border border-line bg-paper px-3 py-2 text-base text-ink"
                    />
                  </div>

                  {renderPasswordField(
                    'dghs-login-pass',
                    'Password',
                    loginPassword,
                    setLoginPassword,
                    'current-password'
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="btn-primary w-full py-2"
                  >
                    {submitting ? 'Authenticating...' : 'Sign In to Registry'}
                  </button>
                </form>

                <div className="pt-3 border-t border-line text-sm">
                  <button
                    type="button"
                    onClick={() => switchView('NOT_A_PATIENT_HUB')}
                    className="text-mut hover:text-ink"
                  >
                    ← Back to Provider Portals
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Collapsible Demo Account Switcher (Clean <details> disclosure) */}
          <details className="bg-paper border border-line rounded-md px-4 py-3 text-sm">
            <summary className="font-medium text-ink-2 cursor-pointer select-none">
              Demo Accounts (Quick Sign-In)
            </summary>
            <div className="mt-3 pt-3 border-t border-line grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() =>
                  handleQuickDemoLogin(
                    'patient@demo.bd',
                    'Demo@2026',
                    'PATIENT'
                  )
                }
                className="btn-secondary justify-start text-left"
              >
                Patient + Maintainer (Tanvir)
              </button>
              <button
                type="button"
                onClick={() =>
                  handleQuickDemoLogin('child@demo.bd', 'Demo@2026', 'PATIENT')
                }
                className="btn-secondary justify-start text-left"
              >
                Child Account (Ayaan)
              </button>
              <button
                type="button"
                onClick={() =>
                  handleQuickDemoLogin(
                    'dr.rahman@demo.bd',
                    'Demo@2026',
                    'DOCTOR'
                  )
                }
                className="btn-secondary justify-start text-left"
              >
                Doctor (Prof. Dr. Rahman)
              </button>
              <button
                type="button"
                onClick={() =>
                  handleQuickDemoLogin(
                    'owner.evercare@demo.bd',
                    'Demo@2026',
                    'WORKSPACE'
                  )
                }
                className="btn-secondary justify-start text-left"
              >
                Hospital Owner (Evercare)
              </button>
              <button
                type="button"
                onClick={() =>
                  handleQuickDemoLogin(
                    'admin.evercare@demo.bd',
                    'Demo@2026',
                    'WORKSPACE'
                  )
                }
                className="btn-secondary justify-start text-left"
              >
                Hospital Admin (Nafisa)
              </button>
              <button
                type="button"
                onClick={() =>
                  handleQuickDemoLogin(
                    'staff.multi@demo.bd',
                    'Demo@2026',
                    'WORKSPACE'
                  )
                }
                className="btn-secondary justify-start text-left"
              >
                Multi-Role Staff (Reception + Billing)
              </button>
              <button
                type="button"
                onClick={() =>
                  handleQuickDemoLogin(
                    'lab.evercare@demo.bd',
                    'Demo@2026',
                    'WORKSPACE'
                  )
                }
                className="btn-secondary justify-start text-left"
              >
                Lab Technician (Mehedi)
              </button>
              <button
                type="button"
                onClick={() =>
                  handleQuickDemoLogin(
                    'dghs@health.gov.bd',
                    'DGHS@Admin2026!',
                    'CENTRAL_REGISTRY'
                  )
                }
                className="btn-secondary justify-start text-left"
              >
                Central Registry (DGHS)
              </button>
            </div>
          </details>
        </div>
      </main>
    </div>
  );
};
