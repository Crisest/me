import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useGetGroupsQuery,
  useCreateGroupMutation,
  useDeleteGroupMutation,
} from '@/services/groupService';
import Content from '@ui/Content/Content';
import YButton from '@ui/Button/Button';
import Textbox from '@ui/Textbox/Textbox';
import { FaCirclePlus } from 'react-icons/fa6';
import { IoClose } from 'react-icons/io5';
import styles from './SharedPage.module.css';

const SharedPage: React.FC = () => {
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
      {/* <Header title="Shared" /> */}
      <Content>
        <div className={styles.createForm}>
          <Textbox
            customClass={styles.input}
            placeholder="Shared name"
            value={groupName}
            onChange={setGroupName}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
          />
          <YButton variant="primary" onClick={handleCreate}>
            <FaCirclePlus /> Create Shared
          </YButton>
        </div>

        {groups.length === 0 ? (
          <p className={styles.empty}>Nothing shared yet. Create one above.</p>
        ) : (
          <div className={styles.groupList}>
            {groups.map(group => (
              <div
                key={group.id}
                className={styles.groupCard}
                onClick={() => navigate(`/shared/${group.id}`)}
              >
                <button
                  className={styles.deleteBtn}
                  onClick={e => {
                    e.stopPropagation();
                    deleteGroup(group.id);
                  }}
                  aria-label="Delete shared"
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

export default SharedPage;
