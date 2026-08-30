import { useLocation, useNavigate } from 'react-router-dom';
import { C } from '../theme';
import { BookmarkIcon, HomeIcon, Pin, UserIcon } from './Icon';


const TABS = [
  { to: '/home', label: 'Home', Icon: HomeIcon },
  { to: '/map', label: 'Map', Icon: Pin },
  { to: '/reports', label: 'Reports', Icon: BookmarkIcon },
  { to: '/account', label: 'Account', Icon: UserIcon },
];

export function TabBar() {
  const nav = useNavigate();
  const { pathname } = useLocation();

  return (
    <nav
      style={{
        position: 'absolute',
        left: 14,
        right: 14,
        bottom: 'var(--bottom-inset)',
        zIndex: 45,
        borderRadius: 26,
        background: 'rgba(255,255,255,.9)',
        backdropFilter: 'blur(20px) saturate(160%)',
        WebkitBackdropFilter: 'blur(20px) saturate(160%)',
        border: '1px solid rgba(11,33,97,.09)',
        boxShadow: '0 20px 44px -12px rgba(16,32,64,.3)',
        display: 'flex',
        padding: '7px 6px 9px',
      }}
    >
      {TABS.map(({ to, label, Icon }) => {
        const active = pathname === to;
        return (
          <button
            key={to}
            type="button"
            onClick={() => nav(to)}
            aria-current={active ? 'page' : undefined}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
              padding: '6px 0 2px',
              color: active ? C.navy : '#8794AD',
            }}
          >
            <Icon size={21} color="currentColor" />
            <span style={{ fontSize: 9.5, fontWeight: 620, letterSpacing: '.02em' }}>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
