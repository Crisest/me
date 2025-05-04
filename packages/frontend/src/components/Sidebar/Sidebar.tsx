import React from 'react';
import { Link } from 'react-router-dom';
import styles from './Sidebar.module.css';
import useSideBar, { buttonData } from './useSideBar';

const Sidebar: React.FC = () => {
  const selectedTab = useSideBar();

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
    </div>
  );
};

export default Sidebar;
