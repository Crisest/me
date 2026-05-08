import { useGetBanksQuery } from '@/services/bankService';
import { useSyncAllBanksMutation } from '@/services/plaidService';
import { PlaidLinkButton } from './PlaidLinkButton';
import { LinkedBankRow } from './LinkedBankRow';
import styles from './ConnectedAccounts.module.css';
import YButton from '@/ui/Button/Button';

export function ConnectedAccounts() {
  const { data: banks = [] } = useGetBanksQuery();
  const [syncAll, { isLoading: syncing }] = useSyncAllBanksMutation();

  const linkedBanks = banks.filter(b => b.isPlaidLinked);

  return (
    <div>
      <div className={styles.sectionHeader}>
        <h3 className={styles.title}>Connected Accounts</h3>
        <div className={styles.actions}>
          {linkedBanks.length > 0 && (
            <YButton
              className={styles.button}
              onClick={() => syncAll()}
              disabled={syncing}
              variant="secondary"
            >
              {syncing ? 'Syncing…' : 'Sync All'}
            </YButton>
          )}
          <PlaidLinkButton />
        </div>
      </div>

      {linkedBanks.length === 0 ? (
        <p className={styles.emptyState}>
          No banks connected yet. Click "Connect Bank" to link one via Plaid.
        </p>
      ) : (
        <div className={styles.list}>
          {linkedBanks.map(bank => (
            <LinkedBankRow key={bank.id} bank={bank} />
          ))}
        </div>
      )}
    </div>
  );
}
