import { Outlet } from 'react-router-dom';
import Sidebar from '@/components/Sidebar/Sidebar';
import MobileNav from '@/components/MobileNav/MobileNav';
import useMediaQuery from '@/hooks/useMediaQuery';
import { MEDIA } from '@/styles/breakpoints';

function AppLayout(): JSX.Element {
  const isMobile = useMediaQuery(MEDIA.mobile);

  return (
    <div className="app-container">
      {isMobile ? <MobileNav /> : <Sidebar />}
      <div className="main-content">
        <Outlet />
      </div>
    </div>
  );
}

export default AppLayout;
