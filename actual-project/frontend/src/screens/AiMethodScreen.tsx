import { useNavigate } from 'react-router-dom';
import { Shield } from '../components/Icon';
import { BulletList, Callout, SectionLabel } from '../components/ds';
import { BackButton } from '../components/ui';
import { C, MONO } from '../theme';

// Label on the left, value on the right, in the mono type the model block uses.
function ModelRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontFamily: MONO, fontSize: 9.5, letterSpacing: '.06em', lineHeight: 1.6 }}>
      <span style={{ color: C.faint, flex: 'none' }}>{label}</span>
      <span style={{ color: C.slate, textAlign: 'right', overflowWrap: 'anywhere' }}>{value}</span>
    </div>
  );
}

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
            'AI suggests a category and size.',
            'Confirm or correct both.',
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

        {/* No confidence card: the suggestion screen shows no score, so a card
            explaining one would describe a number nobody can see. */}
        <div className="i2-card">
          <SectionLabel size="sm">CATEGORY &amp; SIZE</SectionLabel>
          <p style={{ margin: '8px 0 0', color: C.muted, fontSize: 12.5, lineHeight: 1.55 }}>
            Category means litter type. Quantity uses Small, Medium, Large or Very Large. A new report with only Small bands is not counted as active evidence; Small is still used to record what remains after cleanup.
          </p>
        </div>

        <Callout title="Photo privacy" tone="quiet" icon={<Shield color={C.navy} />}>
          Ordinary report photos keep a protected photo reference. After-cleanup photos are processed temporarily and discarded after recognition.
        </Callout>

        {/* The checkpoint is the file the backend actually loads
            (sea_taco_yolo11m_best), so the name here can be checked. */}
        <div style={{ borderTop: `1px solid ${C.line2}`, paddingTop: 14 }}>
          <SectionLabel size="sm">MODEL &amp; LIMITATIONS</SectionLabel>
          <div style={{ marginTop: 8 }}>
            <ModelRow label="CHECKPOINT" value="sea-taco-yolo11m-best" />
            <ModelRow label="MODEL OUTPUT" value="AI suggestion · always check it" />
            <ModelRow label="DATASETS" value="SEA · TACO" />
          </div>
          <p style={{ margin: '10px 0 0', color: C.dim, fontSize: 11.5, lineHeight: 1.55 }}>
            Small or hidden litter may be missed. You can choose the category and band yourself. Exact item counts are not collected.
          </p>
        </div>
      </div>
    </div>
  );
}
