

// The route table: which URL shows which screen.
//
// This is the map of the whole app. Read it top to bottom and you can see
// every page we have and what it takes to reach it. Pages that need a logged
// in user are wrapped in <RequireAuth>; pages in the middle of the report flow
// are also wrapped in <RequireStep>.
//
// This file also keeps the browser tab title and a spoken page name in step
// with the route, because in a browser those are how a user knows where they
// are. See pageTitle below.
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


// The bottom tab bar appears on these four pages only.
// It is hidden all through the report flow on purpose: while filing a report
// the user has one job, and a tab bar is an invitation to wander off and lose
// what they typed.
const TAB_ROUTES = ['/home', '/map', '/reports', '/account'];


/**
 * Send anyone who is not logged in to the identity screen, and remember where
 * they were going so we can put them back there afterwards.
 *
 * The "?next=" part matters in a web app: people arrive from a shared link or
 * a bookmark, not always from our home page. Without it, logging in would
 * always dump them on /home and they would have to find that beach again.
 * The value is cleaned by safeNextPath() before it is used.
 */
function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, authReady } = useApp();
  const { pathname, search } = useLocation();
  // Render nothing until we know who the user is. Deciding earlier would
  // redirect a logged-in user to the login page for a split second on every
  // page load, because at that moment user is still null.
  if (!authReady) return null;
  if (!user) {
    return <Navigate to={`/identity?next=${encodeURIComponent(pathname + search)}`} replace />;
  }
  return children;
}


/**
 * The report-flow guard. If someone lands in the middle of the flow by typing
 * a URL or opening a bookmark, send them to the step they can actually be on.
 *
 * It sits INSIDE RequireAuth, not outside: a logged-out deep link should first
 * go to /identity?next=..., come back to the same URL, and only then be
 * checked for how far the draft has got. The other order would decide the step
 * for a user we have not identified yet. The rule itself is in flowRules.ts.
 *
 * One case is not sent back into the flow at all - see below.
 */
function RequireStep({ step, children }: { step: ReportStep; children: JSX.Element }) {
  const { draft, lastSavedReport } = useApp();
  const to = guardStep(step, draft);
  // The user has just finished a report, so the draft is empty again. Sending
  // them back to step 1 here would look like the app had started a fresh
  // report on its own - which is what the back button from the confirmation
  // screen, or an old report URL, would do. Their reports list is the honest
  // place to land instead.
  //
  // This does not get in the way of filing another report: SubmittedScreen
  // clears lastSavedReport before it sends the user to step 1.
  if (to && lastSavedReport) return <Navigate to="/reports" replace />;
  return to ? <Navigate to={to} replace /> : children;
}

export default function App() {
  const { pathname } = useLocation();
  const { toast } = useApp();
  // A plain name for the page the user is on, worked out from the URL.
  //
  // Every screen sits inside the same phone-shaped frame, so nothing on the
  // page itself tells a browser user which one they are on. This single string
  // feeds both the tab title and the spoken announcement below, so the two can
  // never drift apart.
  //
  // Order matters here: /report/saved is tested first because it also starts
  // with /report/, and the wider test below would otherwise swallow it and
  // call the confirmation page "Add a report".
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

  // Keep the browser tab title in step with the route.
  //
  // This is one page as far as the browser is concerned, so the title never
  // changes by itself. Without this, every open tab, every bookmark and every
  // history entry would read "Radar Sampah" and none could be told apart.
  useEffect(() => {
    document.title = `${pageTitle} · Radar Sampah`;
  }, [pageTitle]);

  return (
    <DeviceFrame>
      {/* Says the new page name out loud for screen reader users.

          Moving between routes does not reload the page, so a screen reader
          announces nothing on its own and the user is left guessing whether
          the tap did anything. A polite live region speaks the new name after
          whatever it is already reading, without cutting the user off.

          The style hides the text from sight but keeps it in the page.
          display:none or visibility:hidden would hide it from screen readers
          too, and then it would say nothing at all. */}
      <div
        aria-live="polite"
        style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0 }}
      >
        {pageTitle}
      </div>
      <Routes>
        {/* Public pages. Anyone can look at beach data without an account -
            that is the point of the project, and it is what makes the map
            worth sharing. Only FILING a report needs an identity. */}
        <Route path="/" element={<SplashScreen />} />
        <Route path="/welcome" element={<WelcomeScreen />} />
        <Route path="/identity" element={<IdentityScreen />} />

        <Route path="/home" element={<HomeScreen />} />
        <Route path="/map" element={<MapScreen />} />
        <Route path="/beach/:beachId" element={<BeachScreen />} />
        <Route path="/method" element={<MethodScreen />} />

        {/* The report flow, in order. Two wrappers on each one:
            RequireAuth  - you must be identified to file a report
            RequireStep  - you must have finished the earlier steps */}
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
        {/* The result page has no RequireStep. By the time we get here the
            draft has been cleared, so a step check would look at an empty
            draft and bounce the user off the confirmation they just earned. */}
        <Route path="/report/saved" element={<RequireAuth><SubmittedScreen /></RequireAuth>} />

        <Route path="/reports" element={<RequireAuth><MyReportsScreen /></RequireAuth>} />
        <Route path="/account" element={<RequireAuth><AccountScreen /></RequireAuth>} />

        {/* Anything we do not recognise goes home rather than showing a blank
            page. replace, so the broken URL does not sit in the history and
            trap the user on the back button. */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {TAB_ROUTES.includes(pathname) && <TabBar />}
      {toast && <Toast message={toast} />}
    </DeviceFrame>
  );
}
