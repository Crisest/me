// packages/frontend/src/App.tsx
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from '@/store/store';
import Sidebar from './components/Sidebar/Sidebar';
import MobileNav from './components/MobileNav/MobileNav';
import useMediaQuery from '@/hooks/useMediaQuery';
import { MEDIA } from '@/styles/breakpoints';
import { AppRoutes } from './routes';

function App(): JSX.Element {
  const isMobile = useMediaQuery(MEDIA.mobile);

  return (
    <Provider store={store}>
      <div className="app-container">
        <BrowserRouter>
          {isMobile ? <MobileNav /> : <Sidebar />}
          <div className="main-content">
            <AppRoutes />
          </div>
        </BrowserRouter>
      </div>
    </Provider>
  );
}

export default App;
