import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { photoPreviewUrl, refreshPhotoPreview, uploadPhoto, USE_MOCK } from '../api';
import { ArrowRight, Camera, ChevronRight, Shield, Upload } from '../components/Icon';
import { BackButton, ErrorNote, PrimaryButton, StepBadge } from '../components/ui';
import { C, MONO } from '../theme';
import { OverlayChip } from '../components/ds';
import { useApp } from '../AppContext';


/**
 * Can the browser actually turn these bytes into pixels?
 *
 * Accepting a file is not the same as being able to show it. HEIC is the
 * iPhone default and desktop browsers cannot decode it, yet the upload still
 * reported success with a 0 x 0 preview. naturalWidth is the real test: a
 * failed decode can still fire onload, but never with a size.
 */
function decodesToPixels(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = new Image();
    probe.onload = () => resolve(probe.naturalWidth > 0 && probe.naturalHeight > 0);
    probe.onerror = () => resolve(false);
    probe.src = url;
  });
}

// HEIC is deliberately absent, and that is what makes an iPhone work.
//
// iOS Safari CAN decode HEIC; desktop browsers cannot. But when accept does not
// list HEIC, iOS transcodes the picked photo to JPEG on its way into the input.
// Listing it did the opposite: the picker handed over the raw HEIC, and the app
// then refused it - after the hint and the wrong-type error had both told the
// user HEIC was fine. Leaving it out is what actually accepts an iPhone photo.
const ACCEPTED_TYPES = ['image/jpeg', 'image/png'];
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

export default function PhotoScreen() {
  const nav = useNavigate();
  const { draft, patchDraft } = useApp();
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    const photoKey = draft.photo?.photoKey ?? draft.existingPhotoKey;
    if (!photoKey || draft.photo?.previewUrl || USE_MOCK) return;
    let active = true;
    refreshPhotoPreview(photoKey)
      .then((previewUrl) => {
        if (active && previewUrl) {
          if (draft.photo) patchDraft({ photo: { ...draft.photo, previewUrl } });
          else patchDraft({ existingPhotoUrl: previewUrl });
        }
      })
      .catch(() => {
        if (active) {
          if (!draft.photo && draft.existingPhotoKey) {
            patchDraft({ existingPhotoUrl: null, existingPhotoUnavailable: true });
          } else {
            patchDraft({ photo: null, existingPhotoUrl: null, existingPhotoKey: null });
            setUploadError('That photo preview has expired. Please choose the photo again.');
          }
        }
      });
    return () => {
      active = false;
    };
  }, [draft.photo?.photoKey, draft.existingPhotoKey]);

  async function handleFile(file: File | undefined) {
    if (!file) return;



    // The `|| /\.heic$/` escape hatch that used to be here let a HEIC through
    // this gate so it could fail further along, with a vaguer message. Now it
    // is refused where the reason is clearest, and consistently with the accept
    // attribute and the hint - which is the whole point: one answer about HEIC,
    // not three.
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setUploadError('That file is not a photo we can read. Use JPG or PNG.');
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      const mb = (file.size / 1024 / 1024).toFixed(1);
      setUploadError(`That photo is ${mb} MB. The limit is 10 MB — try a smaller one.`);
      return;
    }
    if (file.size === 0) {
      setUploadError('That photo is empty. Please choose another photo.');
      return;
    }

    setUploading(true);
    setUploadError(null);
    try {
      const photo = await uploadPhoto(file);
      // AC2.2.3 - check the stored photo really opens before we call it added.
      // Nothing else in the flow verified this, so an undecodable file reached
      // the review screen and the submitted report as a blank box.
      const preview = photo.previewUrl || photoPreviewUrl(photo.photoKey);
      if (preview && !(await decodesToPixels(preview))) {
        throw new Error(
          'This browser could not open that photo. HEIC photos often only open on an iPhone — please choose a JPG or PNG.',
        );
      }
      if (!photo.metadataStripped) {
        throw new Error('Location metadata could not be removed. Please choose another photo.');
      }
      patchDraft({ photo, existingPhotoUnavailable: false });
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

      <input
        ref={cameraRef}
        type="file"
        accept="image/jpeg,image/png"
        capture="environment"
        hidden
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <input
        ref={libraryRef}
        type="file"
        accept="image/jpeg,image/png"
        hidden
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      <div
        className="anim-fade-up pt-page measure"
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
            onRetry={() => (uploadError.includes('expired') ? libraryRef.current?.click() : cameraRef.current?.click())}
          />
        )}

        {draft.existingPhotoUnavailable && !photo && (
          <div style={{ background: C.tint, border: `1px solid ${C.line}`, borderRadius: 16, padding: '13px 14px', color: C.slate, fontSize: 12, lineHeight: 1.5 }}>
            <div>Existing photo unavailable. You can keep this report or choose a replacement photo.</div>
            <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
              <button type="button" onClick={() => nav('/report/details')} style={{ color: C.navy, fontWeight: 700, fontSize: 12 }}>
                Keep existing record
              </button>
              <button type="button" onClick={() => libraryRef.current?.click()} style={{ color: C.navy, fontWeight: 700, fontSize: 12 }}>
                Choose replacement photo
              </button>
            </div>
          </div>
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
                <div style={{ fontSize: 12, color: C.dim, marginTop: 3 }}>JPG or PNG · up to 10 MB</div>
              </div>
              <ChevronRight size={14} />
            </button>

          </>
        ) : (
          <>
            <div style={{ position: 'relative', height: 280, borderRadius: 26, overflow: 'hidden', background: '#87847B' }}>
              <img
                src={photo.previewUrl || photoPreviewUrl(photo.photoKey) || undefined}
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
