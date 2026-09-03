// The entry point - the first of our own code the browser runs.
// Reading order for anyone new: main.tsx -> AppContext.tsx (shared state) ->
// App.tsx (routes) -> src/screens/* (one page each) -> src/api.ts (network).
// Wrapper order matters: BrowserRouter is outside AppProvider because both the
// provider and the screens change the URL, and AppProvider is outside App
// because every screen reads the signed-in user and the draft report from it.

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AppProvider } from './AppContext';
import { ErrorBoundary } from './components/ErrorBoundary';
// Leaflet ships its own stylesheet. Without this line the map tiles are
// stacked in the wrong place and the zoom buttons are unstyled.
import 'leaflet/dist/leaflet.css';
import './styles/global.css';
import './styles/ds.css';

// Outside the router and the provider on purpose: a throw from either of them
// is exactly the case where the page would otherwise go blank, and a boundary
// inside them cannot catch its own parent.
//
// BrowserRouter, not HashRouter: we want real URLs like /beach/morib, so a
// volunteer can bookmark a beach or paste the link to someone else. It needs
// the server to send index.html for unknown paths (see render.yaml).
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AppProvider>
          <App />
        </AppProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
);
