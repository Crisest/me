// packages/frontend/src/components/MobileNav/MobileNav.tsx
import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import styles from './MobileNav.module.css';
import { buttonData } from '@/components/Sidebar/useSideBar';
import YButton from '@ui/Button/Button';
import { useGetUserQuery, useLogoutMutation } from '@/services/authService';
import { protectedRoutes, Route as RouteEnum } from '@/enums/routerEnum';

const MobileNav: React.FC = () => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const { data: user } = useGetUserQuery();
  const [logout] = useLogoutMutation();
  const navigate = useNavigate();
  const location = useLocation();
  const displayLogout = !!user;

  // Close the menu whenever the route changes (covers link clicks too).
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  // Lock body scroll while the overlay is open.
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);

  const handleLogout = async (): Promise<void> => {
    try {
      await logout().unwrap();
      if (protectedRoutes.includes(location.pathname as RouteEnum)) {
        navigate(RouteEnum.LOGIN);
      }
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const isSelected = (path: string): boolean => location.pathname === path;

  return (
    <>
      <nav className={styles.bar}>
        <div className={styles.brand}>
          <h1>YM</h1>
        </div>
        <button
          type="button"
          className={styles.hamburger}
          aria-label="Toggle navigation menu"
          aria-expanded={isOpen}
          aria-controls="mobile-nav-panel"
          onClick={() => setIsOpen(prev => !prev)}
        >
          <span />
          <span />
          <span />
        </button>
      </nav>

      {isOpen && (
        <div
          id="mobile-nav-panel"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation"
          className={styles.panel}
        >
          {buttonData.map(button => (
            <Link
              key={button.to}
              to={button.to}
              className={isSelected(button.to) ? styles.selected : undefined}
            >
              {button.text}
            </Link>
          ))}

          <div className={styles.userSection}>
            {user && (
              <Link
                to={RouteEnum.PROFILE}
                className={isSelected(RouteEnum.PROFILE) ? styles.selected : undefined}
              >
                {user.name || user.email}
              </Link>
            )}
            {displayLogout && (
              <YButton
                customClass={styles.logout}
                variant="link"
                onClick={handleLogout}
              >
                Logout
              </YButton>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default MobileNav;
