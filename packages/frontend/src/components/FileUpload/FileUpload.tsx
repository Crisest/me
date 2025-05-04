import { useState, ChangeEvent } from 'react';
import styles from './FileUpload.module.css';
import { TransactionRow } from '@/types/Transaction';
import { parseCSV } from '@/utils/csv';

const FileUpload: React.FC = () => {
  const [fileName, setFileName] = useState<string>('');
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);

      const reader = new FileReader();
      reader.onload = event => {
        const text = event.target?.result as string;
        const rows = parseCSV(text);
        console.log('Parsed transactions:', rows);
        setTransactions(rows);
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className={styles.uploadContainer}>
      <label className={styles.fileLabel}>
        <input
          type="file"
          className={styles.fileInput}
          onChange={handleFileChange}
        />
        <span className={styles.button}>Upload your monthly transactions</span>
        <span className={styles.fileName}>
          {fileName || 'No file selected'}
        </span>
      </label>

      {transactions.length > 0 && (
        <div className={styles.csvPreview}>
          <ul>
            {transactions.map((row, index) => (
              <li key={index}>
                <strong>{row.Date}</strong>: {row.Description} — {row.Amount}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default FileUpload;
