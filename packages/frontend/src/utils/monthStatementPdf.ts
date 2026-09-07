import { jsPDF } from 'jspdf';
import type {
  BudgetCategorySummary,
  BudgetMonthSnapshot,
} from '@portfolio/common';
import { formatCAD, formatMonthYear } from './format';

const PAGE_MARGIN = 40;
// US Letter is 792pt tall; leave a bottom margin equal to the top one.
const PAGE_BOTTOM = 792 - PAGE_MARGIN;
// Right edge for right-aligned values: page width (612pt) less the margin,
// less a little optical padding so figures do not touch the trim.
const RIGHT_EDGE = 612 - PAGE_MARGIN - 17;
const LINE = 14;

const KIND_TITLES: Record<BudgetCategorySummary['kind'], string> = {
  fixed: 'Fixed',
  flexible: 'Flexible',
  ignored: 'Not spending',
};

/**
 * Renders ONE snapshot version. The same snapshot always produces the same
 * document — it consults no live category, membership, or transaction.
 */
export const buildMonthStatementPdf = (
  snapshot: BudgetMonthSnapshot,
  householdName: string
): Blob => {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const { summary } = snapshot;
  const byMember = summary.byMember ?? [];

  // jsPDF has no flow layout, so the document carries its own cursor. Plain
  // closures over `y` rather than a class: nothing else in
  // packages/frontend/src is a class, and every helper in utils/ is a
  // function.
  let y = PAGE_MARGIN;

  const pageBreak = (needed = LINE) => {
    if (y + needed > PAGE_BOTTOM) {
      doc.addPage();
      y = PAGE_MARGIN;
    }
  };

  const line = (
    text: string,
    opts: { size?: number; bold?: boolean } = {}
  ) => {
    pageBreak();
    doc.setFontSize(opts.size ?? 10);
    doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
    doc.text(text, PAGE_MARGIN, y);
    y += LINE;
  };

  /** Label left, value right-aligned at the page edge. */
  const row = (label: string, value: string, opts: { bold?: boolean } = {}) => {
    pageBreak();
    doc.setFontSize(10);
    doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
    doc.text(label, PAGE_MARGIN, y);
    doc.text(value, RIGHT_EDGE, y, { align: 'right' });
    y += LINE;
  };

  const gap = (n = 1) => {
    y += LINE * n;
  };

  // 1. Header
  line(householdName, { size: 16, bold: true });
  line(formatMonthYear(snapshot.month, snapshot.year), { size: 13 });
  line(
    `Closed ${new Date(snapshot.closedAt).toLocaleString('en-CA', {
      dateStyle: 'long',
      timeStyle: 'short',
    })}`,
    { size: 9 }
  );
  if (snapshot.closedBy) {
    const closer = byMember.find(m => m.userId === snapshot.closedBy);
    if (closer) line(`by ${closer.name ?? closer.email}`, { size: 9 });
  }
  gap();

  // 2. Income by member
  line('Income', { size: 12, bold: true });
  for (const member of byMember) {
    row(
      `${member.name ?? member.email}${member.isActual ? '' : ' (planned)'}`,
      formatCAD(member.amount)
    );
  }
  row('Total income', formatCAD(summary.income), { bold: true });
  gap();

  // 3. Categories, grouped fixed / flexible / ignored
  const kinds: BudgetCategorySummary['kind'][] = ['fixed', 'flexible', 'ignored'];
  for (const kind of kinds) {
    const rows = summary.categories.filter(cat => cat.kind === kind);
    if (rows.length === 0) continue;
    line(KIND_TITLES[kind], { size: 12, bold: true });
    row('Category', 'Planned · Actual · Cost', { bold: true });
    for (const cat of rows) {
      row(
        cat.name,
        `${formatCAD(cat.planned)} · ${formatCAD(cat.actual)} · ${formatCAD(cat.cost)}`
      );
    }
    gap();
  }

  // 4. Totals
  line('Totals', { size: 12, bold: true });
  row('Planned', formatCAD(summary.totalPlanned));
  if (summary.untagged.transactionCount > 0) {
    row(
      `Untagged (${summary.untagged.transactionCount})`,
      formatCAD(summary.untagged.amount)
    );
  }
  row('Cost', formatCAD(summary.totalCost), { bold: true });
  row('Money left', formatCAD(summary.moneyLeft), { bold: true });
  gap();

  // 5. Transactions, joined to category names through summary.categories[].
  // Names live once, in the summary — never duplicated onto the rows.
  const categoryName = new Map(
    summary.categories.map(cat => [cat.categoryId, cat.name])
  );
  line(`Transactions (${snapshot.transactions.length})`, {
    size: 12,
    bold: true,
  });
  for (const txn of snapshot.transactions) {
    pageBreak();
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(new Date(txn.date).toISOString().slice(0, 10), PAGE_MARGIN, y);
    // splitTextToSize wraps to an array; take the first line and let a long
    // description truncate rather than collide with the next column.
    doc.text(doc.splitTextToSize(txn.description, 210)[0], PAGE_MARGIN + 70, y);
    doc.text(categoryName.get(txn.categoryId) ?? '—', PAGE_MARGIN + 290, y);
    doc.text(formatCAD(txn.amount), RIGHT_EDGE, y, { align: 'right' });
    y += 12;
  }

  return doc.output('blob');
};

export const monthStatementFileName = (snapshot: BudgetMonthSnapshot): string =>
  `statement-${snapshot.year}-${String(snapshot.month).padStart(2, '0')}.pdf`;
