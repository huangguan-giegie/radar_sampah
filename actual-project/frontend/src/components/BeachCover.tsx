import type { CSSProperties, ReactNode } from 'react';


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
