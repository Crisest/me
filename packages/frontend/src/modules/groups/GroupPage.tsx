import { Group } from '@portfolio/common';
import styles from './GroupPage.module.css';
import { Form } from 'react-aria-components';
import YButton from '@ui/Button/Button';
import { FaCirclePlus } from 'react-icons/fa6';

const GroupPage: React.FC = () => {
  const groups: Group[] = []; // TODO use reactQuery to get groups

  return (
    <>
      {groups.length === 0 ? (
        <Form>
          <h1 className={styles.title}>No groups found</h1>
          <p className={styles.description}>
            You don't have any groups yet. Create one to get started.
          </p>
          <YButton variant="primary" customClass={styles.createGroupButton}>
            <FaCirclePlus /> Create Group
          </YButton>
        </Form>
      ) : (
        <h1>List of Groups</h1>
      )}
    </>
  );
};

export default GroupPage;
