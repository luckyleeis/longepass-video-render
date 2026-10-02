import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { TemplateProps } from '../../kit/types';
import { useMotionTheme } from '../../kit/theme';
import { useLayout } from '../../kit/layout';
import { ease, enter, riseTransform } from '../../kit/skin';
import { keepAll } from '../../kit/parts';
import { Icon } from '../../kit/media';
import { Figure } from '../../kit/doodle';

/**
 * 그림 비율 (아이소타입). 사람(또는 소품) N개가 줄지어 서고, 그중 K개가 색으로 바뀐다. 오른쪽에 큰 비율 글자.
 * ev.units = 줄 서기 시작, ev.highlight = 색이 바뀌는 순간, ev.big = 큰 글자
 */
const PeopleRatio: React.FC<TemplateProps> = ({ data, ev, ink, sub, surf }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = useMotionTheme();
  const L = useLayout();
  const total = Math.max(2, Math.min(24, Math.round(data.total || 10)));
  const k = Math.max(0, Math.min(total, Math.round(data.highlight || 0)));
  const unit: string = data.unit || 'person';
  const color = data.tone === 'danger' ? t.danger : t.accent;
  const start = ev.units ?? 4, hl = ev.highlight ?? start + 30, bigAt = ev.big ?? hl + 10;
  const perRow = total <= 8 ? total : Math.ceil(total / 2) <= 12 ? Math.ceil(total / 2) : 12;
  const rows = Math.ceil(total / perRow);
  const areaW = L.W * 0.58 - L.padX;
  const cell = Math.min(150, areaW / perRow);
  const unitH = unit === 'person' ? Math.min(240, cell * 1.9) : cell * 0.85;
  const rowH = unitH + 40;
  const top = L.H * 0.52 - (rows * rowH) / 2;
  const step = Math.max(2, Math.min(5, 60 / total));
  const bigP = enter(t, frame, bigAt, fps);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {Array.from({ length: total }).map((_, i) => {
        const r = Math.floor(i / perRow), c = i % perRow;
        const inRow = Math.min(perRow, total - r * perRow);
        const x = L.padX + (areaW - inRow * cell) / 2 + c * cell + cell / 2;
        const y = top + r * rowH;
        const born = enter(t, frame, start + i * step, fps);
        const on = i < k ? ease(frame, hl + i * 3, hl + i * 3 + 10) : 0;
        const col = on > 0.5 ? color : surf.fillStrong;
        return (
          <div key={i} style={{ position: 'absolute', left: x - cell / 2, top: y, width: cell, height: unitH, display: 'flex', justifyContent: 'center',
            opacity: Math.min(1, born * 1.4), transform: `translateY(${(1 - born) * 30}px) scale(${1 + 0.08 * Math.sin(Math.min(1, on) * Math.PI)})` }}>
            {unit === 'person'
              ? <Figure pose={on > 0.5 && data.pose ? data.pose : 'stand'} size={unitH} color={col} draw={born} seed={`u${i}`} paper={surf.card} />
              : <Icon name={unit} size={unitH} color={col} sw={1.6} draw={born} />}
          </div>
        );
      })}
      <div style={{ position: 'absolute', left: L.W * 0.62, right: L.padX, top: L.H * 0.3, bottom: L.H * 0.25, display: 'flex', flexDirection: 'column', justifyContent: 'center', opacity: bigP, transform: riseTransform(t, bigP, 1.5) }}>
        <div style={{ fontSize: String(data.big || '').length > 4 ? 150 : 200, fontWeight: 900, color, lineHeight: 1, letterSpacing: '-0.04em', fontVariantNumeric: 'tabular-nums' }}>{data.big || `${k}/${total}`}</div>
        {data.label && <div style={{ ...keepAll, marginTop: 24, fontSize: 52, fontWeight: 900, color: ink, lineHeight: 1.3 }}>{data.label}</div>}
        {data.sub && <div style={{ ...keepAll, marginTop: 14, fontSize: 34, fontWeight: 700, color: sub, lineHeight: 1.4 }}>{data.sub}</div>}
      </div>
    </div>
  );
};

export default PeopleRatio;
