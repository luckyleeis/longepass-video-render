import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { TemplateProps } from '../../kit/types';
import { useMotionTheme } from '../../kit/theme';
import { useLayout } from '../../kit/layout';
import { cardPanel, colorPanel, enter, riseTransform } from '../../kit/skin';
import { Dot, Panel } from '../../kit/media';
import { Title, keepAll } from '../../kit/parts';

/** 비교. data: {title, left: {label, points, value}, right: {...}, verdict}, ev: {title, left, right, verdict} */
const Compare: React.FC<TemplateProps> = ({ data, ev, ink, surf }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = useMotionTheme();
  const L = useLayout();
  const sides = [data.left || {}, data.right || {}];
  const colors = [t.accent2, t.primary];
  const vs = enter(t, frame, ev.right ?? 20, fps);
  const verdict = enter(t, frame, ev.verdict ?? 999, fps);
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <Title text={data.title} at={ev.title ?? 0} ink={ink} />
      <div style={{ position: 'absolute', top: L.contentTop, left: L.padX, right: L.padX, display: 'flex', gap: 80, alignItems: 'stretch' }}>
        {sides.map((sd: any, i: number) => {
          const p = enter(t, frame, i === 0 ? ev.left ?? 8 : ev.right ?? 20, fps);
          // 화려한 스킨: 색 면 카드 / 차분한 스킨: 흰 카드 + 위쪽 색 띠
          const box = t.skin.colorful
            ? colorPanel(t, surf, colors[i])
            : { ...cardPanel(t, surf), edge: { side: 'top' as const, color: colors[i], width: 14 } };
          const txt = t.skin.colorful ? t.skin.onColorInk : surf.cardInk;
          return (
            <Panel key={i} {...box} draw={p} seed={`side${i}`} style={{ color: txt, flex: 1, padding: '36px 40px', opacity: p, transform: `${riseTransform(t, p, 2)} rotate(${(i ? 1 : -1) * (1 - p) * t.skin.motion.tilt * 0.6}deg)` }}>
              <div style={{ ...keepAll, fontSize: 60, fontWeight: 900, color: txt }}>{sd.label}</div>
              {sd.value && <div style={{ fontSize: 96, fontWeight: 900, color: txt, letterSpacing: '-0.03em', marginTop: 6 }}>{sd.value}</div>}
              {(sd.points || []).map((pt: string, j: number) => (
                <div key={j} style={{ ...keepAll, fontSize: 38, fontWeight: 800, color: txt, opacity: t.skin.colorful ? 1 : 0.8, marginTop: 16 }}>• {pt}</div>
              ))}
            </Panel>
          );
        })}
        <Dot size={120} fill={ink} stroke={t.primary} sw={5} seed="vs" style={{ position: 'absolute', left: '50%', top: 150, transform: `translate(-50%, -50%) scale(${vs}) rotate(${-t.skin.motion.tilt}deg)`, color: surf.bg, fontSize: 52, fontWeight: 900 }}>VS</Dot>
      </div>
      {data.verdict && (
        <div style={{ position: 'absolute', left: 0, right: 0, top: 720, textAlign: 'center', opacity: verdict, transform: `scale(${0.94 + 0.06 * verdict})` }}>
          <Panel fill={ink} radius={999} seed="verdict" fillStyle="solid" style={{ ...keepAll, display: 'inline-block', padding: '16px 40px', color: surf.bg, fontSize: 50, fontWeight: 900 }}>{data.verdict}</Panel>
        </div>
      )}
    </div>
  );
};

export default Compare;
