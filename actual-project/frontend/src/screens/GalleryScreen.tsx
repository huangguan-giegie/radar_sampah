import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getBeach, getBeachGallery } from '../api';
import { EmptyState, SectionLabel } from '../components/ds';
import { BackButton, ErrorNote, GhostButton, PrimaryButton, Skeleton } from '../components/ui';
import { formatReportComposition } from '../flowRules';
import { getCleanupTarget } from '../iteration2';
import { fetchCleanupTarget } from '../iteration2Api';
import { C, formatDate } from '../theme';
import type { GalleryPhoto } from '../types';
import { useAsyncData } from '../useAsyncData';

/** Beach-scoped, authorised report photos. This is intentionally a public
 * screen and never reuses the private "My reports" response. */
export default function GalleryScreen() {
  const { beachId = '' } = useParams();
  const nav = useNavigate();
  const [name, setName] = useState('Beach');
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  function load() {
    setLoading(true);
    setFailed(false);
    Promise.all([getBeach(beachId), getBeachGallery(beachId)])
      .then(([beach, rows]) => {
        setName(beach.name);
        setPhotos(rows);
      })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }

  useEffect(load, [beachId]);
  const { data: cleanupTarget } = useAsyncData(
    () => fetchCleanupTarget(beachId),
    [beachId],
    getCleanupTarget(beachId),
  );

  return (
    <div className="screen scroll-y" style={{ zIndex: 27 }}>
      <div className="measure i2-page anim-fade-up" style={{ paddingBottom: 'calc(var(--safe-bottom) + 34px)' }}>
        <BackButton onClick={() => nav(`/beach/${beachId}`)} />
        <div>
          <SectionLabel size="sm">LITTER GALLERY</SectionLabel>
          <h1 className="i2-title" style={{ marginTop: 7 }}>{name}</h1>
          <p className="i2-subtitle">Beach-level location only.</p>
        </div>

        <div className="i2-confirmed-row" style={{ color: C.slate }}>
          Only authorised report photos are shown.
        </div>

        {loading && <><Skeleton h={220} r={24} /><Skeleton h={220} r={24} /></>}

        {!loading && failed && (
          <ErrorNote title="Couldn't load this gallery" body="Try again when the beach photos are available." onRetry={load} />
        )}

        {!loading && !failed && photos.length === 0 && (
          <EmptyState title="No gallery photos yet" body="There are no authorised report photos for this beach." />
        )}

        {!loading && !failed && photos.map((photo) => (
          <article key={photo.reportId} className="i2-card" style={{ overflow: 'hidden', padding: 0 }}>
            {photo.photoUrl ? (
              <img src={photo.photoUrl} alt={`Reported litter at ${name}`} style={{ display: 'block', width: '100%', height: 190, objectFit: 'cover' }} />
            ) : (
              <div style={{ height: 150, background: C.tint, display: 'grid', placeItems: 'center', color: C.muted, fontSize: 13 }}>Photo unavailable</div>
            )}
            <div style={{ padding: 16 }}>
              <strong style={{ display: 'block', fontSize: 14, color: C.ink2 }}>Report {photo.reportId.toUpperCase()}</strong>
              <span style={{ display: 'block', marginTop: 4, fontSize: 12, color: C.muted }}>{formatReportComposition(photo.quantities)}</span>
              <span style={{ display: 'block', marginTop: 5, fontSize: 10.5, color: C.dim }}>{formatDate(photo.createdAt)}</span>
            </div>
          </article>
        ))}

        {cleanupTarget ? (
          <PrimaryButton onClick={() => nav(`/cleanup/${beachId}`)}>Clean up {cleanupTarget.reportId.toUpperCase()}</PrimaryButton>
        ) : (
          <GhostButton onClick={() => nav(`/beach/${beachId}`)}>Back to beach</GhostButton>
        )}
      </div>
    </div>
  );
}
