import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import styles from './Sidebar.module.css';
import useSideBar, { buttonData } from './useSideBar';
import YButtom from '../Button/Button';
import { useGetUserQuery, useLogoutMutation } from '@/services/authService';
import { protectedRoutes, Route as RouteEnum } from '@/enums/routerEnum';

const Sidebar: React.FC = () => {
  const selectedTab = useSideBar();
  const { data: user } = useGetUserQuery();
  const [logout] = useLogoutMutation();
  const navigate = useNavigate();
  const location = useLocation();
  const displayLogout = !!user;

  const handleLogout = async () => {
    try {
      await logout().unwrap();
      if (protectedRoutes.includes(location.pathname as RouteEnum)) {
        navigate(RouteEnum.LOGIN);
      }
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  // TODO: Use Icons when min width's is reached
  return (
    <div className={styles.container}>
      <div className={styles.brand}>
        <h1>YM</h1>
      </div>
      {buttonData.map((button, index) => (
        <Link
          key={index}
          to={button.to}
          className={button.to === selectedTab ? styles.selected : undefined}
        >
          {button.text}
        </Link>
      ))}
      {displayLogout && (
        <YButtom
          customClass={styles.logout}
          variant="link"
          onClick={handleLogout}
        >
          Logout
        </YButtom>
      )}
    </div>
  );
};

export default Sidebar;
