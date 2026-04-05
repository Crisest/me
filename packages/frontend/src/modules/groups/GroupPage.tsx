import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGetGroupsQuery, useCreateGroupMutation } from '@/services/groupService';
import Header from '@/components/Header/Header';
import Content from '@ui/Content/Content';
import YButton from '@ui/Button/Button';
import { FaCirclePlus } from 'react-icons/fa6';
import styles from './GroupPage.module.css';

const GroupPage: React.FC = () => {
  const { data: groups = [], isLoading } = useGetGroupsQuery();
  const [createGroup] = useCreateGroupMutation();
  const [groupName, setGroupName] = useState('');
  const navigate = useNavigate();

  const handleCreate = async () => {
    if (!groupName.trim()) return;
    await createGroup({ name: groupName.trim() });
    setGroupName('');
  };

  if (isLoading) return <p>Loading...</p>;

  return (
    <>
      <Header title="Groups" />
      <Content>
        <div className={styles.createForm}>
          <input
            className={styles.input}
            type="text"
            placeholder="Group name"
            value={groupName}
            onChange={e => setGroupName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
          />
          <YButton variant="primary" onClick={handleCreate}>
            <FaCirclePlus /> Create Group
          </YButton>
        </div>

        {groups.length === 0 ? (
          <p className={styles.empty}>No groups yet. Create one above.</p>
        ) : (
          <div className={styles.groupList}>
            {groups.map(group => (
              <div
                key={group.id}
                className={styles.groupCard}
                onClick={() => navigate(`/groups/${group.id}`)}
              >
                <h3 className={styles.groupName}>{group.name}</h3>
                <p className={styles.memberCount}>
                  {group.members.length} member{group.members.length !== 1 && 's'}
                </p>
              </div>
            ))}
          </div>
        )}
      </Content>
    </>
  );
};

export default GroupPage;
