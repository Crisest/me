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
    cell: info => new Date(info.getValue()).toLocaleDateString(),
  }),
  columnHelper.accessor('description', {
    header: 'Description',
  }),
  columnHelper.accessor('amount', {
    header: 'Amount',
    cell: info =>
      info.getValue().toLocaleString('en-CA', {
        style: 'currency',
        currency: 'CAD',
      }),
  }),

  columnHelper.accessor('category', {
    header: 'Category',
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
                <th key={header.id} className={styles.th}>
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
                <td key={cell.id} className={styles.td}>
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
