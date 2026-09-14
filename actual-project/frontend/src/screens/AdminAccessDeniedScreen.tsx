import { useNavigate } from 'react-router-dom';
import { Shield } from '../components/Icon';
import { Alert, InfoChip, SectionLabel } from '../components/ds';
import { BackButton, GhostButton } from '../components/ui';
import { useApp } from '../AppContext';
import { C } from '../theme';

export default function AdminAccessDeniedScreen() {
  const nav = useNavigate();
  const { user } = useApp();

  return (
    <div className="screen scroll-y" style={{ zIndex: 28 }}>
      <div className="measure i2-page anim-fade-up" style={{ paddingBottom: 'calc(var(--safe-bottom) + 34px)' }}>
        <BackButton onClick={() => nav('/community')} />
        <div>
          <SectionLabel size="sm">PLATFORM CONSOLE</SectionLabel>
          <h1 className="i2-title" style={{ marginTop: 7 }}>Create an activity</h1>
        </div>

        <InfoChip color="#9C4237" background="#FFF0EE" style={{ alignSelf: 'flex-start' }}>
          Participant account · Volunteer {user?.participantId}
        </InfoChip>

        <Alert title="Not authorised" tone="error">
          A participant account cannot create activities. Nothing was created.
        </Alert>

        <div className="i2-card" style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <span style={{ width: 38, height: 38, borderRadius: 19, background: 'rgba(11,33,97,.07)', display: 'grid', placeItems: 'center', flex: 'none' }}>
            <Shield color={C.navy} />
          </span>
          <div>
            <strong style={{ display: 'block', color: C.ink2, fontSize: 14 }}>Platform access only</strong>
            <span style={{ display: 'block', marginTop: 4, color: C.muted, fontSize: 12.5, lineHeight: 1.5 }}>
              Activities are created by moderator accounts.
            </span>
          </div>
        </div>

        <GhostButton onClick={() => nav('/community')}>Back to Community</GhostButton>
      </div>
    </div>
  );
}
