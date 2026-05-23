import { useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useJoinGroupMutation } from '@/services/groupService';
import { Route } from '@/enums/routerEnum';

const JoinSharedPage: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [joinGroup, { isLoading, isError }] = useJoinGroupMutation();

  useEffect(() => {
    if (!code) return;
    joinGroup({ code })
      .unwrap()
      .then(group => {
        navigate(`/shared/${group.id}`);
      })
      .catch(() => {});
  }, [code]);

  if (isLoading) return <p>Joining shared...</p>;

  if (isError) {
    return (
      <p>
        Invalid or expired invite code. <Link to={Route.SHARED}>Back to Shared</Link>
      </p>
    );
  }

  return null;
};

export default JoinSharedPage;
