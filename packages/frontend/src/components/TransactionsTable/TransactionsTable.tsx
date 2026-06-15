import { Transaction } from '@/types';
import React, { useMemo } from 'react';
import styles from './TransactionsTable.module.css';
import { formatPlaidCategory, formatPlaidDetailedCategory } from '@/utils/format';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  createColumnHelper,
  ColumnDef,
} from '@tanstack/react-table';
import YmMenu, { YmMenuItem } from '@/ui/YmMenu/YmMenu';

export type SortDirection = 'newest' | 'oldest';

type transactionTableProps = {
  transactions: Transaction[];
  extraColumns?: ColumnDef<Transaction, any>[];
  rowActions?: (txn: Transaction) => YmMenuItem[];
  sortDirection?: SortDirection;
};

const columnHelper = createColumnHelper<Transaction>();

const HIDE_ON_MOBILE_COLUMNS = new Set(['cardName', 'category']);

const buildHeaderClass = (columnId: string): string | undefined => {
  const classes: string[] = [];
  if (columnId === 'amount') classes.push(styles.amountHeader);
  if (HIDE_ON_MOBILE_COLUMNS.has(columnId)) classes.push(styles.hideOnMobile);
  return classes.length ? classes.join(' ') : undefined;
};

const buildCellClass = (columnId: string): string | undefined => {
  const classes: string[] = [];
  if (columnId === 'amount') classes.push(styles.amountCell);
  if (HIDE_ON_MOBILE_COLUMNS.has(columnId)) classes.push(styles.hideOnMobile);
  return classes.length ? classes.join(' ') : undefined;
};

const dayKey = (date: string): string =>
  new Date(date).toLocaleDateString('en-CA');

const dayLabel = (date: string): string =>
  new Date(date).toLocaleDateString('en-CA', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

const TransactionsTable: React.FC<transactionTableProps> = ({
  transactions,
  extraColumns,
  rowActions,
  sortDirection = 'newest',
}) => {
  const sortedTransactions = useMemo(() => {
    const sorted = [...transactions].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
    return sortDirection === 'newest' ? sorted.reverse() : sorted;
  }, [transactions, sortDirection]);

  const dayTotals = useMemo(() => {
    const totals = new Map<string, number>();
    sortedTransactions.forEach(txn => {
      const key = dayKey(txn.date);
      totals.set(key, (totals.get(key) ?? 0) + txn.amount);
    });
    return totals;
  }, [sortedTransactions]);

  const baseColumns = useMemo<ColumnDef<Transaction, any>[]>(
    () => [
      columnHelper.accessor('description', {
        header: 'Description',
        enableSorting: false,
        cell: info => {
          const row = info.row.original;
          const subDescription = formatPlaidDetailedCategory(
            row.subDescription,
            row.category,
          );
          const iconUrl = row.logoUrl ?? row.categoryIconUrl;
          return (
            <div className={styles.descriptionWrapper}>
              {iconUrl ? (
                <img
                  src={iconUrl}
                  alt=""
                  className={styles.txIcon}
                  loading="lazy"
                  onError={e => {
                    (e.currentTarget as HTMLImageElement).style.visibility = 'hidden';
                  }}
                />
              ) : (
                <span className={styles.txIconPlaceholder} aria-hidden />
              )}
              <div>
                <span className={styles.descriptionCell}>{info.getValue()}</span>
                {subDescription && (
                  <span className={styles.subDescriptionCell}>{subDescription}</span>
                )}
              </div>
            </div>
          );
        },
      }),
      columnHelper.accessor('cardName', {
        header: 'Account',
        cell: info => {
          const row = info.row.original;
          const bankName = row.bankName;
          const accountName = row.accountName;
          const accountMask = row.accountMask;
          const cardName = info.getValue();

          if (accountName) {
            const masked = accountMask ? `${accountName} ••${accountMask}` : accountName;
            return bankName ? `${bankName} · ${masked}` : masked;
          }
          if (cardName) {
            return bankName ? `${bankName} · ${cardName}` : cardName;
          }
          return null;
        },
      }),
      columnHelper.accessor('amount', {
        header: 'Amount',
        cell: info => {
          const value = info.getValue();
          return (
            <span className={value >= 0 ? styles.amountDebit : styles.amountCredit}>
              {value.toLocaleString('en-CA', {
                style: 'currency',
                currency: 'CAD',
              })}
            </span>
          );
        },
      }),
      columnHelper.accessor('category', {
        header: 'Category',
        cell: info => {
          const value = info.getValue();
          if (!value) return null;
          return (
            <span className={styles.categoryPill}>
              {formatPlaidCategory(value)}
            </span>
          );
        },
      }),
    ],
    [],
  );

  const allColumns = useMemo<ColumnDef<Transaction, any>[]>(() => {
    const cols: ColumnDef<Transaction, any>[] = extraColumns
      ? [...extraColumns, ...baseColumns]
      : [...baseColumns];

    if (rowActions) {
      cols.push({
        id: '_actions',
        header: '',
        size: 40,
        enableSorting: false,
        cell: ({ row }) => {
          const items = rowActions(row.original);
          if (!items.length) return null;
          return <YmMenu items={items} ariaLabel="Transaction actions" />;
        },
      });
    }

    return cols;
  }, [baseColumns, extraColumns, rowActions]);

  const table = useReactTable({
    data: sortedTransactions,
    columns: allColumns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className={styles.wrapper}>
      <div className={styles.tableContainer}>
        <table className={styles.table}>
        <thead className={styles.visuallyHidden}>
          {table.getHeaderGroups().map(headerGroup => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map(header => (
                <th key={header.id} className={buildHeaderClass(header.column.id)}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.length === 0 ? (
            <tr>
              <td
                colSpan={table.getVisibleFlatColumns().length}
                className={styles.emptyRow}
              >
                No transactions to display.
              </td>
            </tr>
          ) : (
            (() => {
              const rows = table.getRowModel().rows;
              const colCount = table.getVisibleFlatColumns().length;
              let lastKey: string | null = null;
              const out: React.ReactNode[] = [];

              rows.forEach(row => {
                const key = dayKey(row.original.date);
                if (key !== lastKey) {
                  lastKey = key;
                  const total = dayTotals.get(key) ?? 0;
                  out.push(
                    <tr key={`day-${key}`} className={styles.dayHeaderRow}>
                      <td colSpan={colCount} className={styles.dayHeaderCell}>
                        <div className={styles.dayHeaderInner}>
                          <span className={styles.dayHeaderLabel}>
                            {dayLabel(row.original.date)}
                          </span>
                          <span className={styles.dayHeaderTotal}>
                            {total.toLocaleString('en-CA', {
                              style: 'currency',
                              currency: 'CAD',
                            })}
                          </span>
                        </div>
                      </td>
                    </tr>,
                  );
                }
                out.push(
                  <tr key={row.id} className={styles.dataRow}>
                    {row.getVisibleCells().map(cell => (
                      <td
                        key={cell.id}
                        className={buildCellClass(cell.column.id)}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>,
                );
              });

              return out;
            })()
          )}
        </tbody>
      </table>
      </div>
    </div>
  );
};

export default TransactionsTable;
