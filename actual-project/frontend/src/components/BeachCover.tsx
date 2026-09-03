import type { CSSProperties, ReactNode } from 'react';

/**
 * A beach cover image, with a gradient behind it.
 *
 * If the backend sent a photo we show it; if not, the gradient it also sent is
 * what the user sees. The gradient is not decoration - it is what stops a
 * newly added beach, which has no photo yet, from leaving a hole in the page.
 *
 * The gradient stays underneath even when there IS a photo, so a slow or
 * broken image never flashes an empty grey box.
 */
export function BeachCover({
  coverImageUrl,
  scene,
  alt = '',
  style,
  children,
}: {
  coverImageUrl: string | null;
  scene: string;
  alt?: string;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  return (
    <div style={{ position: 'relative', background: scene, overflow: 'hidden', ...style }}>
      {/* loading="lazy": several of these can be off screen in the reports
          list, and a volunteer on beach mobile data should not pay for photos
          they never scroll to. */}
      {coverImageUrl && (
        <img
          src={coverImageUrl}
          alt={alt}
          loading="lazy"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
      )}
      {children}
    </div>
  );
}
