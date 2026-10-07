import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { TemplateProps } from '../../kit/types';
import { useMotionTheme } from '../../kit/theme';
import { useLayout } from '../../kit/layout';
import { ease, enter, riseTransform } from '../../kit/skin';
import { Bar, Dot, Icon } from '../../kit/media';
import { Title, keepAll, strongLine } from '../../kit/parts';

/**
 * 시간 흐름 (기한·일정). 축 위에 시점들이 하나씩 찍히고 진행선이 따라간다. deadline 시점은 빨간 깃발.
 * 가로 무대는 가로 축, 좁은 무대(세로 쇼츠)는 세로 축.
 * data: {title, points: [{when, label, sub}], deadline(1부터)}, ev: {title, points[], deadline}
 */
const Timeline: React.FC<TemplateProps> = ({ data, ev, ink, sub, surf }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = useMotionTheme();
  const L = useLayout();
  const points: Array<{ when: string; label: string; sub?: string }> = data.points || [];
  const n = Math.max(1, points.length);
  const dl = Number(data.deadline) > 0 ? Math.min(Number(data.deadline), n) - 1 : -1;
  const vertical = L.W < 1500;
  const at = (i: number) => (ev.points || [])[i] ?? 10 + i * 18;
  // 진행선: 구간마다 다음 시점이 나타나기 직전에 채운다
  let prog = 0;
  for (let i = 1; i < n; i++) prog += ease(frame, Math.max(at(i - 1), at(i) - 12), at(i));
  prog /= Math.max(1, n - 1);
  const dlAt = ev.deadline ?? 9999;
  const dlP = enter(t, frame, dlAt, fps);
  const line = strongLine(t, surf);
  const dotColor = (i: number, on: boolean) => (i === dl && frame >= dlAt ? t.danger : on ? line : surf.card);

  if (vertical) {
    // 시점 i 의 원 중심 = (x, top + gap*i). 막대도 첫 원 중심 ~ 마지막 원 중심.
    // 원은 제목(label) 줄과 한 줄로 묶어 그 줄 가운데를 y 에 두고, when 은 그 위·sub 는 그 아래에 붙인다
    // (글자 줄 높이나 sub 유무와 상관없이 원이 막대 위에 온다)
    const top = L.contentTop + 80, bottom = L.H - 120;
    const gap = n > 1 ? (bottom - top) / (n - 1) : 0;
    const x = L.padX + 50;
    const textW = L.W - L.padX - (x + 64);
    return (
      <div style={{ position: 'absolute', inset: 0 }}>
        <Title text={data.title} at={ev.title ?? 0} ink={ink} />
        <Bar vertical color={surf.line} radius={5} seed="tl-track" style={{ position: 'absolute', left: x - 5, top, width: 10, height: bottom - top }} />
        <Bar vertical color={line} radius={5} seed="tl-prog" style={{ position: 'absolute', left: x - 5, top, width: 10, height: (bottom - top) * prog }} />
        {points.map((pt, i) => {
          const p = enter(t, frame, at(i), fps);
          const y = top + gap * i;
          return (
            <div key={i} style={{ position: 'absolute', left: x - 30, top: y, right: L.padX, transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: 34, opacity: 0.3 + 0.7 * p }}>
              <Dot size={60} fill={dotColor(i, frame >= at(i))} stroke={line} sw={5} seed={`tl-dot${i}`} style={{ flexShrink: 0, transform: `scale(${0.8 + 0.2 * p})` }} />
              <div style={{ position: 'relative', transform: riseTransform(t, p, 0.8, 'x') }}>
                <div style={{ ...keepAll, position: 'absolute', left: 0, bottom: '100%', width: 'max-content', maxWidth: textW, fontSize: 40, fontWeight: 900, color: i === dl && frame >= dlAt ? t.danger : t.primary }}>
                  {pt.when}{i === dl && <span style={{ display: 'inline-block', marginLeft: 14, verticalAlign: 'middle', opacity: dlP, transform: `scale(${0.6 + 0.4 * dlP})` }}><Icon name="flag" size={40} color={t.danger} sw={2.4} /></span>}
                </div>
                <div style={{ ...keepAll, fontSize: 48, fontWeight: 900, color: ink }}>{pt.label}</div>
                {pt.sub && <div style={{ ...keepAll, position: 'absolute', left: 0, top: '100%', width: 'max-content', maxWidth: textW, fontSize: 30, fontWeight: 700, color: sub }}>{pt.sub}</div>}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  const y = Math.round(L.H * 0.52);
  const left = L.padX + 80, right = L.W - L.padX - 80;
  const step = n > 1 ? (right - left) / (n - 1) : 0;
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <Title text={data.title} at={ev.title ?? 0} ink={ink} />
      <Bar color={surf.line} radius={5} seed="tl-track" style={{ position: 'absolute', left, top: y - 5, width: right - left, height: 10 }} />
      <Bar color={line} radius={5} seed="tl-prog" style={{ position: 'absolute', left, top: y - 5, width: (right - left) * prog, height: 10 }} />
      {points.map((pt, i) => {
        const p = enter(t, frame, at(i), fps);
        const x = left + step * i;
        const w = Math.min(380, step || 380);
        return (
          <React.Fragment key={i}>
            <div style={{ position: 'absolute', left: x - w / 2, width: w, bottom: L.H - y + 50, textAlign: 'center', opacity: p, transform: riseTransform(t, p, 0.8) }}>
              {i === dl && <div style={{ opacity: dlP, transform: `scale(${0.6 + 0.4 * dlP})`, marginBottom: 6 }}><Icon name="flag" size={56} color={t.danger} sw={2.4} /></div>}
              <div style={{ ...keepAll, fontSize: 46, fontWeight: 900, color: i === dl && frame >= dlAt ? t.danger : t.primary }}>{pt.when}</div>
            </div>
            <div style={{ position: 'absolute', left: x - 34, top: y - 34 }}>
              <Dot size={68} fill={dotColor(i, frame >= at(i))} stroke={line} sw={5} seed={`tl-dot${i}`} style={{ transform: `scale(${0.75 + 0.25 * p})` }} />
            </div>
            <div style={{ position: 'absolute', left: x - w / 2, width: w, top: y + 60, textAlign: 'center', opacity: 0.25 + 0.75 * p, transform: riseTransform(t, p, 0.8) }}>
              <div style={{ ...keepAll, fontSize: 50, fontWeight: 900, color: ink }}>{pt.label}</div>
              {pt.sub && <div style={{ ...keepAll, fontSize: 32, fontWeight: 700, color: sub, marginTop: 6 }}>{pt.sub}</div>}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default Timeline;
