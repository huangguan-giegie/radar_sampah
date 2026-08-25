// 路由表：哪个网址显示哪个页面。
// 需要登录的页面用 <RequireAuth> 包一层。
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { DeviceFrame } from './components/DeviceFrame';
import { TabBar } from './components/TabBar';
import { Toast } from './components/Toast';
import { useApp } from './AppContext';

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

// 这四个页面底部才显示 tab 栏，记录流程里不显示
const TAB_ROUTES = ['/home', '/map', '/reports', '/account'];

/** 未登录时跳到登录页，并记住回跳目标 */
function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, authReady } = useApp();
  const { pathname, search } = useLocation();
  if (!authReady) return null;
  if (!user) {
    return <Navigate to={`/identity?next=${encodeURIComponent(pathname + search)}`} replace />;
  }
  return children;
}

export default function App() {
  const { pathname } = useLocation();
  const { toast } = useApp();

  return (
    <DeviceFrame>
      <Routes>
        <Route path="/" element={<SplashScreen />} />
        <Route path="/welcome" element={<WelcomeScreen />} />
        <Route path="/identity" element={<IdentityScreen />} />

        <Route path="/home" element={<HomeScreen />} />
        <Route path="/map" element={<MapScreen />} />
        <Route path="/beach/:beachId" element={<BeachScreen />} />
        <Route path="/method" element={<MethodScreen />} />

        <Route path="/report/photo" element={<RequireAuth><PhotoScreen /></RequireAuth>} />
        <Route path="/report/location" element={<RequireAuth><GpsScreen /></RequireAuth>} />
        <Route path="/report/confirm" element={<RequireAuth><ConfirmBeachScreen /></RequireAuth>} />
        <Route path="/report/details" element={<RequireAuth><RecordScreen /></RequireAuth>} />
        <Route path="/report/review" element={<RequireAuth><ReviewScreen /></RequireAuth>} />
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
