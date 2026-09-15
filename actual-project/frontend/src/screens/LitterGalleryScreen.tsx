import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getBeach } from '../api';
import { getLitterGallery, litterGalleryPhotoUrl } from '../litterGallery';
import { BackButton, Skeleton } from '../components/ui';
import { C, formatDate, MONO } from '../theme';
import type { LitterGalleryEntry } from '../types';

export function LitterGalleryView({
  beachName,
  entries,
  photoUrl,
}: {
  beachName: string;
  entries: LitterGalleryEntry[];
  photoUrl: (value: string) => string;
}) {
  return (
    <div>
      <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '.16em', color: C.muted }}>
        BEACH INFORMATION
      </div>
      <h1 className="i2-title" style={{ marginTop: 8 }}>Litter Gallery</h1>
      <p className="i2-subtitle">{beachName} · photos from ordinary Counted reports.</p>

      {entries.length === 0 ? (
        <div style={{ marginTop: 22, border: '1.5px dashed rgba(11,33,97,.18)', borderRadius: 22, padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.ink2 }}>No litter photos yet</div>
          <div style={{ marginTop: 7, fontSize: 12, lineHeight: 1.55, color: C.muted }}>
            This gallery shows photos from ordinary Counted reports for this beach when they are available.
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 14, marginTop: 20 }}>
          {entries.map((entry) => (
            <article key={entry.reportId} style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: 22, overflow: 'hidden' }}>
              <img
                src={photoUrl(entry.photoUrl)}
                alt={`Litter reported at ${beachName}`}
                loading="lazy"
                style={{ width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', display: 'block', background: C.tint }}
              />
              <div style={{ padding: '12px 14px 14px' }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: C.ink2 }}>{formatDate(entry.reportedAt)}</div>
                <div style={{ marginTop: 4, fontFamily: MONO, fontSize: 9, letterSpacing: '.08em', color: C.dim }}>
                  REPORT {entry.reportId}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export default function LitterGalleryScreen() {
  const { beachId = '' } = useParams();
  const nav = useNavigate();
  const [beachName, setBeachName] = useState('Beach');
  const [entries, setEntries] = useState<LitterGalleryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    Promise.all([getBeach(beachId), getLitterGallery(beachId)])
      .then(([beach, gallery]) => {
        if (!active) return;
        setBeachName(beach.name);
        setEntries(gallery);
      })
      .catch((reason) => {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : 'Could not load the litter gallery.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [beachId]);

  return (
    <div className="screen scroll-y" style={{ zIndex: 22 }}>
      <div className="measure i2-page" style={{ paddingBottom: 'calc(var(--safe-bottom) + 34px)' }}>
        <BackButton onClick={() => nav(`/beach/${encodeURIComponent(beachId)}`)} />
        {loading ? (
          <div style={{ display: 'grid', gap: 12, marginTop: 18 }}>
            <Skeleton h={36} r={12} />
            <Skeleton h={230} r={22} />
          </div>
        ) : error ? (
          <div role="alert" style={{ marginTop: 20, color: C.red, fontSize: 13 }}>{error}</div>
        ) : (
          <LitterGalleryView beachName={beachName} entries={entries} photoUrl={litterGalleryPhotoUrl} />
        )}
      </div>
    </div>
  );
}
