import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getBeach } from '../api';
import { getLitterGallery, litterGalleryPhotoUrl } from '../litterGallery';
import { EmptyState } from '../components/ds';
import { Camera } from '../components/Icon';
import { BackButton, ErrorNote, GhostButton, PrimaryButton, Skeleton } from '../components/ui';
import { getCleanupTarget } from '../iteration2';
import { fetchCleanupTarget } from '../iteration2Api';
import { C, formatDate, MONO } from '../theme';
import type { LitterGalleryEntry } from '../types';
import { useAsyncData } from '../useAsyncData';

/** Beach-scoped, authorised report photos. This is intentionally a public
 * screen and never reuses the private "My reports" response. */
export default function GalleryScreen() {
  const { beachId = '' } = useParams();
  const nav = useNavigate();
  const [name, setName] = useState('Beach');
  const [photos, setPhotos] = useState<LitterGalleryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  function load() {
    setLoading(true);
    setFailed(false);
    Promise.all([getBeach(beachId), getLitterGallery(beachId)])
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
        {/* The count sits beside the back button, as in the prototype, and
            only once there is something to count. "0 available photos" next
            to the empty-state card would say the same thing twice. */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <BackButton onClick={() => nav(`/beach/${beachId}`)} />
          {!loading && !failed && photos.length > 0 && (
            <span
              style={{
                padding: '7px 13px',
                borderRadius: 999,
                background: C.white,
                border: `1px solid ${C.line2}`,
                fontFamily: MONO,
                fontSize: 9.5,
                letterSpacing: '.1em',
                color: C.slate,
                whiteSpace: 'nowrap',
              }}
            >
              {photos.length} AVAILABLE {photos.length === 1 ? 'PHOTO' : 'PHOTOS'}
            </span>
          )}
        </div>
        <div>
          <h1 className="i2-title">Litter gallery</h1>
          <p className="i2-subtitle">{name}</p>
          {/* Kept: the photos are public, so the page says up front that no
              exact position comes with them. */}
          <p className="i2-subtitle" style={{ marginTop: 2 }}>Beach-level location only.</p>
        </div>

        <div className="i2-confirmed-row" style={{ color: C.slate }}>
          Only authorised report photos are shown.
        </div>

        {loading && <><Skeleton h={220} r={24} /><Skeleton h={220} r={24} /></>}

        {!loading && failed && (
          <ErrorNote title="Couldn't load this gallery" body="Try again when the beach photos are available." onRetry={load} />
        )}

        {!loading && !failed && photos.length === 0 && (
          <EmptyState
            icon={(
              <span aria-hidden="true" style={{ width: 52, height: 52, borderRadius: 26, background: C.tint, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                <Camera size={20} color={C.slate} />
              </span>
            )}
            title="No photos available"
            body="There are no report photos you can access for this beach yet."
          />
        )}

        {!loading && !failed && photos.map((photo) => (
          <article key={photo.reportId} className="i2-card" style={{ overflow: 'hidden', padding: 0 }}>
            {photo.photoUrl ? (
              <img src={litterGalleryPhotoUrl(photo.photoUrl)} alt={`Reported litter at ${name}`} style={{ display: 'block', width: '100%', height: 190, objectFit: 'cover' }} />
            ) : (
              <div style={{ height: 150, background: C.tint, display: 'grid', placeItems: 'center', color: C.muted, fontSize: 13 }}>Photo unavailable</div>
            )}
            <div style={{ padding: 16 }}>
              <strong style={{ display: 'block', fontSize: 14, color: C.ink2 }}>Report {photo.reportId.toUpperCase()}</strong>
              <span style={{ display: 'block', marginTop: 4, fontSize: 12, color: C.muted }}>Stored Counted report photo</span>
              <span style={{ display: 'block', marginTop: 5, fontSize: 10.5, color: C.dim }}>{formatDate(photo.reportedAt)}</span>
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
