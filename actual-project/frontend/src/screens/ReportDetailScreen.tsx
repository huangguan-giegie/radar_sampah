import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getMyReports } from '../api';
import { useApp } from '../AppContext';
import { Camera } from '../components/Icon';
import { StatusBadge, type BadgeStatus } from '../components/ds';
import { BackButton, ErrorNote, GhostButton, Label, PrimaryButton, Skeleton } from '../components/ui';
import { historicalPhotoUnavailable } from '../flowRules';
import { C, MONO, formatDate } from '../theme';
import type { LitterCategory, LitterReport, QuantityBand } from '../types';
import { createSharePath } from '../iteration2';

export default function ReportDetailScreen() {
  const { reportId = '' } = useParams();
  const nav = useNavigate();
  const { patchDraft, resetDraft, setLastSavedReport, reportsVersion } = useApp();
  const [report, setReport] = useState<LitterReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sharePath, setSharePath] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setFailed(false);
    setSharePath(null);
    getMyReports()
      .then((reports) => {
        const match = reports.find((item) => item.id === reportId) ?? null;
        if (!active) return;
        setReport(match);
        setFailed(!match);
        if (match?.status === 'Counted' && match.itemCounts && Object.keys(match.itemCounts).length > 0) {
          createSharePath({ reportId: match.id })
            .then((path) => { if (active) setSharePath(path); })
            .catch(() => { if (active) setSharePath(null); });
        }
      })
      .catch(() => { if (active) setFailed(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reportId, reportsVersion]);

  function editReport() {
    if (!report) return;
    resetDraft();
    setLastSavedReport(null);
    patchDraft({
      editingReportId: report.id,
      beachId: report.beachId,
      beachName: report.beachName,
      quantities: { ...report.quantities },
      locationSource: report.locationSource ?? 'manual',
      coords: null,
      existingPhotoUrl: report.photoUrl ?? null,
      existingPhotoKey: report.photoKey ?? null,
      existingPhotoUnavailable: historicalPhotoUnavailable(report.photoUrl, report.photoKey),
      editingStatus: report.status,
      editingStatusNote: report.statusNote ?? null,
    });
    nav('/report/details');
  }

  function reportShareUrl() {
    return sharePath ? `${window.location.origin}${sharePath}` : null;
  }

  async function copyShareLink() {
    setShareBusy(true);
    try {
      const url = reportShareUrl();
      if (!url) return;
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    } finally {
      setShareBusy(false);
    }
  }

  async function shareReport() {
    setShareBusy(true);
    try {
      const url = reportShareUrl();
      if (!url) return;
      if (navigator.share) await navigator.share({ title: `Litter report at ${report!.beachName}`, url });
      else await navigator.clipboard.writeText(url);
    } catch {
      // A dismissed native share sheet is not an error.
    } finally {
      setShareBusy(false);
    }
  }

  async function shareOnWhatsApp() {
    setShareBusy(true);
    try {
      const url = reportShareUrl();
      if (url) window.open(`https://wa.me/?text=${encodeURIComponent(`${report!.beachName} litter report · ${url}`)}`, '_blank', 'noopener,noreferrer');
    } catch {
      setCopied(false);
    } finally {
      setShareBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="screen scroll-y">
        <div className="measure i2-page">
          <BackButton onClick={() => nav('/reports')} />
          <Skeleton h={210} r={24} />
          <Skeleton h={180} r={24} />
        </div>
      </div>
    );
  }

  if (failed || !report) {
    return (
      <div className="screen scroll-y">
        <div className="measure i2-page">
          <BackButton onClick={() => nav('/reports')} />
          <ErrorNote title="Report not found" body="Return to My Reports and choose another report." />
          <PrimaryButton onClick={() => nav('/reports')}>Back to My Reports</PrimaryButton>
        </div>
      </div>
    );
  }

  const findings = Object.entries(report.quantities) as [LitterCategory, QuantityBand][];

  return (
    <div className="screen scroll-y" style={{ zIndex: 25 }}>
      <div className="measure i2-page anim-fade-up" style={{ paddingBottom: 'calc(var(--safe-bottom) + 34px)' }}>
        <BackButton onClick={() => nav('/reports')} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14 }}>
          <div>
            <Label>REPORT DETAILS</Label>
            <h1 className="i2-title" style={{ marginTop: 7 }}>{report.beachName}</h1>
            <div style={{ marginTop: 6, color: C.muted, fontSize: 13 }}>{formatDate(report.createdAt)}</div>
          </div>
          <StatusBadge status={report.status.toLowerCase() as BadgeStatus} indicator>{report.status}</StatusBadge>
        </div>

        {report.photoUrl ? (
          <img
            src={report.photoUrl}
            alt={`Litter reported at ${report.beachName}`}
            style={{ width: '100%', height: 220, objectFit: 'cover', borderRadius: 24, border: `1px solid ${C.line}` }}
          />
        ) : (
          <div style={{ height: 150, borderRadius: 24, background: C.tint, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: C.muted }}>
            <Camera size={24} color={C.muted} />
            <span style={{ fontSize: 13 }}>Photo unavailable</span>
          </div>
        )}

        <div className="i2-card">
          <Label>WHAT WAS RECORDED</Label>
          <div style={{ display: 'grid', gap: 0, marginTop: 10 }}>
            {findings.map(([category, quantity]) => (
              <div key={category} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '12px 0', borderBottom: `1px solid ${C.line}` }}>
                <span style={{ fontSize: 14, fontWeight: 650, color: C.ink2 }}>{category}</span>
                <span style={{ fontFamily: MONO, fontSize: 12, color: C.muted }}>{quantity}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, paddingTop: 12, fontSize: 12, color: C.muted }}>
            <span>Location</span>
            <strong style={{ color: C.ink2 }}>
              {report.locationSource === 'gps' ? 'GPS matched' : report.locationSource === 'manual' ? 'Selected manually' : 'Not recorded'}
            </strong>
          </div>
        </div>

        {report.statusNote && (
          <div style={{ padding: '13px 15px', borderRadius: 16, background: 'rgba(217,162,75,.11)', color: '#7A561B', fontSize: 12.5, lineHeight: 1.5 }}>
            {report.statusNote}
          </div>
        )}

        <PrimaryButton onClick={() => nav(`/beach/${report.beachId}`)}>View beach</PrimaryButton>
        {report.status === 'Counted' && report.itemCounts && Object.keys(report.itemCounts).length > 0 && (
          <>
            <div className="i2-share-grid">
              <button type="button" className="btn-ghost press i2-share-button" onClick={shareOnWhatsApp} disabled={shareBusy || !sharePath}>WhatsApp</button>
              <button type="button" className="btn-ghost press i2-share-button" onClick={shareReport} disabled={shareBusy || !sharePath}>Share…</button>
              <button type="button" className={`btn-primary press i2-share-button${copied ? ' i2-copy-success' : ''}`} onClick={copyShareLink} disabled={shareBusy || !sharePath}>{copied ? 'Copied' : 'Copy link'}</button>
            </div>
            {!sharePath && <p style={{ margin: '8px 0 0', color: C.muted, fontSize: 11 }}>Preparing a secure report link…</p>}
          </>
        )}
        <GhostButton onClick={editReport}>{report.status === 'Incomplete' ? 'Fix this report' : 'Edit this report'}</GhostButton>
        <div style={{ textAlign: 'center', fontFamily: MONO, fontSize: 10, color: C.faint }}>REPORT {report.id.toUpperCase()}</div>
      </div>
    </div>
  );
}
