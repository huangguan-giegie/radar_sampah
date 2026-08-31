import { C } from '../theme';
import { ShieldCheck } from './Icon';
import { GhostButton } from './ui';

const POINTS = [
  'Suggest the correct beach',
  'Assign the report to a supported beach',
  'Detect duplicate reports',
];


export function PrivacySheet({ onClose }: { onClose: () => void }) {
  return (

    <div style={{ position: 'absolute', inset: 0, zIndex: 900 }}>
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="anim-fade-in"
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(9,22,48,.45)',
          backdropFilter: 'blur(3px)',
          width: '100%',
        }}
      />
      <div
        className="anim-sheet-up measure"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          background: C.bg,
          borderRadius: '28px 28px 0 0',
          padding: '14px 22px calc(var(--safe-bottom) + 32px)',
        }}
      >
        <div
          style={{
            width: 40,
            height: 4.5,
            borderRadius: 3,
            background: 'rgba(30,36,44,.15)',
            margin: '0 auto 18px',
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 21,
              background: 'rgba(11,33,97,.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ShieldCheck size={19} color={C.navy} />
          </div>
          <div style={{ fontSize: 20, fontWeight: 650, letterSpacing: '-.4px' }}>
            Your privacy matters
          </div>
        </div>
        <div style={{ fontSize: 13, color: C.muted, margin: '14px 0 10px', lineHeight: 1.5 }}>
          Exact GPS is used privately to:
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {POINTS.map((p) => (
            <div key={p} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 13.5, color: C.ink2 }}>
              <i style={{ width: 5, height: 5, borderRadius: 3, background: C.navy, display: 'block', flex: 'none' }} />
              {p}
            </div>
          ))}
        </div>
        <div
          style={{
            marginTop: 16,
            background: C.navy,
            borderRadius: 18,
            padding: '15px 16px',
            color: C.cloud,
            fontSize: 12.5,
            lineHeight: 1.55,
          }}
        >
          Other users only ever see the <b style={{ color: C.bg }}>beach or broad area</b>.
          <br />
          Exact litter coordinates never appear on the public map.
        </div>
        <GhostButton onClick={onClose} height={52} style={{ marginTop: 14, borderRadius: 16, fontSize: 14.5, fontWeight: 640 }}>
          Got it
        </GhostButton>
      </div>
    </div>
  );
}
