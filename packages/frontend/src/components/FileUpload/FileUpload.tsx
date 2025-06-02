import { ChangeEvent, useState } from 'react';
import styles from './FileUpload.module.css';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  buttonText?: string;
}

const FileUpload: React.FC<FileUploadProps> = ({
  onFileSelect,
  buttonText = 'Upload your monthly transactions',
}) => {
  const [fileName, setFileName] = useState('');

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      onFileSelect(file);
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
        <span className={styles.button}>{buttonText}</span>
        <span className={styles.fileName}>
          {fileName || 'No file selected'}
        </span>
      </label>
    </div>
  );
};

export default FileUpload;
