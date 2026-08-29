import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { uploadPhoto } from '../api';
import { ArrowRight, Camera, ChevronRight, Shield, Upload } from '../components/Icon';
import { BackButton, ErrorNote, PrimaryButton, StepBadge } from '../components/ui';
import { C, MONO } from '../theme';
import { OverlayChip } from '../components/ds';
import { useApp } from '../AppContext';

export default function PhotoScreen() {
  const nav = useNavigate();
  const { draft, patchDraft } = useApp();
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const photo = await uploadPhoto(file);
      if (!photo.metadataStripped) {
        throw new Error('Location metadata could not be removed. Please choose another photo.');
      }
      patchDraft({ photo });
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Please try again.');
      patchDraft({ photo: null });
    } finally {
      setUploading(false);
    }
  }

  const photo = draft.photo;

  return (
    <div className="screen scroll-y" style={{ zIndex: 26 }}>
      {/* 相机在移动端直出，桌面端退化为文件选择 */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/jpeg,image/png,image/heic,.heic"
        capture="environment"
        hidden
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <input
        ref={libraryRef}
        type="file"
        accept="image/jpeg,image/png,image/heic,.heic"
        hidden
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      <div
        className="anim-fade-up pt-page"
        style={{ paddingInline: 20, paddingBottom: 'calc(var(--safe-bottom) + 32px)', display: 'flex', flexDirection: 'column', gap: 18 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <BackButton onClick={() => nav(-1)} />
          <StepBadge>STEP 1 OF 3 · PHOTO</StepBadge>
        </div>

        <div>
          <div style={{ fontSize: 30, fontWeight: 640, letterSpacing: '-.8px' }}>Show us what you found</div>
          <div style={{ fontSize: 14, color: C.muted, marginTop: 7, lineHeight: 1.5 }}>
            You'll pick what it is yourself — no AI guessing on your behalf.
          </div>
        </div>

        {uploadError && (
          <ErrorNote
            title="Photo upload failed"
            body={uploadError}
            onRetry={() => cameraRef.current?.click()}
          />
        )}

        {!photo ? (
          <>
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              disabled={uploading}
              className="lift press"
              style={{
                position: 'relative',
                height: 210,
                borderRadius: 26,
                overflow: 'hidden',
                background: 'radial-gradient(100% 70% at 50% 0%,#2A5E97 0%,#153A6E 60%,#081739 100%)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 12,
                width: '100%',
              }}
            >
              <div style={{ position: 'absolute', inset: 14, border: '1.5px dashed rgba(184,255,54,.35)', borderRadius: 18 }} />
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  background: 'rgba(184,255,54,.14)',
                  border: '1px solid rgba(184,255,54,.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Camera size={26} strokeWidth={1.7} />
              </div>
              <div style={{ color: C.bg, fontSize: 16, fontWeight: 650 }}>
                {uploading ? 'Uploading…' : 'Take Photo'}
              </div>

            </button>

            <button
              type="button"
              onClick={() => libraryRef.current?.click()}
              disabled={uploading}
              className="chip-hover press"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 13,
                background: C.white,
                border: '1.5px solid rgba(11,33,97,.12)',
                borderRadius: 22,
                padding: '17px 18px',
                width: '100%',
              }}
            >
              <div style={{ width: 44, height: 44, borderRadius: 15, background: 'rgba(11,33,97,.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Upload />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 640 }}>Upload Photo</div>
                <div style={{ fontSize: 12, color: C.dim, marginTop: 3 }}>JPG, PNG or HEIC</div>
              </div>
              <ChevronRight size={14} />
            </button>

          </>
        ) : (
          <>
            <div style={{ position: 'relative', height: 280, borderRadius: 26, overflow: 'hidden', background: '#87847B' }}>
              <img
                src={photo.previewUrl}
                alt="Litter you photographed"
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
              <div style={{ position: 'absolute', top: 14, left: 14, fontFamily: MONO, fontSize: 8.5, letterSpacing: '.14em', color: 'rgba(255,255,255,.9)', background: 'rgba(30,36,44,.45)', backdropFilter: 'blur(6px)', padding: '5px 9px', borderRadius: 8 }}>
                PHOTO
              </div>
              <button
                type="button"
                onClick={() => {
                  patchDraft({ photo: null });
                  cameraRef.current?.click();
                }}
                style={{ position: 'absolute', top: 14, right: 14, fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,.9)', background: 'rgba(30,36,44,.45)', backdropFilter: 'blur(6px)', padding: '6px 11px', borderRadius: 999 }}
              >
                Retake
              </button>
              {photo.metadataStripped && (
                <OverlayChip style={{ position: 'absolute', left: 14, bottom: 14 }}>
                  <Shield size={11} />
                  LOCATION METADATA REMOVED
                </OverlayChip>
              )}
            </div>

            <PrimaryButton onClick={() => nav('/report/location')}>
              Continue
              <ArrowRight />
            </PrimaryButton>
          </>
        )}
      </div>
    </div>
  );
}
