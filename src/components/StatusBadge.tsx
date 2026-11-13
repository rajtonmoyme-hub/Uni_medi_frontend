import React from 'react';

export type BadgeTone = 'brand' | 'success' | 'warning' | 'danger' | 'neutral';

interface StatusBadgeProps {
  label: string;
  tone?: BadgeTone;
}

const TONE_CLASSES: Record<BadgeTone, string> = {
  brand: 'bg-brand-50 text-brand-800 border-brand-200',
  success: 'bg-brand-50 text-brand-800 border-brand-200',
  warning: 'bg-gold-50 text-gold-700 border-gold-100',
  danger: 'bg-accent-50 text-accent-600 border-accent-100',
  neutral: 'bg-paper-2 text-ink-2 border-line',
};

export function inferStatusTone(status?: string): BadgeTone {
  const s = (status || '').toUpperCase();
  if (
    [
      'ACTIVE',
      'APPROVED',
      'ACCEPTED',
      'PAID',
      'COMPLETED',
      'NORMAL',
      'SCANNED_ACTIVE',
      'VERIFIED',
    ].includes(s)
  ) {
    return 'brand';
  }
  if (
    [
      'PENDING',
      'GENERATED',
      'PARTIAL',
      'UNPAID',
      'AWAITING',
      'INVITATION',
    ].includes(s)
  ) {
    return 'warning';
  }
  if (
    [
      'DISABLED',
      'DECLINED',
      'REJECTED',
      'REVOKED',
      'REMOVED',
      'CANCELLED',
      'HIGH',
      'LOW',
      'ABNORMAL',
      'EXPIRED',
    ].includes(s)
  ) {
    return 'danger';
  }
  return 'neutral';
}

export function formatStatusLabel(raw?: string): string {
  if (!raw) return 'Unknown';
  const map: Record<string, string> = {
    ACTIVE: 'Active',
    APPROVED: 'Approved',
    PENDING: 'Pending',
    DECLINED: 'Declined',
    DISABLED: 'Disabled',
    REJECTED: 'Declined',
    REVOKED: 'Revoked',
    REMOVED: 'Removed',
    ACCEPTED: 'Accepted',
    CANCELLED: 'Cancelled',
    COMPLETED: 'Completed',
    SCANNED_ACTIVE: 'Scanned (Active)',
    GENERATED: 'Awaiting Scan',
    EXPIRED: 'Expired',
    PRESCRIPTION: 'Prescription',
    LAB_REPORT: 'Lab Report',
    BILLING_DOC: 'Billing Invoice',
    NORMAL: 'Standard',
    CHILD: 'Child',
    OLD: 'Senior',
    PAID: 'Paid',
    UNPAID: 'Unpaid',
    PARTIAL: 'Partial',
    HOSPITAL: 'Hospital',
    CLINIC: 'Clinic',
    DIAGNOSTIC_CENTER: 'Diagnostic Center',
    CHAMBER: 'Chamber',
  };
  if (map[raw]) return map[raw];
  return raw
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ label, tone }) => {
  const resolvedTone = tone || inferStatusTone(label);
  const display = formatStatusLabel(label);
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium border whitespace-nowrap ${TONE_CLASSES[resolvedTone]}`}
    >
      {display}
    </span>
  );
};
