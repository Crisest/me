import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useGetGroupsQuery,
  useCreateGroupMutation,
  useDeleteGroupMutation,
} from '@/services/groupService';
import Header from '@/components/Header/Header';
import Content from '@ui/Content/Content';
import Textbox from '@ui/Textbox/Textbox';
import YButton from '@ui/Button/Button';
import { FaCirclePlus } from 'react-icons/fa6';
import { IoClose } from 'react-icons/io5';
import GroupCard from './GroupCard';
import styles from './SharedPage.module.css';

function previousPeriod(): { month: number; year: number } {
  const now = new Date();
  const prevMonthIndex = (now.getMonth() + 11) % 12;
  return { month: prevMonthIndex + 1, year: now.getFullYear() };
}

const SharedPage: React.FC = () => {
  const period = previousPeriod();
  const { data: groups = [], isLoading } = useGetGroupsQuery(period);
  const [createGroup] = useCreateGroupMutation();
  const [deleteGroup] = useDeleteGroupMutation();
  const [groupName, setGroupName] = useState('');
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  const handleCreate = async () => {
    if (!groupName.trim()) return;
    await createGroup({ name: groupName.trim() });
    setGroupName('');
    setCreating(false);
  };

  const cancelCreate = () => {
    setCreating(false);
    setGroupName('');
  };

  if (isLoading) return <p>Loading...</p>;

  return (
    <>
      <Header title="Shared" />
      <Content>
        <div className={styles.grid}>
          {groups.map(group => (
            <GroupCard
              key={group.id}
              group={group}
              onOpen={() => navigate(`/shared/${group.id}`)}
              onDelete={() => deleteGroup(group.id)}
            />
          ))}

          {creating ? (
            <div className={styles.newCard}>
              <Textbox
                customClass={styles.input}
                placeholder="Shared name"
                value={groupName}
                onChange={setGroupName}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
              />
              <div className={styles.newActions}>
                <YButton variant="primary" onClick={handleCreate}>
                  <FaCirclePlus /> Create
                </YButton>
                <button
                  className={styles.cancel}
                  onClick={cancelCreate}
                  aria-label="Cancel"
                >
                  <IoClose />
                </button>
              </div>
            </div>
          ) : (
            <button
              className={styles.addTile}
              onClick={() => setCreating(true)}
            >
              <FaCirclePlus />
              <span>New shared</span>
            </button>
          )}
        </div>

        {groups.length === 0 && !creating && (
          <p className={styles.empty}>Nothing shared yet — add one above.</p>
        )}
      </Content>
    </>
  );
};

export default SharedPage;
