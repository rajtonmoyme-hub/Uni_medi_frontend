import { jsPDF } from 'jspdf';

export function downloadClinicalDocumentPdf(doc: any, fallbackPatient?: any) {
  if (!doc) return;

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  let y = 18;

  const ensureSpace = (neededMm: number) => {
    if (y + neededMm > 276) {
      pdf.addPage();
      y = 18;
    }
  };

  // Top Institutional Header Band
  pdf.setFillColor(0, 88, 48); // #005830
  pdf.rect(0, 0, pageWidth, 24, 'F');

  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(14);
  pdf.text('UNIFIED HEALTH PLATFORM', margin, 11);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9.5);
  const typeLabel =
    doc.type === 'PRESCRIPTION'
      ? 'Clinical Prescription Record'
      : doc.type === 'LAB_REPORT'
        ? 'Diagnostic Laboratory Report'
        : 'Medical Billing Statement';
  pdf.text(typeLabel, margin, 17.5);

  pdf.setFont('courier', 'bold');
  pdf.setFontSize(10.5);
  pdf.text(
    String(doc.documentCode || 'DOC-RECORD'),
    pageWidth - margin,
    11,
    { align: 'right' }
  );

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8.5);
  pdf.text(
    `Issued: ${new Date(doc.createdAt || Date.now()).toLocaleString()}`,
    pageWidth - margin,
    17.5,
    { align: 'right' }
  );

  y = 33;

  // Document Title
  pdf.setTextColor(16, 22, 19);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(13);
  const titleLines = pdf.splitTextToSize(String(doc.title || typeLabel), contentWidth);
  pdf.text(titleLines, margin, y);
  y += titleLines.length * 6 + 3;

  // Metadata Box (Patient & Provider)
  pdf.setDrawColor(227, 234, 229);
  pdf.setFillColor(248, 250, 248);
  pdf.roundedRect(margin, y, contentWidth, 24, 1.5, 1.5, 'FD');

  const patName =
    doc.patient?.name || fallbackPatient?.name || 'Registered Patient';
  const patId =
    doc.patient?.uniqueId || fallbackPatient?.uniqueId || 'N/A';
  const facilityName =
    doc.workspace?.name || doc.workspaceNameSnapshot || 'Independent Chamber';
  const doctorName =
    doc.doctor?.patientUser?.name || doc.doctorNameSnapshot || 'Clinical Staff';

  pdf.setFontSize(9.5);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(92, 107, 98);
  pdf.text('Patient', margin + 4, y + 7);
  pdf.text('Facility / Chamber', margin + contentWidth / 2 + 2, y + 7);

  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(16, 22, 19);
  pdf.text(`${patName} (${patId})`, margin + 4, y + 13);
  pdf.text(String(facilityName), margin + contentWidth / 2 + 2, y + 13);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8.5);
  pdf.setTextColor(92, 107, 98);
  pdf.text(
    doc.isImmutable ? 'Status: Permanently Locked (Immutable)' : 'Status: Verified Record',
    margin + 4,
    y + 19.5
  );
  pdf.text(`Author: ${doctorName}`, margin + contentWidth / 2 + 2, y + 19.5);

  y += 31;

  const data = doc.structuredData || {};

  // 1. PRESCRIPTION BODY
  if (doc.type === 'PRESCRIPTION') {
    if (data.diagnosis) {
      ensureSpace(16);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.setTextColor(0, 88, 48);
      pdf.text('Primary Diagnosis', margin, y);
      y += 5;
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(16, 22, 19);
      const diagLines = pdf.splitTextToSize(String(data.diagnosis), contentWidth);
      pdf.text(diagLines, margin, y);
      y += diagLines.length * 5 + 4;
    }

    if (data.chiefComplaints) {
      ensureSpace(14);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.setTextColor(43, 56, 49);
      pdf.text('Chief Complaints', margin, y);
      y += 5;
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(16, 22, 19);
      const ccLines = pdf.splitTextToSize(String(data.chiefComplaints), contentWidth);
      pdf.text(ccLines, margin, y);
      y += ccLines.length * 5 + 4;
    }

    if (data.vitals && typeof data.vitals === 'object') {
      ensureSpace(14);
      const vitalsText = [
        data.vitals.bp ? `BP: ${data.vitals.bp}` : null,
        data.vitals.pulse ? `Pulse: ${data.vitals.pulse}` : null,
        data.vitals.temp ? `Temp: ${data.vitals.temp}` : null,
        data.vitals.weight ? `Weight: ${data.vitals.weight}` : null,
      ]
        .filter(Boolean)
        .join('   |   ');
      if (vitalsText) {
        pdf.setFont('courier', 'normal');
        pdf.setFontSize(9);
        pdf.setTextColor(43, 56, 49);
        pdf.text(`Vitals: ${vitalsText}`, margin, y);
        y += 8;
      }
    }

    if (Array.isArray(data.medications) && data.medications.length > 0) {
      ensureSpace(22);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10.5);
      pdf.setTextColor(0, 88, 48);
      pdf.text('Prescribed Medications (Rx)', margin, y);
      y += 5;

      // Table Header
      pdf.setFillColor(240, 245, 241);
      pdf.rect(margin, y, contentWidth, 7.5, 'F');
      pdf.setFontSize(8.5);
      pdf.setTextColor(43, 56, 49);
      pdf.text('Medication Name', margin + 3, y + 5);
      pdf.text('Dosage', margin + 84, y + 5);
      pdf.text('Duration', margin + 118, y + 5);
      pdf.text('Instruction', margin + 144, y + 5);
      y += 9;

      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(16, 22, 19);
      data.medications.forEach((med: any, index: number) => {
        ensureSpace(9);
        pdf.setFont('helvetica', 'bold');
        pdf.text(`${index + 1}. ${med.name || ''}`, margin + 3, y + 4);
        pdf.setFont('courier', 'normal');
        pdf.text(String(med.dosage || '-'), margin + 84, y + 4);
        pdf.setFont('helvetica', 'normal');
        pdf.text(String(med.duration || '-'), margin + 118, y + 4);
        pdf.text(String(med.instruction || '-'), margin + 144, y + 4);
        pdf.setDrawColor(239, 244, 240);
        pdf.line(margin, y + 6.5, margin + contentWidth, y + 6.5);
        y += 8;
      });
      y += 4;
    }

    if (Array.isArray(data.recommendedTests) && data.recommendedTests.length > 0) {
      ensureSpace(14);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.setTextColor(43, 56, 49);
      pdf.text('Recommended Investigations', margin, y);
      y += 5;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9.5);
      pdf.text(data.recommendedTests.join(', '), margin, y);
      y += 8;
    }

    if (data.advice) {
      ensureSpace(16);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.setTextColor(43, 56, 49);
      pdf.text('Clinical Advice', margin, y);
      y += 5;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9.5);
      const advLines = pdf.splitTextToSize(String(data.advice), contentWidth);
      pdf.text(advLines, margin, y);
      y += advLines.length * 5 + 4;
    }

    if (data.followUpDate) {
      ensureSpace(10);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9.5);
      pdf.text(`Next Follow-Up Date: ${data.followUpDate}`, margin, y);
      y += 7;
    }
  }

  // 2. LABORATORY REPORT BODY
  if (doc.type === 'LAB_REPORT') {
    if (data.testCategory) {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.setTextColor(0, 88, 48);
      pdf.text(`Department / Category: ${data.testCategory}`, margin, y);
      y += 7;
    }

    if (Array.isArray(data.parameters) && data.parameters.length > 0) {
      pdf.setFillColor(240, 245, 241);
      pdf.rect(margin, y, contentWidth, 7.5, 'F');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8.5);
      pdf.setTextColor(43, 56, 49);
      pdf.text('Test Parameter', margin + 3, y + 5);
      pdf.text('Observed Result', margin + 78, y + 5);
      pdf.text('Reference Interval', margin + 118, y + 5);
      pdf.text('Flag', margin + 158, y + 5);
      y += 9;

      data.parameters.forEach((p: any) => {
        ensureSpace(9);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(16, 22, 19);
        pdf.text(String(p.name || ''), margin + 3, y + 4);
        pdf.setFont('courier', 'bold');
        pdf.text(String(p.result || ''), margin + 78, y + 4);
        pdf.setFont('courier', 'normal');
        pdf.setTextColor(92, 107, 98);
        pdf.text(String(p.referenceRange || '-'), margin + 118, y + 4);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(p.flag && p.flag !== 'NORMAL' ? 163 : 0, p.flag && p.flag !== 'NORMAL' ? 21 : 88, p.flag && p.flag !== 'NORMAL' ? 28 : 48);
        pdf.text(String(p.flag || 'NORMAL'), margin + 158, y + 4);
        pdf.setDrawColor(239, 244, 240);
        pdf.line(margin, y + 6.5, margin + contentWidth, y + 6.5);
        y += 8;
      });
      y += 5;
    }

    if (data.conclusion) {
      ensureSpace(18);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.setTextColor(43, 56, 49);
      pdf.text('Pathologist Remarks / Conclusion', margin, y);
      y += 5;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9.5);
      pdf.setTextColor(16, 22, 19);
      const concLines = pdf.splitTextToSize(String(data.conclusion), contentWidth);
      pdf.text(concLines, margin, y);
      y += concLines.length * 5 + 4;
    }
  }

  // 3. BILLING DOCUMENT BODY
  if (doc.type === 'BILLING_DOC') {
    if (Array.isArray(data.items) && data.items.length > 0) {
      pdf.setFillColor(240, 245, 241);
      pdf.rect(margin, y, contentWidth, 7.5, 'F');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8.5);
      pdf.setTextColor(43, 56, 49);
      pdf.text('Service Description', margin + 3, y + 5);
      pdf.text('Qty', margin + 122, y + 5);
      pdf.text('Amount (Tk)', margin + contentWidth - 3, y + 5, { align: 'right' });
      y += 9;

      data.items.forEach((item: any) => {
        ensureSpace(9);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(16, 22, 19);
        pdf.text(String(item.description || 'Clinical Service'), margin + 3, y + 4);
        pdf.setFont('courier', 'normal');
        pdf.text(String(item.qty || 1), margin + 122, y + 4);
        const lineTotal = Number(item.amount || item.price || 0) * Number(item.qty || 1);
        pdf.text(`${lineTotal.toLocaleString()} Tk`, margin + contentWidth - 3, y + 4, {
          align: 'right',
        });
        pdf.setDrawColor(239, 244, 240);
        pdf.line(margin, y + 6.5, margin + contentWidth, y + 6.5);
        y += 8;
      });
      y += 5;
    }

    ensureSpace(24);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(16, 22, 19);
    if (data.discount) {
      pdf.text(
        `Discount: -${Number(data.discount).toLocaleString()} Tk`,
        margin + contentWidth - 3,
        y,
        { align: 'right' }
      );
      y += 6;
    }
    pdf.setFontSize(11.5);
    pdf.setTextColor(0, 88, 48);
    pdf.text(
      `Total Payable: ${Number(data.totalAmount ?? 0).toLocaleString()} Tk (${data.paymentStatus || 'PAID'})`,
      margin + contentWidth - 3,
      y,
      { align: 'right' }
    );
    y += 8;
  }

  // Footer
  pdf.setDrawColor(227, 234, 229);
  pdf.line(margin, 280, pageWidth - margin, 280);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(124, 139, 130);
  pdf.text(
    'Generated via Unified Health Platform (DGHS Integrated Electronic Health Record)',
    margin,
    285
  );

  const safeFilename = `${String(doc.documentCode || doc.type || 'record').replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
  pdf.save(safeFilename);
}

export interface RegistryPdfReportSection {
  heading: string;
  rows: string[];
}

export interface RegistryPdfReportOptions {
  title: string;
  code: string;
  subtitle?: string;
  metrics?: { label: string; value: string | number }[];
  sections: RegistryPdfReportSection[];
}

/**
 * Generates and downloads an institutional A4 PDF dossier / summary report
 * for Central Registry (DGHS) Overview, Patient, Doctor, and Hospital pages.
 */
export function downloadRegistryReportPdf(
  options: RegistryPdfReportOptions
): void {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  let y = 18;

  const ensureSpace = (neededMm: number) => {
    if (y + neededMm > 274) {
      pdf.addPage();
      y = 18;
    }
  };

  // Institutional DGHS Header Band
  pdf.setFillColor(0, 88, 48);
  pdf.rect(0, 0, pageWidth, 28, 'F');

  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(13.5);
  pdf.text('CENTRAL REGISTRY (DGHS) — UNIFIED HEALTH PLATFORM', margin, 11.5);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9.5);
  pdf.text(options.title, margin, 18.5);
  pdf.text(
    `Ref: ${options.code}   |   Generated: ${new Date().toLocaleString()}`,
    margin,
    24
  );

  y = 36;

  if (options.subtitle) {
    pdf.setTextColor(43, 56, 49);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9.5);
    const subLines = pdf.splitTextToSize(options.subtitle, contentWidth);
    pdf.text(subLines, margin, y);
    y += subLines.length * 4.8 + 4;
  }

  if (options.metrics && options.metrics.length > 0) {
    ensureSpace(22);
    pdf.setDrawColor(215, 233, 222);
    pdf.setFillColor(248, 250, 248);
    const rowsCount = Math.ceil(options.metrics.length / 3);
    const boxHeight = rowsCount * 12 + 6;
    pdf.roundedRect(margin, y, contentWidth, boxHeight, 1.5, 1.5, 'FD');

    const colWidth = contentWidth / 3;
    options.metrics.forEach((m, idx) => {
      const col = idx % 3;
      const row = Math.floor(idx / 3);
      const cellX = margin + 4 + col * colWidth;
      const cellY = y + 6 + row * 12;

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(92, 107, 98);
      pdf.text(String(m.label), cellX, cellY);

      pdf.setFont('courier', 'bold');
      pdf.setFontSize(10);
      pdf.setTextColor(0, 88, 48);
      pdf.text(String(m.value), cellX, cellY + 4.8);
    });

    y += boxHeight + 7;
  }

  for (const sec of options.sections) {
    ensureSpace(16);
    pdf.setFillColor(240, 245, 241);
    pdf.rect(margin, y, contentWidth, 7, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9.5);
    pdf.setTextColor(0, 64, 31);
    pdf.text(sec.heading, margin + 3, y + 4.8);
    y += 10;

    if (!sec.rows || sec.rows.length === 0) {
      ensureSpace(7);
      pdf.setFont('helvetica', 'italic');
      pdf.setFontSize(8.8);
      pdf.setTextColor(124, 139, 130);
      pdf.text('No records in this section.', margin + 3, y);
      y += 6;
    } else {
      sec.rows.forEach((line) => {
        const wrapped = pdf.splitTextToSize(`• ${line}`, contentWidth - 4);
        ensureSpace(wrapped.length * 4.5 + 2.5);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8.8);
        pdf.setTextColor(16, 22, 19);
        pdf.text(wrapped, margin + 2, y);
        y += wrapped.length * 4.4 + 1.8;
      });
      y += 3;
    }
  }

  pdf.setDrawColor(227, 234, 229);
  pdf.line(margin, 282, pageWidth - margin, 282);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(124, 139, 130);
  pdf.text(
    'Official DGHS Central Registry Export — Unified Health Platform',
    margin,
    286.5
  );

  const safeName = `${String(options.code || 'DGHS_Report').replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
  pdf.save(safeName);
}
