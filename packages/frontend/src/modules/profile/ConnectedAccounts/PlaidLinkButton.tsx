import { useCallback, useEffect, useState } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import {
  useCreateLinkTokenMutation,
  useExchangeTokenMutation,
} from '@/services/plaidService';
import styles from './ConnectedAccounts.module.css';
import YButton from '@/ui/Button/Button';

export function PlaidLinkButton() {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [createLinkToken, { isLoading: creatingToken }] =
    useCreateLinkTokenMutation();
  const [exchangeToken, { isLoading: exchanging }] = useExchangeTokenMutation();

  const onSuccess = useCallback(
    async (publicToken: string, metadata: any) => {
      await exchangeToken({
        publicToken,
        institutionId: metadata.institution?.institution_id ?? '',
        institutionName: metadata.institution?.name ?? 'Unknown bank',
      }).unwrap();
      setLinkToken(null);
    },
    [exchangeToken],
  );

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess,
  });

  useEffect(() => {
    if (linkToken && ready) open();
  }, [linkToken, ready, open]);

  const handleClick = async () => {
    const res = await createLinkToken().unwrap();
    setLinkToken(res.linkToken);
  };

  return (
    <YButton
      className={`${styles.button} ${styles.buttonPrimary}`}
      onClick={handleClick}
      disabled={creatingToken || exchanging}
    >
      {creatingToken ? 'Loading…' : exchanging ? 'Connecting…' : 'Connect Bank'}
    </YButton>
  );
}
