// The entry point. This is the first of our own code that runs in the browser.
//
// Reading order for anyone new to the project:
//   main.tsx  -> AppContext.tsx (shared state) -> App.tsx (the routes)
//   -> src/screens/* (one file per page) -> src/api.ts (all network calls)
//
// The order of the wrappers below matters:
//   BrowserRouter  must be outside, because AppProvider and the screens both
//                  need to be able to change the URL.
//   AppProvider    must be outside App, because every screen reads the logged
//                  in user and the report draft from it.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AppProvider } from './AppContext';
// Leaflet ships its own stylesheet. Without this line the map tiles are
// stacked in the wrong place and the zoom buttons are unstyled.
import 'leaflet/dist/leaflet.css';
import './styles/global.css';
import './styles/ds.css';

// BrowserRouter, not HashRouter: we want real URLs like /beach/morib, so a
// volunteer can bookmark a beach or paste the link to someone else.
// It needs the server to send index.html for unknown paths (see render.yaml).
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AppProvider>
        <App />
      </AppProvider>
    </BrowserRouter>
  </StrictMode>,
);
