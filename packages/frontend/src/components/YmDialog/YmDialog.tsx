import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import React, { ReactNode } from 'react';
import styles from './YmDialog.module.css';
import YButtom from '../Button/Button';

interface YmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footerButtonText?: string;
  footerButtonAction?: () => void;
}

const YmDialog: React.FC<YmDialogProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footerButtonText = 'Close',
  footerButtonAction,
}) => {
  const handleFooterAction = () => {
    if (footerButtonAction) {
      footerButtonAction();
    }
    onClose();
  };

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      as="div"
      className={styles.dialogWrapper}
    >
      <div className={styles.backdrop} aria-hidden="true" />

      <div className={styles.container}>
        <DialogPanel className={styles.panel}>
          {title && (
            <DialogTitle as="h2" className={styles.title}>
              {title}
            </DialogTitle>
          )}

          <div className={styles.content}>{children}</div>

          <div className={styles.footer}>
            <YButtom variant="primary" onClick={handleFooterAction}>
              {footerButtonText}
            </YButtom>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
};

export default YmDialog;
