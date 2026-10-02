import React from 'react';
import { Easing, interpolate, useCurrentFrame } from 'remotion';
import { TemplateProps } from '../../kit/types';
import { useMotionTheme } from '../../kit/theme';
import { useLayout } from '../../kit/layout';
import { Title, fmt } from '../../kit/parts';
import { Bar, Panel } from '../../kit/media';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** 가로 막대 차트. data: {title, unit, items: [{label, value, note}], highlight}, ev: {title, bars[]} */
const BarChart: React.FC<TemplateProps> = ({ data, ev, ink, surf }) => {
  const frame = useCurrentFrame();
  const t = useMotionTheme();
  const L = useLayout();
  const items: Array<{ label: string; value: number; note?: string }> = data.items || [];
  const max = Math.max(1, ...items.map((x) => Number(x.value) || 0));
  const rowH = Math.min(96, 560 / Math.max(1, items.length));
  const inkBorder = t.skin.cardBorderColor === 'ink';
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <Title text={data.title} at={ev.title ?? 0} ink={ink} />
      <div style={{ position: 'absolute', top: 280, left: L.padX, right: L.padX, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {items.map((it, i) => {
          const at = (ev.bars || [])[i] ?? 10 + i * 8;
          const p = interpolate(frame, [at, at + 26], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
          const hl = data.highlight === i;
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 26, height: rowH, opacity: Math.min(1, p * 4) }}>
              <div style={{ width: 230, textAlign: 'right', fontSize: Math.min(48, rowH * 0.55), fontWeight: 900, color: ink }}>{it.label}</div>
              <div style={{ flex: 1, height: rowH * 0.66 }}>
                <Bar color={hl ? t.primary : inkBorder ? `${ink}26` : surf.fill} radius={Math.min(14, t.skin.radius)} outline={inkBorder ? ink : null} sw={4} seed={`bar${i}`} style={{ width: `${((Number(it.value) || 0) / max) * 100 * p}%`, height: '100%' }} />
              </div>
              <div style={{ width: 360, fontSize: Math.min(48, rowH * 0.55), fontWeight: 900, color: ink, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                {fmt((Number(it.value) || 0) * p)}<span style={{ fontSize: '0.6em', marginLeft: 6, opacity: 0.6 }}>{data.unit}</span>
                {it.note && <Panel fill={t.danger} radius={999} seed={`note${i}`} fillStyle="solid" style={{ display: 'inline-block', fontSize: '0.55em', marginLeft: 12, padding: '4px 12px', color: t.skin.onAccentInk }}>{it.note}</Panel>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BarChart;
