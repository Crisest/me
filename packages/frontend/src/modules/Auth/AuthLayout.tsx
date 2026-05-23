import React from 'react';
import styles from './AuthLayout.module.css';
import loginBrand from '@/assets/images/loginBrand.webp';

interface AuthLayoutProps {
  children: React.ReactNode;
}

const AuthLayout: React.FC<AuthLayoutProps> = ({ children }) => {
  return (
    <div className={styles.wrapper}>
      <aside
        className={styles.brand}
        style={{ backgroundImage: `url(${loginBrand})` }}
        aria-hidden="true"
      />
      <main className={styles.formPane}>{children}</main>
    </div>
  );
};

export default AuthLayout;
