import { useState } from 'react';
import {
  useGetMyHouseholdQuery,
  useRenameHouseholdMutation,
  useRegenerateInviteCodeMutation,
  useLeaveHouseholdMutation,
  useRemoveMemberMutation,
} from '@/services/householdService';
import { useGetUserQuery } from '@/services/authService';
import { Route } from '@/enums/routerEnum';
import { copyToClipboard } from '@/utils/clipboard';
import Header from '@/components/Header/Header';
import Content from '@ui/Content/Content';
import Textbox from '@ui/Textbox/Textbox';
import YButton from '@ui/Button/Button';
import { FaPencilAlt, FaRegCopy, FaSyncAlt, FaSignOutAlt } from 'react-icons/fa';
import MemberAvatars from './MemberAvatars';
import styles from './HouseholdPage.module.css';

const HouseholdPage: React.FC = () => {
  const { data: household, isLoading } = useGetMyHouseholdQuery();
  const { data: me } = useGetUserQuery();
  const [renameHousehold] = useRenameHouseholdMutation();
  const [regenerateInviteCode] = useRegenerateInviteCodeMutation();
  const [leaveHousehold, { isLoading: leaving }] = useLeaveHouseholdMutation();
  const [removeMember] = useRemoveMemberMutation();

  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState('');
  const [copied, setCopied] = useState(false);

  const baseUrl = me?.config.appUrl ?? window.location.origin;

  if (isLoading) return <p>Loading...</p>;
  if (!household) return <p>Unable to load your household.</p>;

  const inviteUrl = `${baseUrl}${Route.HOUSEHOLD_JOIN.replace(':code', household.inviteCode)}`;
  const isSolo = household.members.length <= 1;

  const startEdit = () => {
    setName(household.name);
    setEditingName(true);
  };

  const saveName = async () => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== household.name) {
      await renameHousehold({ id: household.id, payload: { name: trimmed } });
    }
    setEditingName(false);
  };

  const handleCopy = async () => {
    try {
      await copyToClipboard(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy invite link', err);
    }
  };

  const handleLeave = async () => {
    if (
      !window.confirm(
        'Leave this household? You will get a fresh household of your own.',
      )
    ) {
      return;
    }
    await leaveHousehold(household.id);
  };

  const handleRemoveMember = async (userId: string) => {
    if (!window.confirm('Remove this member from the household?')) return;
    await removeMember({ id: household.id, payload: { userId } });
  };

  return (
    <>
      <Header title="Household" />
      <Content>
        <div className={styles.section}>
          <div className={styles.nameRow}>
            {editingName ? (
              <>
                <Textbox
                  customClass={styles.nameInput}
                  value={name}
                  onChange={setName}
                  onKeyDown={e => e.key === 'Enter' && saveName()}
                  autoFocus
                />
                <YButton variant="primary" onClick={saveName}>
                  Save
                </YButton>
                <YButton
                  variant="secondary"
                  onClick={() => setEditingName(false)}
                >
                  Cancel
                </YButton>
              </>
            ) : (
              <>
                <h2 className={styles.name}>{household.name}</h2>
                <button
                  className={styles.editButton}
                  title="Rename household"
                  onClick={startEdit}
                >
                  <FaPencilAlt size={14} />
                </button>
              </>
            )}
          </div>
        </div>

        <div className={styles.section}>
          {isSolo ? (
            <div className={styles.soloState}>
              <p className={styles.soloText}>
                Just you — budget with a partner or roommate and you&apos;ll
                share one plan.
              </p>
              <div className={styles.inviteRow}>
                <code className={styles.inviteLink}>{inviteUrl}</code>
                <YButton variant="primary" onClick={handleCopy}>
                  {copied ? 'Copied!' : 'Copy invite link'} <FaRegCopy />
                </YButton>
              </div>
            </div>
          ) : (
            <>
              <span className={styles.label}>Members</span>
              <div className={styles.membersList}>
                {household.members.map(member => (
                  <div key={member.id} className={styles.memberRow}>
                    <MemberAvatars members={[member]} />
                    <span className={styles.memberName}>
                      {member.name ?? member.email}
                    </span>
                    {member.id !== me?.id && (
                      <button
                        className={styles.removeButton}
                        title="Remove from household"
                        onClick={() => handleRemoveMember(member.id)}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className={styles.inviteRow}>
                <code className={styles.inviteLink}>{inviteUrl}</code>
                <YButton onClick={handleCopy}>
                  {copied ? 'Copied!' : 'Copy invite link'} <FaRegCopy />
                </YButton>
              </div>
            </>
          )}
        </div>

        <div className={styles.section}>
          <div className={styles.actionsRow}>
            <YButton
              variant="secondary"
              onClick={() => regenerateInviteCode(household.id)}
            >
              <FaSyncAlt /> Regenerate invite code
            </YButton>
            <YButton
              variant="secondary"
              onClick={handleLeave}
              disabled={leaving}
            >
              <FaSignOutAlt /> Leave household
            </YButton>
          </div>
        </div>
      </Content>
    </>
  );
};

export default HouseholdPage;
