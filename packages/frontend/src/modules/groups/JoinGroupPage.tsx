import { useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useJoinGroupMutation } from '@/services/groupService';
import { Route } from '@/enums/routerEnum';

const JoinGroupPage: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [joinGroup, { isLoading, isError }] = useJoinGroupMutation();

  useEffect(() => {
    if (!code) return;
    joinGroup({ code })
      .unwrap()
      .then(group => {
        navigate(`/groups/${group.id}`);
      })
      .catch(() => {});
  }, [code]);

  if (isLoading) return <p>Joining group...</p>;

  if (isError) {
    return (
      <p>
        Invalid or expired invite code. <Link to={Route.GROUPS}>Back to groups</Link>
      </p>
    );
  }

  return null;
};

export default JoinGroupPage;
