import { jsPDF } from 'jspdf';
import type {
  BudgetCategorySummary,
  BudgetMonthSnapshot,
} from '@portfolio/common';
import { formatCAD, formatMonthYear } from './format';

const PAGE_MARGIN = 40;
// US Letter is 792pt tall; leave a bottom margin equal to the top one.
const PAGE_BOTTOM = 792 - PAGE_MARGIN;
const LEFT = PAGE_MARGIN;
const RIGHT = 612 - PAGE_MARGIN;
const CELL_PAD = 6;
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

  type Column = { header: string; width?: number; align?: 'left' | 'right' };
  type TableRow = { cells: string[]; bold?: boolean };

  /**
   * A banded header, aligned columns and a rule under every row. At most one
   * column omits `width` and takes whatever the others leave. The header is
   * repeated when a table runs onto a new page.
   *
   * `title` is drawn here, not by the caller, so one page-break check covers
   * the heading, the header band and the first row: a heading is never left
   * at the foot of a page with its table on the next.
   */
  const table = (
    columns: Column[],
    rows: TableRow[],
    opts: { size?: number; title?: string } = {}
  ) => {
    const size = opts.size ?? 10;
    const rowHeight = size + 8;
    const fixed = columns.reduce((sum, c) => sum + (c.width ?? 0), 0);
    const widths = columns.map(c => c.width ?? RIGHT - LEFT - fixed);
    const xs = widths.map((_, i) =>
      widths.slice(0, i).reduce((sum, w) => sum + w, LEFT)
    );

    // A long value is cut with an ellipsis rather than collide with the next
    // column. Measured in the font the caller has already set for the row.
    const fit = (text: string, room: number): string => {
      if (doc.getTextWidth(text) <= room) return text;
      let cut = text;
      while (cut.length > 0 && doc.getTextWidth(`${cut}…`) > room) {
        cut = cut.slice(0, -1);
      }
      return `${cut.trimEnd()}…`;
    };

    const cell = (text: string, i: number, top: number) => {
      const room = widths[i] - CELL_PAD * 2;
      const fitted = fit(text, room);
      if (columns[i].align === 'right') {
        doc.text(fitted, xs[i] + widths[i] - CELL_PAD, top + size + 3, {
          align: 'right',
        });
      } else {
        doc.text(fitted, xs[i] + CELL_PAD, top + size + 3);
      }
    };

    const header = () => {
      doc.setFillColor(235, 235, 235);
      doc.rect(LEFT, y, RIGHT - LEFT, rowHeight, 'F');
      doc.setFontSize(size);
      doc.setFont('helvetica', 'bold');
      columns.forEach((c, i) => cell(c.header, i, y));
      y += rowHeight;
    };

    if (opts.title) {
      pageBreak(LINE + rowHeight * 2);
      line(opts.title, { size: 12, bold: true });
    } else {
      pageBreak(rowHeight * 2);
    }
    header();
    for (const r of rows) {
      if (y + rowHeight > PAGE_BOTTOM) {
        doc.addPage();
        y = PAGE_MARGIN;
        header();
      }
      doc.setFontSize(size);
      doc.setFont('helvetica', r.bold ? 'bold' : 'normal');
      r.cells.forEach((text, i) => cell(text, i, y));
      y += rowHeight;
      doc.setDrawColor(210, 210, 210);
      doc.line(LEFT, y, RIGHT, y);
    }
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
  table(
    [
      { header: 'Member' },
      { header: 'Basis', width: 90 },
      { header: 'Amount', width: 110, align: 'right' },
    ],
    [
      ...byMember.map(member => ({
        cells: [
          member.name ?? member.email,
          member.isActual ? 'Actual' : 'Planned',
          formatCAD(member.amount),
        ],
      })),
      { cells: ['Total income', '', formatCAD(summary.income)], bold: true },
    ],
    { title: 'Income' }
  );
  gap(2);

  // 3. Categories, grouped fixed / flexible / ignored
  const kinds: BudgetCategorySummary['kind'][] = ['fixed', 'flexible', 'ignored'];
  for (const kind of kinds) {
    const rows = summary.categories.filter(cat => cat.kind === kind);
    if (rows.length === 0) continue;
    table(
      [
        { header: 'Category' },
        { header: 'Planned', width: 100, align: 'right' },
        { header: 'Actual', width: 100, align: 'right' },
        { header: 'Cost', width: 100, align: 'right' },
      ],
      rows.map(cat => ({
        cells: [
          cat.name,
          formatCAD(cat.planned),
          formatCAD(cat.actual),
          formatCAD(cat.cost),
        ],
      })),
      { title: KIND_TITLES[kind] }
    );
    gap(2);
  }

  // 4. Totals
  table(
    [{ header: 'Item' }, { header: 'Amount', width: 110, align: 'right' }],
    [
      { cells: ['Planned', formatCAD(summary.totalPlanned)] },
      ...(summary.untagged.transactionCount > 0
        ? [
            {
              cells: [
                `Untagged (${summary.untagged.transactionCount})`,
                formatCAD(summary.untagged.amount),
              ],
            },
          ]
        : []),
      { cells: ['Cost', formatCAD(summary.totalCost)], bold: true },
      { cells: ['Money left', formatCAD(summary.moneyLeft)], bold: true },
    ],
    { title: 'Totals' }
  );
  gap(2);

  // 5. Transactions, joined to category names through summary.categories[].
  // Names live once, in the summary — never duplicated onto the rows.
  const categoryName = new Map(
    summary.categories.map(cat => [cat.categoryId, cat.name])
  );
  const transactionsTitle = `Transactions (${snapshot.transactions.length})`;
  if (snapshot.transactions.length === 0) {
    line(transactionsTitle, { size: 12, bold: true });
  } else {
    table(
      [
        { header: 'Date', width: 70 },
        { header: 'Description' },
        { header: 'Category', width: 140 },
        { header: 'Amount', width: 90, align: 'right' },
      ],
      snapshot.transactions.map(txn => ({
        cells: [
          new Date(txn.date).toISOString().slice(0, 10),
          txn.description,
          categoryName.get(txn.categoryId) ?? '—',
          formatCAD(txn.amount),
        ],
      })),
      { size: 9, title: transactionsTitle }
    );
  }

  return doc.output('blob');
};

export const monthStatementFileName = (snapshot: BudgetMonthSnapshot): string =>
  `statement-${snapshot.year}-${String(snapshot.month).padStart(2, '0')}.pdf`;
