import React from 'react';
import { Download, Lock } from 'lucide-react';
import { ModalDialog } from './ModalDialog';
import { DataList } from './DataList';
import { downloadClinicalDocumentPdf } from '../utils/pdfDownload';

interface DocumentViewerModalProps {
  doc: any | null;
  onClose: () => void;
  fallbackPatient?: any;
}

export const DocumentViewerModal: React.FC<DocumentViewerModalProps> = ({
  doc,
  onClose,
  fallbackPatient,
}) => {
  const data = doc?.structuredData || {};

  const formatDocType = (type?: string) => {
    if (type === 'PRESCRIPTION') return 'Prescription';
    if (type === 'LAB_REPORT') return 'Laboratory Report';
    if (type === 'BILLING_DOC') return 'Billing Statement';
    return type || 'Medical Record';
  };

  return (
    <ModalDialog
      open={Boolean(doc)}
      onClose={onClose}
      title={doc?.title || 'Medical Record'}
      subtitle={
        doc
          ? `${formatDocType(doc.type)} · ${doc.documentCode} · Issued ${new Date(doc.createdAt).toLocaleString()}`
          : undefined
      }
      maxWidthClass="max-w-2xl"
    >
      {doc && (
        <div className="space-y-4">
          <div className="rounded-md border border-line bg-paper-2 p-3.5 flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-0.5 text-sm">
              <div>
                <span className="text-mut">Facility:</span>{' '}
                <strong className="text-ink">
                  {doc.workspace?.name ||
                    doc.workspaceNameSnapshot ||
                    'Independent Chamber'}
                </strong>
              </div>
              {(doc.doctor?.patientUser?.name || doc.doctorNameSnapshot) && (
                <div>
                  <span className="text-mut">Clinician:</span>{' '}
                  <strong className="text-ink">
                    {doc.doctor?.patientUser?.name || doc.doctorNameSnapshot}
                  </strong>
                </div>
              )}
              {doc.isImmutable && (
                <div className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-700 pt-1">
                  <Lock className="w-3.5 h-3.5" /> Permanently locked clinical
                  record
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {doc.fileUrl && (
                <a
                  href={doc.fileUrl}
                  download={`${doc.documentCode}-attachment`}
                  className="btn-secondary"
                >
                  Download Attachment
                </a>
              )}
              <button
                type="button"
                onClick={() => downloadClinicalDocumentPdf(doc, fallbackPatient)}
                className="btn-primary"
              >
                <Download className="w-4 h-4" />
                <span>Download PDF</span>
              </button>
            </div>
          </div>

          {doc.type === 'PRESCRIPTION' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="rounded-md border border-line p-3 bg-paper">
                  <div className="text-xs font-medium text-mut">
                    Primary Diagnosis
                  </div>
                  <div className="font-semibold text-ink mt-0.5">
                    {data.diagnosis || doc.summary || '—'}
                  </div>
                </div>
                <div className="rounded-md border border-line p-3 bg-paper">
                  <div className="text-xs font-medium text-mut">
                    Chief Complaints
                  </div>
                  <div className="text-ink mt-0.5">
                    {data.chiefComplaints || '—'}
                  </div>
                </div>
              </div>

              {Array.isArray(data.medications) && data.medications.length > 0 && (
                <DataList
                  title="Medications"
                  data={data.medications.map((m: any, i: number) => ({
                    ...m,
                    _idx: String(i),
                  }))}
                  getRowId={(r: any) => r._idx}
                  columns={[
                    {
                      key: 'name',
                      header: 'Medication',
                      render: (m: any) => (
                        <span className="font-medium text-ink">{m.name}</span>
                      ),
                    },
                    {
                      key: 'dosage',
                      header: 'Dosage',
                      render: (m: any) => (
                        <span className="font-mono text-sm">{m.dosage}</span>
                      ),
                    },
                    {
                      key: 'duration',
                      header: 'Duration',
                      render: (m: any) => <span>{m.duration}</span>,
                    },
                    {
                      key: 'instruction',
                      header: 'Instructions',
                      render: (m: any) => (
                        <span className="text-mut">{m.instruction || '—'}</span>
                      ),
                    },
                  ]}
                />
              )}

              {data.advice && (
                <div className="rounded-md border border-line p-3 bg-paper-2 text-sm">
                  <span className="font-semibold text-ink">
                    Clinical Advice:{' '}
                  </span>
                  <span className="text-ink-2">{data.advice}</span>
                </div>
              )}
            </div>
          )}

          {doc.type === 'LAB_REPORT' && (
            <div className="space-y-4">
              {Array.isArray(data.parameters) && data.parameters.length > 0 && (
                <DataList
                  title={data.testCategory || 'Measured Parameters'}
                  data={data.parameters.map((p: any, i: number) => ({
                    ...p,
                    _idx: String(i),
                  }))}
                  getRowId={(r: any) => r._idx}
                  columns={[
                    {
                      key: 'name',
                      header: 'Parameter',
                      render: (p: any) => (
                        <span className="font-medium text-ink">{p.name}</span>
                      ),
                    },
                    {
                      key: 'result',
                      header: 'Result',
                      render: (p: any) => (
                        <span className="font-mono font-semibold text-ink">
                          {p.result}
                        </span>
                      ),
                    },
                    {
                      key: 'range',
                      header: 'Reference Range',
                      render: (p: any) => (
                        <span className="font-mono text-mut">
                          {p.referenceRange || '—'}
                        </span>
                      ),
                    },
                    {
                      key: 'flag',
                      header: 'Status',
                      render: (p: any) => (
                        <span
                          className={`font-medium ${
                            p.flag && p.flag !== 'NORMAL'
                              ? 'text-accent-600'
                              : 'text-brand-700'
                          }`}
                        >
                          {p.flag || 'Normal'}
                        </span>
                      ),
                    },
                  ]}
                />
              )}
              {data.conclusion && (
                <div className="rounded-md border border-line p-3 bg-paper-2 text-sm">
                  <span className="font-semibold text-ink">Conclusion: </span>
                  <span className="text-ink-2">{data.conclusion}</span>
                </div>
              )}
            </div>
          )}

          {doc.type === 'BILLING_DOC' && (
            <div className="space-y-4">
              {Array.isArray(data.items) && data.items.length > 0 && (
                <DataList
                  title="Invoice Line Items"
                  data={data.items.map((item: any, i: number) => ({
                    ...item,
                    _idx: String(i),
                  }))}
                  getRowId={(r: any) => r._idx}
                  columns={[
                    {
                      key: 'desc',
                      header: 'Service Description',
                      render: (it: any) => (
                        <span className="font-medium text-ink">
                          {it.description}
                        </span>
                      ),
                    },
                    {
                      key: 'qty',
                      header: 'Qty',
                      render: (it: any) => (
                        <span className="font-mono">{it.qty || 1}</span>
                      ),
                    },
                    {
                      key: 'amt',
                      header: 'Amount',
                      align: 'right',
                      render: (it: any) => (
                        <span className="font-mono font-semibold text-ink">
                          {(
                            Number(it.amount || it.price || 0) *
                            Number(it.qty || 1)
                          ).toLocaleString()}{' '}
                          Tk
                        </span>
                      ),
                    },
                  ]}
                />
              )}
              <div className="rounded-md border border-line bg-paper-2 p-3.5 flex items-center justify-between text-base font-semibold">
                <span>Total ({data.paymentStatus || 'PAID'})</span>
                <span className="font-mono text-brand-700">
                  {Number(data.totalAmount ?? 0).toLocaleString()} Tk
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </ModalDialog>
  );
};
