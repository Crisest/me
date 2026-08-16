import React from 'react';
import type { GroupMember } from '@portfolio/common';
import YmDialog from '@/ui/YmDialog/YmDialog';
import { BudgetBreakdown } from '@/components/BudgetBreakdown/BudgetBreakdown';
import { useGetMemberBudgetQuery } from '@/services/groupService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  member: GroupMember;
}

const MemberBudgetModal: React.FC<Props> = ({
  isOpen,
  onClose,
  groupId,
  member,
}) => {
  const { data, isLoading, isError } = useGetMemberBudgetQuery(
    { groupId, userId: member.id },
    { skip: !isOpen },
  );

  const label = member.name ?? member.email;

  return (
    <YmDialog isOpen={isOpen} onClose={onClose} title={label}>
      {isLoading && <p>Loading budget…</p>}
      {isError && <p>Could not load this member's budget.</p>}
      {!isLoading && !isError && (
        <BudgetBreakdown budget={data} title={`${label}'s Budget`} />
      )}
    </YmDialog>
  );
};

export default MemberBudgetModal;
