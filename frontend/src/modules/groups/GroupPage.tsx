import { Group } from '@/types/Group';
import styles from './GroupPage.module.css';
import { Form } from 'react-aria-components';
import YButtom from '@/components/Button/Button';
import { FaCirclePlus } from 'react-icons/fa6';

const GroupPage: React.FC = () => {
  const groups: Group[] = []; // TODO use reactQuery to get groups

  return (
    <>
      {groups.length === 0 ? (
        <Form>
          <YButtom variant="icon" icon={<FaCirclePlus />}>
            {' '}
            test{' '}
          </YButtom>
        </Form>
      ) : (
        <h1>List of Groups</h1>
      )}
    </>
  );
};

export default GroupPage;
