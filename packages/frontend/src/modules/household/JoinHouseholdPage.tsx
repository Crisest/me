import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useJoinHouseholdMutation } from '@/services/householdService';
import { Route } from '@/enums/routerEnum';
import Header from '@/components/Header/Header';
import Content from '@ui/Content/Content';
import YButton from '@ui/Button/Button';
import styles from './JoinHouseholdPage.module.css';

const JoinHouseholdPage: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [joinHousehold, { isLoading, isError }] = useJoinHouseholdMutation();
  const [joined, setJoined] = useState(false);

  const handleJoin = async () => {
    if (!code) return;
    try {
      await joinHousehold({ code }).unwrap();
      setJoined(true);
      navigate(Route.HOUSEHOLD);
    } catch {
      // isError below renders the failure state
    }
  };

  if (isError) {
    return (
      <>
        <Header title="Join household" />
        <Content>
          <p>
            Invalid or expired invite code.{' '}
            <Link to={Route.HOUSEHOLD}>Back to Household</Link>
          </p>
        </Content>
      </>
    );
  }

  return (
    <>
      <Header title="Join household" />
      <Content>
        <div className={styles.section}>
          <p className={styles.lead}>
            You&apos;re about to join a household using an invite code.
          </p>

          <div className={styles.explainer}>
            <p>
              <strong>What this does:</strong> your current household&apos;s
              budget plan is moved to an archived household, and you become a
              member of the household you&apos;re joining, sharing its budget
              plan going forward.
            </p>
            <p>
              <strong>What this does not do:</strong> your transactions and
              linked accounts are fully retained — nothing is deleted. Prior
              spending will show as untagged in the new household until you
              re-categorize it, since your old budget categories stay behind
              in the archived household.
            </p>
          </div>

          <p className={styles.footnote}>
            If you leave this household later, you&apos;ll get a fresh,
            empty household of your own — leaving does not restore the
            archived plan you had before joining.
          </p>

          <YButton
            variant="primary"
            onClick={handleJoin}
            disabled={isLoading || joined || !code}
          >
            {isLoading ? 'Joining...' : 'Join household'}
          </YButton>
        </div>
      </Content>
    </>
  );
};

export default JoinHouseholdPage;
