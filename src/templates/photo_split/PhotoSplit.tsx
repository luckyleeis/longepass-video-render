import React from 'react';
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { TemplateProps } from '../../kit/types';
import { useMotionTheme } from '../../kit/theme';
import { useLayout } from '../../kit/layout';
import { ease, enter, riseTransform } from '../../kit/skin';
import { Bar, Dot, Panel } from '../../kit/media';
import { HighlightedText, keepAll } from '../../kit/parts';
import { Credit, Picture, PictureFallback, assetOf } from '../../kit/picture';

/**
 * 화면 반은 사진(끝까지 채움), 반은 글자. 사진이 열리듯 밀려 나오고, 제목과 요점이 차례로 뜬다.
 * 자료가 없으면 강조색 면 + 큰 아이콘.
 * data: {image, side: left|right(사진 쪽), title, highlight, points[], caption, icon}, ev: {image, title, points[]}
 */
const PhotoSplit: React.FC<TemplateProps> = ({ data, ev, dur, ink, sub, surf }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = useMotionTheme();
  const L = useLayout();
  const asset = assetOf(data.image);
  const left = (data.side || 'left') === 'left';
  const points: string[] = data.points || [];
  const imgW = Math.round(L.W * 0.48);
  const open = ease(frame, ev.image ?? 0, (ev.image ?? 0) + 16);
  const zoom = interpolate(frame, [0, Math.max(1, dur)], [1.02, 1.1]);
  const tp = enter(t, frame, ev.title ?? 6, fps);
  const textX = left ? imgW + Math.round(L.padX * 0.6) : L.padX;
  const textW = L.W - imgW - L.padX - Math.round(L.padX * 0.6);
  const title: string = data.title || '';
  const tSize = Math.min(96, Math.floor(textW / Math.max(4, title.length) / 0.98));
  const pSize = points.length >= 4 ? 40 : 46;
  const capP = ease(frame, (ev.image ?? 0) + 12, (ev.image ?? 0) + 24);
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div style={{ position: 'absolute', top: 0, bottom: 0, [left ? 'left' : 'right']: 0, width: imgW, overflow: 'hidden', clipPath: left ? `inset(0 ${(1 - open) * 100}% 0 0)` : `inset(0 0 0 ${(1 - open) * 100}%)` }}>
        <Picture asset={asset} w={imgW} h={L.H} zoom={zoom} dur={dur}
          fallback={<PictureFallback icon={data.icon || 'camera'} tone={t.accent} iconSize={300} />} />
        {data.caption && (
          <div style={{ position: 'absolute', left: 36, bottom: 56, opacity: capP, transform: riseTransform(t, capP, 0.4) }}>
            <Panel fill={t.primary} radius={10} seed="split-caption" style={{ ...keepAll, padding: '8px 20px', color: t.skin.onColorInk, fontSize: 32, fontWeight: 900 }}>{data.caption}</Panel>
          </div>
        )}
        <Credit asset={asset} align={left ? 'left' : 'right'} bottom={data.caption ? 130 : 50} inset={36} />
      </div>
      <Bar color={t.primary} vertical style={{ position: 'absolute', top: 0, bottom: 0, [left ? 'left' : 'right']: imgW - 6, width: 12, transform: `scaleY(${open})` }} />
      <div style={{ position: 'absolute', left: textX, width: textW, top: 0, bottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 34 }}>
        <div style={{ ...keepAll, fontSize: tSize, fontWeight: 900, lineHeight: 1.15, letterSpacing: '-0.03em', color: ink, opacity: tp, transform: riseTransform(t, tp, 0.8) }}>
          <HighlightedText text={title} highlight={data.highlight} size={tSize} surf={surf} ink={ink} progress={ease(frame, (ev.title ?? 6) + 4, (ev.title ?? 6) + 16)} />
        </div>
        {points.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {points.map((pt, i) => {
              const at = (ev.points || [])[i] ?? (ev.title ?? 6) + 12 + i * 10;
              const p = enter(t, frame, at, fps);
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 22, opacity: p, transform: riseTransform(t, p, 1, 'x') }}>
                  <Dot size={22} fill={t.primary} stroke={t.skin.cardBorderColor === 'ink' ? ink : null} sw={3} seed={`split-dot${i}`} style={{ flexShrink: 0 }} />
                  <div style={{ ...keepAll, fontSize: pSize, fontWeight: 800, color: ink, lineHeight: 1.3 }}>{pt}</div>
                </div>
              );
            })}
          </div>
        )}
        {data.note && <div style={{ ...keepAll, fontSize: 32, fontWeight: 700, color: sub, opacity: ease(frame, (ev.title ?? 6) + 10, (ev.title ?? 6) + 22) }}>{data.note}</div>}
      </div>
    </div>
  );
};

export default PhotoSplit;
