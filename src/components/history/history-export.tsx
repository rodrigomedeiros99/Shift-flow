'use client';

import { useState } from 'react';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import { Button, useToast } from '@/components/ui';
import { formatDateUS } from '@/lib/utils/date';
import {
  downloadBlob,
  HISTORY_TABLE_COLUMNS,
  historyFilename,
  type HistoryExportData,
} from '@/features/history/export';

/**
 * History export buttons. The heavy `exceljs` / `jspdf` libraries are loaded
 * lazily on click (kept out of the initial bundle and off the server). The data
 * is already filtered, RLS-scoped, and role-gated by the History page, so this
 * only formats what the user can already see.
 */
export function HistoryExport({ data }: { data: HistoryExportData }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState<null | 'xlsx' | 'pdf'>(null);
  const disabled = busy !== null || data.rows.length === 0;

  async function run(kind: 'xlsx' | 'pdf', fn: () => Promise<void>) {
    setBusy(kind);
    try {
      await fn();
    } catch (err) {
      toast({
        title: 'Export failed',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'error',
      });
    } finally {
      setBusy(null);
    }
  }

  async function exportExcel() {
    const { Workbook } = await import('exceljs');
    const generatedAt = new Date().toLocaleString();
    const wb = new Workbook();
    wb.creator = 'ShiftFlow';

    // Sheet 1 — History Details
    const s1 = wb.addWorksheet('History Details');
    s1.addRow([data.reportTitle]).font = { bold: true, size: 14 };
    s1.addRow([`Facility: ${data.facilityName}`]);
    s1.addRow([`Generated: ${generatedAt}`]);
    s1.addRow([]);
    s1.addRow(['Applied filters']).font = { bold: true };
    for (const f of data.filters) s1.addRow([f.label, f.value]);
    s1.addRow([]);
    const head = s1.addRow([...HISTORY_TABLE_COLUMNS]);
    head.font = { bold: true };
    for (const r of data.rows) {
      s1.addRow([
        formatDateUS(r.date),
        r.associate,
        r.department,
        r.key,
        r.task,
        r.equipment,
        r.source,
        r.action,
        r.by,
      ]);
    }
    s1.columns.forEach((col) => {
      let max = 10;
      col.eachCell?.({ includeEmpty: false }, (cell) => {
        max = Math.max(max, String(cell.value ?? '').length + 2);
      });
      col.width = Math.min(40, max);
    });

    // Sheet 2 — Task Usage Summary
    const s2 = wb.addWorksheet('Task Usage Summary');
    s2.addRow(['Task', 'Count']).font = { bold: true };
    for (const t of data.taskUsage) s2.addRow([t.label, t.value]);
    s2.getColumn(1).width = 28;
    s2.getColumn(2).width = 12;

    // Sheet 3 — Associate Summary (only when exporting all associates)
    if (!data.associateName) {
      const s3 = wb.addWorksheet('Associate Summary');
      s3.addRow(['Associate', 'Assignments']).font = { bold: true };
      for (const a of data.associateUsage) s3.addRow([a.label, a.value]);
      s3.getColumn(1).width = 28;
      s3.getColumn(2).width = 14;
    }

    const buffer = await wb.xlsx.writeBuffer();
    downloadBlob(
      new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
      historyFilename(data.associateName, 'xlsx'),
    );
  }

  async function exportPdf() {
    const { jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;
    const generatedAt = new Date().toLocaleString();
    // Portrait A4 (request §4). Narrower width, so the header/filters stack and
    // the detail table drops the least-important "By" column.
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 14;

    // Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('ShiftFlow', margin, 16);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(data.reportTitle, margin, 23);
    doc.setFontSize(9);
    doc.text(`Facility: ${data.facilityName}`, margin, 29);
    doc.text(`Generated: ${generatedAt}`, margin, 34);

    // Applied filters (stacked below the header — portrait has no room for a
    // second column).
    let y = 42;
    doc.setFont('helvetica', 'bold');
    doc.text('Applied filters', margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    data.filters.forEach((f) => {
      doc.text(`${f.label}: ${f.value}`, margin, y);
      y += 4.5;
    });
    y += 3;

    // Summary + task usage bar chart (sized for portrait width).
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(`Task usage  ·  ${data.rows.length} records`, margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);

    const top = data.taskUsage.slice(0, 10);
    const maxVal = Math.max(1, ...top.map((t) => t.value));
    const labelW = 38;
    const barMaxW = 110;
    const rowH = 5.5;
    top.forEach((t) => {
      const barW = (t.value / maxVal) * barMaxW;
      doc.text(t.label.slice(0, 22), margin, y + 3.4);
      doc.setFillColor(249, 99, 2); // Home Depot orange
      doc.rect(margin + labelW, y, Math.max(0.5, barW), 4, 'F');
      doc.text(
        String(t.value),
        margin + labelW + Math.max(0.5, barW) + 2,
        y + 3.4,
      );
      y += rowH;
    });
    if (top.length === 0) {
      doc.text('No task usage in this range.', margin, y + 3);
      y += rowH;
    }

    // Detail table — paginates automatically, repeats the header on each page,
    // and wraps long cells. Portrait drops "By" (kept in Excel) to fit the 8
    // most-important columns without cut-off.
    const pdfColumns = HISTORY_TABLE_COLUMNS.slice(0, 8);
    autoTable(doc, {
      startY: y + 4,
      head: [[...pdfColumns]],
      body: data.rows.map((r) => [
        formatDateUS(r.date),
        r.associate,
        r.department,
        r.key,
        r.task,
        r.equipment,
        r.source,
        r.action,
      ]),
      styles: { fontSize: 7, cellPadding: 1.5, overflow: 'linebreak' },
      headStyles: { fillColor: [249, 99, 2], textColor: 255 },
      columnStyles: {
        0: { cellWidth: 20 }, // Date
        1: { cellWidth: 30 }, // Associate
        2: { cellWidth: 26 }, // Department
        3: { cellWidth: 14 }, // Key
        4: { cellWidth: 26 }, // Task
        5: { cellWidth: 26 }, // Equipment
        6: { cellWidth: 16 }, // Source
        7: { cellWidth: 18 }, // Action
      },
      margin: { left: margin, right: margin },
      didDrawPage: (hook) => {
        const page = doc.getNumberOfPages();
        doc.setFontSize(8);
        doc.setTextColor(120);
        doc.text(
          `Page ${page}`,
          pageW - margin,
          doc.internal.pageSize.getHeight() - 6,
          { align: 'right' },
        );
        doc.setTextColor(0);
        void hook;
      },
    });

    doc.save(historyFilename(data.associateName, 'pdf'));
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="secondary"
        size="sm"
        className="gap-2"
        disabled={disabled}
        onClick={() => run('xlsx', exportExcel)}
      >
        {busy === 'xlsx' ? (
          <Download className="h-4 w-4 animate-pulse" aria-hidden="true" />
        ) : (
          <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
        )}
        Export Excel
      </Button>
      <Button
        variant="secondary"
        size="sm"
        className="gap-2"
        disabled={disabled}
        onClick={() => run('pdf', exportPdf)}
      >
        {busy === 'pdf' ? (
          <Download className="h-4 w-4 animate-pulse" aria-hidden="true" />
        ) : (
          <FileText className="h-4 w-4" aria-hidden="true" />
        )}
        Export PDF
      </Button>
    </div>
  );
}
