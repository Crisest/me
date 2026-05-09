import { Transaction } from '@/types';
import React, { useMemo } from 'react';
import styles from './TransactionsTable.module.css';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  createColumnHelper,
  ColumnDef,
} from '@tanstack/react-table';

type transactionTableProps = {
  transactions: Transaction[];
  extraColumns?: ColumnDef<Transaction, any>[];
};

const columnHelper = createColumnHelper<Transaction>();

const columns = [
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
    cell: info => {
      const row = info.row.original;
      const subDescription = row.subDescription;
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
      return <span className={styles.categoryPill}>{value}</span>;
    },
  }),
];

const TransactionsTable: React.FC<transactionTableProps> = ({
  transactions,
  extraColumns,
}) => {
  const allColumns = useMemo(
    () => (extraColumns ? [...extraColumns, ...columns] : columns),
    [extraColumns]
  );
  const table = useReactTable({
    data: transactions,
    columns: allColumns,
    getCoreRowModel: getCoreRowModel(),
  });
  return (
    <div className={styles.tableContainer}>
      <table className={styles.table}>
        <thead>
          {table.getHeaderGroups().map(headerGroup => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map(header => (
                <th
                  key={header.id}
                  className={header.column.id === 'amount' ? styles.amountHeader : undefined}
                >
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
          {table.getRowModel().rows.map(row => (
            <tr key={row.id}>
              {row.getVisibleCells().map(cell => (
                <td
                  key={cell.id}
                  className={cell.column.id === 'amount' ? styles.amountCell : undefined}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TransactionsTable;
