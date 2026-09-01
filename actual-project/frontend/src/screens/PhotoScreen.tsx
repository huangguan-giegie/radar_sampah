// Step 1 of the report: the photo.
//
// The photo comes FIRST, before the location and before the categories. Two
// reasons. It is the evidence - a report without one cannot be checked by
// anybody - and it is the thing the volunteer is standing in front of right
// now. Asking for it last would mean asking them to walk back.
//
// Nothing here identifies the litter automatically. The user says what it is
// on the next screen, and the screen says so out loud: we do not want a wrong
// machine guess recorded as if a person had confirmed it.
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { photoPreviewUrl, refreshPhotoPreview, uploadPhoto, USE_MOCK } from '../api';
import { ArrowRight, Camera, ChevronRight, Shield, Upload } from '../components/Icon';
import { BackButton, ErrorNote, PrimaryButton, StepBadge } from '../components/ui';
import { C, MONO } from '../theme';
import { OverlayChip } from '../components/ds';
import { useApp } from '../AppContext';


// Matches API.md section 5: 10 MB or less, and only these three formats.
// HEIC is iPhone's default. Some browsers hand us an empty MIME type for it,
// so the check below also accepts the .heic file extension - otherwise iPhone
// users, who are most of our users, would be turned away.
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/heic'];
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

export default function PhotoScreen() {
  const nav = useNavigate();
  const { draft, patchDraft } = useApp();
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Preview links from the real backend do not last forever. A draft picked up
  // again later still has the photo key but its picture link is dead, so ask
  // the backend for a fresh one. If even that fails the photo is gone for
  // good: clear it from the draft and say so, because a blank grey box with no
  // words reads as a bug. The mock keeps photos in memory and its links never
  // expire, so there is nothing to refresh there.
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
          patchDraft({ photo: null, existingPhotoUrl: null, existingPhotoKey: null });
          setUploadError('That photo preview has expired. Please choose the photo again.');
        }
      });
    return () => {
      active = false;
    };
  }, [draft.photo?.photoKey, draft.existingPhotoKey]);

  // Three checks before we upload anything. The accept="..." attribute is only
  // a hint to the file picker: the user can switch it to "All files" and pick a
  // PDF, so it stops nothing.
  //
  // In the contract the backend enforces type and size (API.md section 5), but
  // with the mock running that defence does not exist yet. So we check here as
  // well, and report every failure through the same red panel - one error
  // style, not two. The zero-byte case is worth its own check: an empty file
  // uploads without complaint and only shows up later as a broken picture.
  async function handleFile(file: File | undefined) {
    if (!file) return;



    if (!ACCEPTED_TYPES.includes(file.type) && !/\.heic$/i.test(file.name)) {
      setUploadError('That file is not a photo we can read. Use JPG, PNG or HEIC.');
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
      // Refuse the photo if the location metadata is still in it. Every photo
      // from a phone carries the exact spot it was taken; publishing that
      // would break the promise made two screens earlier. We would rather
      // reject a photo than quietly upload someone's coordinates.
      if (!photo.metadataStripped) {
        throw new Error('Location metadata could not be removed. Please choose another photo.');
      }
      patchDraft({ photo });
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Please try again.');
      // Clear the photo as well as showing the error. Leaving a half-failed
      // upload in the draft would let the user press Continue and submit a
      // report pointing at a photo that was never stored.
      patchDraft({ photo: null });
    } finally {
      setUploading(false);
    }
  }

  const photo = draft.photo;

  // Two hidden file inputs below, one visible pair of buttons.
  // capture="environment" on the first opens the back camera straight away on
  // a phone; on a laptop, where there is no such camera, the browser ignores it
  // and shows the normal file picker. That single attribute is how one code
  // path serves both, with no device sniffing and no separate mobile build.
  return (
    <div className="screen scroll-y" style={{ zIndex: 26 }}>

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
          // Retry reopens whichever picker fits the failure. An expired preview
          // means the photo is already in their library, so send them there;
          // anything else is a fresh attempt, so open the camera.
          <ErrorNote
            title="Photo upload failed"
            body={uploadError}
            onRetry={() => (uploadError.includes('expired') ? libraryRef.current?.click() : cameraRef.current?.click())}
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
                /* previewUrl first, then look the key up. After a refresh the
                   preview is gone - we strip it before saving the draft, see
                   AppContext - so the second source is what brings the picture
                   back instead of showing a broken image. */
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
                // Tell the user we removed the location from their photo. A
                // privacy step nobody can see is one nobody can trust.
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
