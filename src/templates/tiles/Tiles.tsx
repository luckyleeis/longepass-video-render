import React from 'react';
import { random, useCurrentFrame, useVideoConfig } from 'remotion';
import { TemplateProps } from '../../kit/types';
import { useMotionTheme } from '../../kit/theme';
import { bounce, cardPanel, colorPanel, ease } from '../../kit/skin';
import { Panel } from '../../kit/media';

/** 짧은 이름표 타일이 차례로 채워지고, 마지막에 가운데 큰 글자가 덮는다 */
const Tiles: React.FC<TemplateProps> = ({ data, ev, ink, surf }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = useMotionTheme();
  const labels: string[] = data.labels || [];
  const cols = labels.length > 12 ? 6 : 4;
  const tw = 250, th = 118, gap = 16;
  const rows = Math.ceil(labels.length / cols);
  const gridW = cols * tw + (cols - 1) * gap;
  const gridH = rows * th + (rows - 1) * gap;
  const c = bounce(t, frame, ev.center ?? 999, fps, -5);
  const dim = ev.center !== undefined ? ease(frame, ev.center - 2, ev.center + 8) : 0;
  // 화려한 스킨은 여러 색, 차분한 스킨은 흰 카드 사이에 강조색 몇 개
  const palette: Array<string | null> = t.skin.colorful ? [t.primary, t.accent, null, t.accent2] : [t.primary, null, null, null];
  const center = String(data.center || '');
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div style={{ position: 'absolute', left: '50%', top: '50%', width: gridW, height: gridH, transform: 'translate(-50%, -50%)' }}>
        {labels.map((lb, i) => {
          const at = (ev.tiles || [])[i] ?? 0;
          const p = bounce(t, frame, at, fps, -1);
          const col = i % cols, row = Math.floor(i / cols);
          const fill = palette[Math.floor(random(`tile-${i}`) * palette.length)];
          const base = fill ? colorPanel(t, surf, fill) : cardPanel(t, surf);
          return (
            <Panel key={i} {...base} radius={Math.min(18, t.skin.radius)} shadow="none" draw={p} seed={`tile${i}`} style={{ color: fill ? t.skin.onColorInk : surf.cardInk, position: 'absolute', left: col * (tw + gap), top: row * (th + gap), width: tw, height: th, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, fontWeight: 900, transform: `scale(${0.6 + 0.4 * p})`, opacity: Math.min(1, p * 1.5) * (1 - dim * 0.8) }}>
              {lb}
            </Panel>
          );
        })}
      </div>
      {ev.center !== undefined && (
        <div style={{ position: 'absolute', left: '50%', top: '50%', transform: `translate(-50%, -50%) scale(${0.7 + 0.3 * c})`, opacity: Math.min(1, c * 1.5), textAlign: 'center' }}>
          <div style={{ fontSize: (center.length <= 2 ? 360 : center.length === 3 ? 250 : 190), fontWeight: 900, color: ink, lineHeight: 0.95, letterSpacing: '-0.04em', whiteSpace: 'nowrap', textShadow: t.skin.shadow === 'offset' ? `0 12px 0 ${surf.shade || surf.sub}` : 'none' }}>{data.center}</div>
          {data.center_sub && <Panel fill={ink} radius={999} seed="center-sub" fillStyle="solid" style={{ display: 'inline-block', marginTop: 10, padding: '10px 36px', color: surf.bg, fontSize: 64, fontWeight: 900 }}>{data.center_sub}</Panel>}
        </div>
      )}
    </div>
  );
};

export default Tiles;
