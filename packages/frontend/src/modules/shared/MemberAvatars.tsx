import React from 'react';
import { GroupMember } from '@portfolio/common';
import styles from './MemberAvatars.module.css';

const MAX_SHOWN = 4;

function initial(email: string): string {
  return (email.trim()[0] || '?').toUpperCase();
}

function hueFromEmail(email: string): number {
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = (hash * 31 + email.charCodeAt(i)) % 360;
  }
  return hash;
}

interface Props {
  members: GroupMember[];
  onMemberClick?: (member: GroupMember) => void;
}

const MemberAvatars: React.FC<Props> = ({ members, onMemberClick }) => {
  const shown = members.slice(0, MAX_SHOWN);
  const overflow = members.length - shown.length;

  return (
    <div className={styles.row}>
      {shown.map(member => {
        const style = {
          backgroundColor: `hsl(${hueFromEmail(member.email)}, 55%, 52%)`,
        };
        const label = member.name ?? member.email;

        if (!onMemberClick) {
          return (
            <span
              key={member.id}
              className={styles.avatar}
              title={label}
              style={style}
            >
              {initial(member.email)}
            </span>
          );
        }

        return (
          <button
            key={member.id}
            type="button"
            className={`${styles.avatar} ${styles.clickable}`}
            title={`View ${label}'s budget`}
            style={style}
            onClick={() => onMemberClick(member)}
          >
            {initial(member.email)}
          </button>
        );
      })}
      {overflow > 0 && (
        <span className={`${styles.avatar} ${styles.more}`}>+{overflow}</span>
      )}
    </div>
  );
};

export default MemberAvatars;
