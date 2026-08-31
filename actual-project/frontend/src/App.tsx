

import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { DeviceFrame } from './components/DeviceFrame';
import { TabBar } from './components/TabBar';
import { Toast } from './components/Toast';
import { useApp } from './AppContext';
import { guardStep, type ReportStep } from './flowRules';

import SplashScreen from './screens/SplashScreen';
import WelcomeScreen from './screens/WelcomeScreen';
import IdentityScreen from './screens/IdentityScreen';
import HomeScreen from './screens/HomeScreen';
import MapScreen from './screens/MapScreen';
import BeachScreen from './screens/BeachScreen';
import MethodScreen from './screens/MethodScreen';
import PhotoScreen from './screens/PhotoScreen';
import GpsScreen from './screens/GpsScreen';
import ConfirmBeachScreen from './screens/ConfirmBeachScreen';
import RecordScreen from './screens/RecordScreen';
import ReviewScreen from './screens/ReviewScreen';
import SubmittedScreen from './screens/SubmittedScreen';
import MyReportsScreen from './screens/MyReportsScreen';
import AccountScreen from './screens/AccountScreen';


const TAB_ROUTES = ['/home', '/map', '/reports', '/account'];


function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, authReady } = useApp();
  const { pathname, search } = useLocation();
  if (!authReady) return null;
  if (!user) {
    return <Navigate to={`/identity?next=${encodeURIComponent(pathname + search)}`} replace />;
  }
  return children;
}


function RequireStep({ step, children }: { step: ReportStep; children: JSX.Element }) {
  const { draft, lastSavedReport } = useApp();
  const to = guardStep(step, draft);
  if (to && lastSavedReport) return <Navigate to="/reports" replace />;
  return to ? <Navigate to={to} replace /> : children;
}

export default function App() {
  const { pathname } = useLocation();
  const { toast } = useApp();
  const pageTitle = pathname.startsWith('/report/saved')
    ? 'Report saved'
    : pathname.startsWith('/report/')
      ? 'Add a report'
      : pathname.startsWith('/beach/')
        ? 'Beach details'
        : pathname === '/map'
          ? 'Beach map'
          : pathname === '/reports'
            ? 'My reports'
            : pathname === '/account'
              ? 'Account'
              : pathname === '/home'
                ? 'Home'
                : 'Radar Sampah';

  useEffect(() => {
    document.title = `${pageTitle} · Radar Sampah`;
  }, [pageTitle]);

  return (
    <DeviceFrame>
      <div
        aria-live="polite"
        style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0 }}
      >
        {pageTitle}
      </div>
      <Routes>
        <Route path="/" element={<SplashScreen />} />
        <Route path="/welcome" element={<WelcomeScreen />} />
        <Route path="/identity" element={<IdentityScreen />} />

        <Route path="/home" element={<HomeScreen />} />
        <Route path="/map" element={<MapScreen />} />
        <Route path="/beach/:beachId" element={<BeachScreen />} />
        <Route path="/method" element={<MethodScreen />} />

        <Route path="/report/photo" element={
          <RequireAuth><RequireStep step="photo"><PhotoScreen /></RequireStep></RequireAuth>
        } />
        <Route path="/report/location" element={
          <RequireAuth><RequireStep step="location"><GpsScreen /></RequireStep></RequireAuth>
        } />
        <Route path="/report/confirm" element={
          <RequireAuth><RequireStep step="confirm"><ConfirmBeachScreen /></RequireStep></RequireAuth>
        } />
        <Route path="/report/details" element={
          <RequireAuth><RequireStep step="details"><RecordScreen /></RequireStep></RequireAuth>
        } />
        <Route path="/report/review" element={
          <RequireAuth><RequireStep step="review"><ReviewScreen /></RequireStep></RequireAuth>
        } />
        <Route path="/report/saved" element={<RequireAuth><SubmittedScreen /></RequireAuth>} />

        <Route path="/reports" element={<RequireAuth><MyReportsScreen /></RequireAuth>} />
        <Route path="/account" element={<RequireAuth><AccountScreen /></RequireAuth>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {TAB_ROUTES.includes(pathname) && <TabBar />}
      {toast && <Toast message={toast} />}
    </DeviceFrame>
  );
}
