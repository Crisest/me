import React from 'react';
import { Link } from 'react-router-dom';
import styles from './Sidebar.module.css';
import useSideBar, { buttonData } from './useSideBar';
import YButton from '@ui/Button/Button';
import { useGetUserQuery } from '@/services/authService';
import { Route as RouteEnum } from '@/enums/routerEnum';
import useLogout from '@/hooks/useLogout';

const Sidebar: React.FC = () => {
  const selectedTab = useSideBar();
  const { data: user } = useGetUserQuery();
  const { handleLogout, isLoggingOut } = useLogout();
  const displayLogout = !!user;
  // TODO: Use Icons when min width's is reached
  return (
    <div className={styles.container}>
      <div className={styles.brand}>
        <h1>YM</h1>
      </div>
      <div>
        {buttonData.map((button, index) => (
          <Link
            key={index}
            to={button.to}
            className={button.to === selectedTab ? styles.selected : undefined}
          >
            {button.text}
          </Link>
        ))}
      </div>
      <div className={styles.userSection}>
        {user && (
          <Link
            to={RouteEnum.PROFILE}
            className={`${
              selectedTab === RouteEnum.PROFILE ? styles.selected : ''
            }`}
          >
            {user.name || user.email}
          </Link>
        )}
        {displayLogout && (
          <YButton
            customClass={styles.logout}
            variant="link"
            onClick={handleLogout}
            isDisabled={isLoggingOut}
          >
            Logout
          </YButton>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
