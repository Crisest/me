import { useNavigate } from 'react-router-dom';
import { useLogoutMutation } from '@/services/authService';
import { Route } from '@/enums/routerEnum';

const useLogout = () => {
  const [logout, { isLoading }] = useLogoutMutation();
  const navigate = useNavigate();

  const handleLogout = async (): Promise<void> => {
    try {
      await logout().unwrap();
      navigate(Route.LOGIN, { replace: true });
    } catch {
      window.alert('Logout failed. Check your connection and try again.');
    }
  };

  return { handleLogout, isLoggingOut: isLoading };
};

export default useLogout;
