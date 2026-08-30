import React from 'react';
import { GroupWithMembers } from '@portfolio/common';
import { IoClose } from 'react-icons/io5';
import { formatCAD, formatMonthYear } from '@/utils/format';
import MemberAvatars from '../household/MemberAvatars';
import styles from './GroupCard.module.css';

interface Props {
  group: GroupWithMembers;
  onOpen: () => void;
  onDelete: () => void;
}

const GroupCard: React.FC<Props> = ({ group, onOpen, onDelete }) => {
  const { summary } = group;
  const budget = summary?.budget ?? 0;
  const spent = summary?.totalSpent ?? 0;
  const ratio = budget > 0 ? Math.min(spent / budget, 1) : 0;
  const level = ratio >= 1 ? styles.over : ratio >= 0.8 ? styles.warn : styles.ok;

  return (
    <div
      className={styles.card}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onOpen()}
    >
      <button
        className={styles.deleteBtn}
        aria-label="Delete shared"
        onClick={e => {
          e.stopPropagation();
          onDelete();
        }}
      >
        <IoClose />
      </button>

      <h3 className={styles.name}>{group.name}</h3>
      <MemberAvatars members={group.members} />

      {summary && (
        <div className={styles.spend}>
          <div className={styles.spendRow}>
            <span className={styles.amount}>
              {formatCAD(spent)}{' '}
              <span className={styles.muted}>/ {formatCAD(budget)}</span>
            </span>
            <span className={styles.month}>
              {formatMonthYear(summary.month, summary.year)}
            </span>
          </div>
          <div className={styles.bar}>
            <div
              className={`${styles.fill} ${level}`}
              style={{ width: `${ratio * 100}%` }}
            />
          </div>
          <p className={styles.left}>{formatCAD(summary.moneyLeft)} left</p>
        </div>
      )}
    </div>
  );
};

export default GroupCard;
