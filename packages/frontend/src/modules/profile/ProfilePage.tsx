import Header from '@/components/Header/Header';
import Content from '@ui/Content/Content';
import { BudgetBreakdown } from '@/components/BudgetBreakdown/BudgetBreakdown';
import { useGetUserQuery } from '@/services/authService';
import { useGetBudgetQuery } from '@/services/budgetService';
import { FaPencilAlt } from 'react-icons/fa';
import styles from './ProfilePage.module.css';

function getInitials(name?: string, email?: string): string {
  if (name) {
    return name
      .split(' ')
      .map(w => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }
  return (email?.[0] ?? '?').toUpperCase();
}

export const ProfilePage = () => {
  const { data: user } = useGetUserQuery();
  const { data: budget } = useGetBudgetQuery();

  const displayName = user?.name || 'User';

  return (
    <>
      <Header title="Profile" />
      <Content>
        <div className={styles.section}>
          <div className={styles.profileHeader}>
            <div className={styles.avatar}>
              {getInitials(user?.name, user?.email)}
            </div>
            <div className={styles.profileInfo}>
              <div className={styles.nameRow}>
                <h2 className={styles.name}>{displayName}</h2>
                <button className={styles.editButton} title="Edit name">
                  <FaPencilAlt size={14} />
                </button>
              </div>
              <div className={styles.email}>{user?.email}</div>
            </div>
          </div>
        </div>

        <div className={styles.section}>
          <BudgetBreakdown budget={budget} />
        </div>
      </Content>
    </>
  );
};
