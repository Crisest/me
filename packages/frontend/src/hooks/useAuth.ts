import { useGetUserQuery } from '@/services/authService';

export const useAuth = () => {
  const { data: user, isLoading, error } = useGetUserQuery();

  return {
    user,
    isAuthenticated: !!user,
    isLoading,
    error,
  };
};
