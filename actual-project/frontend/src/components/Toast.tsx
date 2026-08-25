import { C } from '../theme';

export function Toast({ message }: { message: string }) {
  return (
    <div
      role="status"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 98,
        zIndex: 70,
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      <div
        className="anim-fade-up"
        style={{
          background: 'rgba(12,24,52,.93)',
          color: C.bg,
          fontSize: 12.5,
          fontWeight: 600,
          padding: '11px 18px',
          borderRadius: 999,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          boxShadow: '0 12px 30px -8px rgba(7,18,40,.5)',
        }}
      >
        <i style={{ width: 6, height: 6, borderRadius: 3, background: C.lime, display: 'block' }} />
        {message}
      </div>
    </div>
  );
}
