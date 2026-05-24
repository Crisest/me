import { Transaction } from '@/types';
import React, { useMemo, useState } from 'react';
import styles from './TransactionsTable.module.css';
import { formatPlaidCategory, formatPlaidDetailedCategory } from '@/utils/format';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  createColumnHelper,
  ColumnDef,
  SortingState,
} from '@tanstack/react-table';
import YmMenu, { YmMenuItem } from '@/ui/YmMenu/YmMenu';

type transactionTableProps = {
  transactions: Transaction[];
  extraColumns?: ColumnDef<Transaction, any>[];
  rowActions?: (txn: Transaction) => YmMenuItem[];
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

const TransactionsTable: React.FC<transactionTableProps> = ({
  transactions,
  extraColumns,
  rowActions,
}) => {
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'date', desc: true },
  ]);

  const baseColumns = useMemo<ColumnDef<Transaction, any>[]>(
    () => [
      columnHelper.accessor('date', {
        header: 'Date',
        cell: info =>
          new Date(info.getValue()).toLocaleDateString('en-CA', {
            weekday: 'long',
            day: 'numeric',
          }),
      }),
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
    data: transactions,
    columns: allColumns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className={styles.tableContainer}>
      <table className={styles.table}>
        <thead>
          {table.getHeaderGroups().map(headerGroup => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map(header => (
                <th key={header.id} className={buildHeaderClass(header.column.id)}>
                  {header.isPlaceholder ? null : header.column.getCanSort() ? (
                    <button
                      type="button"
                      className={styles.sortButton}
                      onClick={header.column.getToggleSortingHandler()}
                      aria-label={`Sort by ${String(header.column.columnDef.header)}`}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      <span className={styles.sortIndicator} aria-hidden>
                        {header.column.getIsSorted() === 'asc'
                          ? '▲'
                          : header.column.getIsSorted() === 'desc'
                            ? '▼'
                            : '⇅'}
                      </span>
                    </button>
                  ) : (
                    flexRender(header.column.columnDef.header, header.getContext())
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
            table.getRowModel().rows.map(row => (
              <tr key={row.id}>
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id} className={buildCellClass(cell.column.id)}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default TransactionsTable;
