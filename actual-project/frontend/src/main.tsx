// 程序入口。把 App 挂到 index.html 的 <div id="root"> 上。
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AppProvider } from './AppContext';
import 'leaflet/dist/leaflet.css';
import './styles/global.css';
import './styles/ds.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AppProvider>
        <App />
      </AppProvider>
    </BrowserRouter>
  </StrictMode>,
);
