import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { TemplateProps } from '../../kit/types';
import { useMotionTheme } from '../../kit/theme';
import { cardPanel, enter, riseTransform } from '../../kit/skin';
import { Panel, PanelProps } from '../../kit/media';
import { keepAll } from '../../kit/parts';

/** 주의/팁 박스. data: {tone: warning|tip|info, title, body, big}, ev: {in, big} */
const Callout: React.FC<TemplateProps> = ({ data, ev, surf }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = useMotionTheme();
  const color = data.tone === 'warning' ? t.danger : data.tone === 'tip' ? t.accent2 : t.accent;
  const icon = data.tone === 'warning' ? '!' : data.tone === 'tip' ? '★' : 'i';
  const p = enter(t, frame, ev.in ?? 0, fps);
  const b = enter(t, frame, ev.big ?? 999, fps);
  const inkBorder = t.skin.cardBorderColor === 'ink';
  // 굵은 테두리 스킨: 색 그림자 / 차분한 스킨: 왼쪽 색 띠
  const box: PanelProps = inkBorder
    ? { ...cardPanel(t, surf), radius: 40, shadow: `16px 16px 0 ${color}` }
    : { ...cardPanel(t, surf), edge: { side: 'left', color, width: 16 } };
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Panel {...box} draw={p} seed="callout" style={{ color: surf.cardInk, width: 1400, padding: '56px 64px', opacity: p, transform: `${riseTransform(t, p, 1.6)}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          <Panel fill={color} radius={24} stroke={inkBorder ? surf.ink : null} sw={5} seed="callout-icon" style={{ width: 92, height: 92, color: data.tone === 'tip' || inkBorder ? t.skin.onColorInk : t.skin.onAccentInk, fontSize: 60, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</Panel>
          <div style={{ ...keepAll, fontSize: 70, fontWeight: 900, color: surf.cardInk }}>{data.title}</div>
        </div>
        {data.big && (
          <div style={{ fontSize: 170, fontWeight: 900, color: color, letterSpacing: '-0.04em', margin: '20px 0 0', WebkitTextStroke: inkBorder ? `4px ${surf.ink}` : undefined, transform: `scale(${0.85 + 0.15 * b})`, transformOrigin: 'left center', opacity: b }}>{data.big}</div>
        )}
        <div style={{ ...keepAll, fontSize: 46, fontWeight: 800, color: surf.cardInk, opacity: 0.8, marginTop: 20, lineHeight: 1.45 }}>{data.body}</div>
      </Panel>
    </div>
  );
};

export default Callout;
