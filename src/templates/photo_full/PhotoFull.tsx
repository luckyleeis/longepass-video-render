import React from 'react';
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { TemplateProps } from '../../kit/types';
import { useMotionTheme } from '../../kit/theme';
import { useLayout } from '../../kit/layout';
import { ease, enter, highlightInk, highlightStyle, riseTransform } from '../../kit/skin';
import { Mark, Panel } from '../../kit/media';
import { keepAll, tokenize } from '../../kit/parts';
import { kineticSize } from '../../kit/kinetic';
import { Credit, Picture, PictureFallback, Scrim, assetOf, useOverlaySurface } from '../../kit/picture';

/**
 * 화면 전체를 채운 사진/영상 + 큰 글자. 카드 없이 화면 끝까지 (다른 템플릿과 화면 문법이 다르다).
 * 사진은 장면 내내 천천히 다가가고(켄 번스), 글자는 어두운 그라데이션 위에 얹는다.
 * 자료가 없으면 진한 색 면 + 큰 선 아이콘 (data.icon).
 * data: {image, kicker, lines[], highlight, place: left|bottom|center, icon}, ev: {image, kicker, lines[]}
 */
const PhotoFull: React.FC<TemplateProps> = ({ data, ev, dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = useMotionTheme();
  const L = useLayout();
  const os = useOverlaySurface();
  const asset = assetOf(data.image);
  const place: 'left' | 'bottom' | 'center' = data.place || 'left';
  const lines: string[] = data.lines || [];
  const at: number[] = ev.lines || [];
  const imgIn = enter(t, frame, ev.image ?? 0, fps, 6);
  const zoom = interpolate(frame, [0, Math.max(1, dur)], [1.04, 1.14]);
  const size = Math.min(kineticSize(lines, place === 'bottom' ? 130 : 150), Math.floor((place === 'center' ? L.W * 0.86 : L.W * 0.62) / Math.max(1, ...lines.map((x) => x.length)) / 0.97));
  const blockH = lines.length * size * 1.12;
  const kickP = enter(t, frame, ev.kicker ?? 0, fps);
  const align = place === 'center' ? 'center' : 'flex-start';
  // 알약 강조는 밝은 강조색 면이라 그 위 글자는 진한 색 (형광펜은 kit 규칙대로)
  const hlInk = t.skin.highlight === 'pill' ? t.skin.onColorInk : highlightInk(t, os, os.ink);
  const text = (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: align }}>
      {data.kicker && (
        <Panel fill={t.primary} radius={10} seed="photo-kicker" style={{ ...keepAll, display: 'inline-block', padding: '8px 22px', marginBottom: size * 0.3, color: t.skin.onColorInk, fontSize: Math.max(32, Math.round(size * 0.3)), fontWeight: 900, opacity: kickP, transform: riseTransform(t, kickP, 0.5) }}>
          {data.kicker}
        </Panel>
      )}
      {lines.map((line, li) => {
        const lineAt = at[li] ?? (at[0] ?? 6) + li * 8;
        const p = enter(t, frame, lineAt, fps);
        return (
          <div key={li} style={{ display: 'flex', alignItems: 'baseline', lineHeight: 1.12, opacity: Math.min(1, p * 1.4), transform: riseTransform(t, p, size / 150) }}>
            {tokenize(line, data.highlight).map((tok, ti) => (
              <span key={ti} style={{ position: 'relative', display: 'inline-block', whiteSpace: 'pre' }}>
                {tok.hl && <Mark style={highlightStyle(t, os, ease(frame, lineAt + 3, lineAt + 14), size)} seed={`photo-hl${li}`} />}
                <span style={{ position: 'relative', zIndex: 1, fontSize: size, fontWeight: 900, letterSpacing: '-0.03em', color: tok.hl ? hlInk : os.ink }}>{tok.t}</span>
              </span>
            ))}
          </div>
        );
      })}
    </div>
  );
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div style={{ position: 'absolute', inset: 0, opacity: Math.min(1, imgIn * 1.5) }}>
        <Picture asset={asset} w="100%" h="100%" zoom={zoom * (1.06 - 0.06 * imgIn)} dur={dur}
          fallback={<PictureFallback icon={data.icon || 'camera'} tone={t.surfaces.deep?.bg || t.accent} ink={t.surfaces.deep?.ink} iconSize={520} place={place === 'left' ? 'right' : 'center'} />} />
        {asset && <Scrim side={place === 'center' ? 'all' : place === 'left' ? 'left' : 'bottom'} />}
      </div>
      {place === 'bottom' ? (
        <div style={{ position: 'absolute', left: L.padX, right: L.padX, bottom: Math.round(L.H * 0.2) }}>{text}</div>
      ) : (
        <div style={{ position: 'absolute', left: place === 'center' ? 0 : L.padX, right: place === 'center' ? 0 : undefined, top: Math.round(L.H / 2 - blockH / 2 - (data.kicker ? size * 0.55 : 0)), display: 'flex', justifyContent: place === 'center' ? 'center' : 'flex-start' }}>{text}</div>
      )}
      <Credit asset={asset} />
    </div>
  );
};

export default PhotoFull;
