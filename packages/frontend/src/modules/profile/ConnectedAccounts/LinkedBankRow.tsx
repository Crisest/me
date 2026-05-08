import { useCallback, useEffect, useState } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import type { Bank } from '@portfolio/common';
import {
  useCreateUpdateLinkTokenMutation,
  useSyncBankMutation,
  useUnlinkBankMutation,
} from '@/services/plaidService';
import styles from './ConnectedAccounts.module.css';
import YButton from '@/ui/Button/Button';

interface Props {
  bank: Bank;
}

export function LinkedBankRow({ bank }: Props) {
  const [syncBank, { isLoading: syncing }] = useSyncBankMutation();
  const [unlinkBank, { isLoading: unlinking }] = useUnlinkBankMutation();
  const [createUpdateLinkToken, { isLoading: creatingUpdateToken }] =
    useCreateUpdateLinkTokenMutation();

  const [updateLinkToken, setUpdateLinkToken] = useState<string | null>(null);

  const onSuccess = useCallback(async () => {
    // Re-auth succeeded; refresh this bank immediately so status flips to 'connected'
    await syncBank({ bankId: bank.id })
      .unwrap()
      .catch(() => undefined);
    setUpdateLinkToken(null);
  }, [bank.id, syncBank]);

  const { open, ready } = usePlaidLink({
    token: updateLinkToken,
    onSuccess,
  });

  useEffect(() => {
    if (updateLinkToken && ready) open();
  }, [updateLinkToken, ready, open]);

  const status = bank.plaidStatus ?? 'connected';
  const statusClass =
    status === 'connected'
      ? styles.statusConnected
      : status === 'login_required'
        ? styles.statusLoginRequired
        : styles.statusError;

  const handleRefresh = () => {
    syncBank({ bankId: bank.id });
  };

  const handleUnlink = () => {
    if (
      !window.confirm(`Unlink ${bank.name}? Synced transactions will remain.`)
    )
      return;
    unlinkBank({ bankId: bank.id });
  };

  const handleReauth = async () => {
    const res = await createUpdateLinkToken({ bankId: bank.id }).unwrap();
    setUpdateLinkToken(res.linkToken);
  };

  return (
    <div className={styles.row}>
      <div className={styles.bankInfo}>
        <span className={`${styles.statusDot} ${statusClass}`} />
        <span>{bank.name}</span>
      </div>
      <div className={styles.rowActions}>
        <YButton
          className={styles.button}
          onClick={handleRefresh}
          disabled={syncing}
          variant="secondary"
        >
          {syncing ? 'Syncing…' : 'Refresh'}
        </YButton>
        {status === 'login_required' && (
          <YButton
            className={styles.button}
            onClick={handleReauth}
            disabled={creatingUpdateToken}
            variant="secondary"
          >
            Re-authenticate
          </YButton>
        )}
        <YButton
          className={styles.button}
          onClick={handleUnlink}
          disabled={unlinking}
          variant="secondary"
        >
          Unlink
        </YButton>
      </div>
    </div>
  );
}
