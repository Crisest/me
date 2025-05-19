import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from '@/store/store';
import Sidebar from './components/Sidebar/Sidebar';
import { AppRoutes } from './routes';

function App(): JSX.Element {
  return (
    <Provider store={store}>
      <div className="app-container">
        <BrowserRouter>
          <Sidebar />
          <div className="main-content">
            <AppRoutes />
          </div>
        </BrowserRouter>
      </div>
    </Provider>
  );
}

export default App;
