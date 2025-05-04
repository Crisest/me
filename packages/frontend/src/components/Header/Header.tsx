import React from 'react';
import styles from './Header.module.css';
import useDelayedToggle from '@/hooks/useDelayedToggle';

interface HeaderProps {
  title: string;
}

const Header: React.FC<HeaderProps> = ({ title }) => {
  const isFullScreen = useDelayedToggle(true, 100);

  return (
    <header
      className={`${styles.header} ${isFullScreen ? styles.fullScreen : ''}`}
    >
      <h1>{isFullScreen ? '' : title}</h1>
    </header>
  );
};

export default Header;
