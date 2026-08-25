import type { CSSProperties, ReactNode } from 'react';

/**
 * 海滩封面。后端给了 coverImageUrl 就用真图，没给就退回设计稿的 CSS 渐变占位。
 * 渐变留着不是装饰 —— 是为了新海滩还没配图时页面不开天窗。
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
