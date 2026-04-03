import { Transaction } from '@/types';
import React from 'react';
import styles from './TransactionsTable.module.css';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  createColumnHelper,
} from '@tanstack/react-table';

type transactionTableProps = {
  transactions: Transaction[];
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
    cell: info => (
      <span className={styles.descriptionCell}>{info.getValue()}</span>
    ),
  }),
  columnHelper.accessor('amount', {
    header: 'Amount',
    cell: info => {
      const value = info.getValue();
      return (
        <span className={value >= 0 ? styles.amountCredit : styles.amountDebit}>
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
}) => {
  const table = useReactTable({
    data: transactions,
    columns,
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
