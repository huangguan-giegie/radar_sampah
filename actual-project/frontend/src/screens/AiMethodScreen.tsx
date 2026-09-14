import { useNavigate } from 'react-router-dom';
import { Info, Shield } from '../components/Icon';
import { BulletList, Callout, SectionLabel } from '../components/ds';
import { BackButton } from '../components/ui';
import { C, MONO } from '../theme';

export default function AiMethodScreen() {
  const nav = useNavigate();
  return (
    <div className="screen scroll-y" style={{ zIndex: 27 }}>
      <div className="measure i2-page anim-fade-up" style={{ paddingBottom: 'calc(var(--safe-bottom) + 34px)' }}>
        <BackButton onClick={() => nav(-1)} />
        <div>
          <SectionLabel size="sm">MODEL PROVENANCE</SectionLabel>
          <h1 className="i2-title" style={{ marginTop: 7 }}>How the AI suggestion works</h1>
          <p className="i2-subtitle">A suggestion is never submitted on its own. You confirm it first.</p>
        </div>

        <div className="i2-hero">
          <SectionLabel size="sm" tone="dark">HOW IT WORKS</SectionLabel>
          <BulletList tone="dark" items={[
            'You take a photo.',
            'The app suggests a category and an amount.',
            'You confirm it, or change it.',
          ]} />
          <div style={{ marginTop: 12, fontFamily: MONO, color: C.lime, fontSize: 9.5, lineHeight: 1.65 }}>
            TRAINED WITH OPEN MARINE-LITTER PHOTOS FROM SEA AND TACO
          </div>
        </div>

        <div className="i2-card">
          <SectionLabel size="sm">WHAT IT CAN SUGGEST</SectionLabel>
          <div className="i2-chip-row" style={{ marginTop: 11 }}>
            {['Plastic', 'Fishing gear', 'Glass', 'Metal', 'Paper', 'Other'].map((category) => <span key={category} className="i2-chip">{category}</span>)}
          </div>
          <p style={{ margin: '12px 0 0', color: C.muted, fontSize: 12, lineHeight: 1.5 }}>
            Styrofoam has no separate category in the app, so record it as Other.
          </p>
        </div>

        <div className="i2-card">
          <SectionLabel size="sm">CONFIDENCE SCORE</SectionLabel>
          <p style={{ margin: '8px 0 0', color: C.muted, fontSize: 12.5, lineHeight: 1.55 }}>
            The number beside a suggestion shows how sure the model is. A low score means the app asks you to choose the category yourself.
          </p>
        </div>

        <Callout title="Photo privacy" tone="quiet" icon={<Shield color={C.navy} />}>
          Ordinary report photos keep a protected photo reference. After-cleanup photos are processed temporarily and discarded after recognition.
        </Callout>
        <Callout title="Model source" tone="quiet" icon={<Info color={C.navy} />}>
          YOLO11m checkpoint sea-taco-yolo11m-best · SEA and TACO datasets. Detailed evaluation evidence remains in the project documentation for reviewers.
        </Callout>
      </div>
    </div>
  );
}
