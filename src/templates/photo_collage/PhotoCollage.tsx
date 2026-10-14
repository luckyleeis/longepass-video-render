import React from 'react';
import { random, useCurrentFrame, useVideoConfig } from 'remotion';
import { TemplateProps } from '../../kit/types';
import { useMotionTheme } from '../../kit/theme';
import { useLayout } from '../../kit/layout';
import { bounce, cardPanel } from '../../kit/skin';
import { Panel } from '../../kit/media';
import { Title, keepAll } from '../../kit/parts';
import { Picture, PictureFallback, assetOf } from '../../kit/picture';

type Photo = { image?: unknown; caption?: string; icon?: string };

/**
 * 사진 2~4장이 인화지(흰 테두리 + 아래 글자)처럼 하나씩 떨어져 흩어진다. 예시·사례·현장 모음.
 * 자료가 없는 칸은 색 면 + 아이콘으로 채운다 (칸마다 색을 바꿔 모음처럼 보이게).
 * data: {title, photos: [{image, caption, icon}]}, ev: {title, photos[]}
 */
const PhotoCollage: React.FC<TemplateProps> = ({ data, ev, dur, ink, surf }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = useMotionTheme();
  const L = useLayout();
  const photos: Photo[] = data.photos || [];
  const n = Math.max(1, photos.length);
  const hasTitle = !!data.title;
  const top = hasTitle ? L.contentTop : Math.round(L.H * 0.14);
  const areaH = L.H - top - Math.round(L.H * 0.16);
  const cardW = Math.min(n <= 2 ? 640 : n === 3 ? 520 : 420, Math.round((L.contentW - (n - 1) * 30) / n));
  const pad = Math.round(cardW * 0.045);
  const imgW = cardW - pad * 2, imgH = Math.round(imgW * 0.78);
  const cardH = imgH + pad + 84;
  const gapX = (L.contentW - n * cardW) / Math.max(1, n - 1);
  const tones = [t.accent, t.accent2, t.primary, t.danger];
  const inks = [t.skin.onAccentInk, t.skin.onColorInk, t.skin.onColorInk, t.skin.onAccentInk];
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <Title text={data.title} at={ev.title ?? 0} ink={ink} />
      {photos.map((ph, i) => {
        const at = (ev.photos || [])[i] ?? 8 + i * 12;
        const p = bounce(t, frame, at, fps, -4);
        const rot = (i % 2 ? 1 : -1) * (2.5 + random(`collage-r${i}`) * 3.5);
        const dy = (i % 2 ? 1 : -1) * Math.min(40, areaH * 0.06);
        const x = L.padX + i * (cardW + (n > 1 ? gapX : 0)) + (n === 1 ? (L.contentW - cardW) / 2 : 0);
        const y = top + (areaH - cardH) / 2 + dy;
        const asset = assetOf(ph.image);
        return (
          <div key={i} style={{ position: 'absolute', left: x, top: y, width: cardW, opacity: Math.min(1, p * 2), transform: `translateY(${(1 - p) * -260}px) rotate(${rot + (1 - p) * rot * 2}deg) scale(${1.15 - 0.15 * p})`, zIndex: i }}>
            <Panel {...cardPanel(t, surf)} radius={Math.min(10, t.skin.radius)} seed={`print${i}`} style={{ padding: pad, paddingBottom: 0, color: surf.cardInk }}>
              <Picture asset={asset} w={imgW} h={imgH} zoom={1 + 0.05 * Math.min(1, Math.max(0, (frame - at) / Math.max(1, dur - at)))} dur={dur}
                fallback={<PictureFallback icon={ph.icon || 'camera'} tone={tones[i % 4]} ink={inks[i % 4]} iconSize={Math.round(imgH * 0.5)} />} />
              <div style={{ ...keepAll, height: 84, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: cardW < 460 ? 34 : 40, fontWeight: 900, color: surf.cardInk, textAlign: 'center' }}>
                {ph.caption || ''}
              </div>
            </Panel>
          </div>
        );
      })}
    </div>
  );
};

export default PhotoCollage;
