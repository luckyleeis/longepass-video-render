import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { TemplateProps } from '../../kit/types';
import { useMotionTheme } from '../../kit/theme';
import { useLayout } from '../../kit/layout';
import { cardPanel, ease, enter, riseTransform } from '../../kit/skin';
import { Bar, Dot, Panel } from '../../kit/media';
import { Title, keepAll, strongLine } from '../../kit/parts';

/** 단계. data: {title, steps: [{title, sub}]}, ev: {title, steps[]} */
const Steps: React.FC<TemplateProps> = ({ data, ev, ink, surf }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = useMotionTheme();
  const L = useLayout();
  const steps: Array<{ title: string; sub?: string }> = data.steps || [];
  const n = Math.max(1, steps.length);
  const at = (i: number) => (ev.steps || [])[i] ?? 10 + i * 20;
  // 진행선은 구간마다: i번째 점 → i+1번째 점을 그 단계가 나타나기 직전에 채운다 (다음 단계보다 먼저 가지 않게)
  let line = 0;
  for (let i = 1; i < n; i++) line += ease(frame, Math.max(at(i - 1), at(i) - 14), at(i));
  line /= Math.max(1, n - 1);
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <Title text={data.title} at={ev.title ?? 0} ink={ink} />
      <div style={{ position: 'absolute', top: 330, left: L.padX, right: L.padX, display: 'flex', gap: 30 }}>
        <Bar color={surf.line} radius={4} seed="track" style={{ position: 'absolute', top: 54, left: `${50 / n}%`, width: `${100 - 100 / n}%`, height: 8 }} />
        <Bar color={strongLine(t, surf)} radius={4} seed="progress" style={{ position: 'absolute', top: 54, left: `${50 / n}%`, width: `${(100 - 100 / n) * line}%`, height: 8 }} />
        {steps.map((st, i) => {
          const p = enter(t, frame, at(i), fps);
          const on = frame >= at(i);
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', opacity: 0.25 + 0.75 * p }}>
              <Dot size={116} fill={on ? t.primary : surf.card} stroke={cardPanel(t, surf).stroke} sw={t.skin.cardBorder} seed={`step${i}`} draw={p} style={{ fontSize: 54, fontWeight: 900, color: on ? t.skin.onColorInk : surf.cardInk, zIndex: 1, transform: `scale(${0.85 + 0.15 * p})` }}>{i + 1}</Dot>
              <Panel {...cardPanel(t, surf)} draw={p} seed={`stepcard${i}`} style={{ color: surf.cardInk, marginTop: 30, padding: '26px 20px', width: '100%', transform: riseTransform(t, p) }}>
                <div style={{ ...keepAll, fontSize: 50, fontWeight: 900, color: surf.cardInk }}>{st.title}</div>
                {st.sub && <div style={{ ...keepAll, fontSize: 32, fontWeight: 700, color: surf.cardInk, opacity: 0.6, marginTop: 10, lineHeight: 1.4 }}>{st.sub}</div>}
              </Panel>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Steps;
