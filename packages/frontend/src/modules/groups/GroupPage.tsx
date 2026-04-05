import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useGetGroupsQuery,
  useCreateGroupMutation,
  useDeleteGroupMutation,
} from '@/services/groupService';
import Header from '@/components/Header/Header';
import Content from '@ui/Content/Content';
import YButton from '@ui/Button/Button';
import Textbox from '@ui/Textbox/Textbox';
import { FaCirclePlus } from 'react-icons/fa6';
import { IoClose } from 'react-icons/io5';
import styles from './GroupPage.module.css';

const GroupPage: React.FC = () => {
  const { data: groups = [], isLoading } = useGetGroupsQuery();
  const [createGroup] = useCreateGroupMutation();
  const [deleteGroup] = useDeleteGroupMutation();
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
          <Textbox
            customClass={styles.input}
            placeholder="Group name"
            value={groupName}
            onChange={setGroupName}
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
                <button
                  className={styles.deleteBtn}
                  onClick={e => {
                    e.stopPropagation();
                    deleteGroup(group.id);
                  }}
                  aria-label="Delete group"
                >
                  <IoClose />
                </button>
                <h3 className={styles.groupName}>{group.name}</h3>
                <p className={styles.memberCount}>
                  {group.members.length} member
                  {group.members.length !== 1 && 's'}
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
