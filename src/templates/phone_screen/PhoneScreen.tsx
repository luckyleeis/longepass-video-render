import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { TemplateProps } from '../../kit/types';
import { useMotionTheme } from '../../kit/theme';
import { useLayout } from '../../kit/layout';
import { cardPanel, ease, enter, riseTransform } from '../../kit/skin';
import { Bar, Dot, Icon, Panel } from '../../kit/media';
import { keepAll } from '../../kit/parts';

/**
 * 휴대폰 화면 목업. 왼쪽(좁은 무대에서는 위)에 제목·설명, 오른쪽에 휴대폰: 앱 머리줄 + 화면 제목 + 줄들이 하나씩, tap 줄을 손가락으로 누른다.
 * 온라인 신청 절차, 앱으로 하는 일 (문제 풀기, 오답 노트 …)을 보여줄 때.
 * data: {title, caption, screen_title, rows: [{text}], tap(1부터)}, ev: {title, rows[], tap}
 */
const PhoneScreen: React.FC<TemplateProps> = ({ data, ev, ink, sub, surf }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = useMotionTheme();
  const L = useLayout();
  const rows: Array<{ text: string }> = data.rows || [];
  const tap = Number(data.tap) > 0 ? Math.min(Number(data.tap), rows.length) - 1 : -1;
  const narrow = L.W < 1500;
  const phoneH = narrow ? 820 : 780;
  const phoneW = phoneH * 0.52;
  const phoneP = enter(t, frame, (ev.rows || [])[0] !== undefined ? Math.max(0, (ev.rows || [])[0] - 10) : 4, fps);
  const titleP = enter(t, frame, ev.title ?? 0, fps);
  const tapAt = ev.tap ?? 9999;
  const tapP = ease(frame, tapAt, tapAt + 8);
  const ripple = ease(frame, tapAt, tapAt + 16);
  const textW = narrow ? L.W - L.padX * 2 - phoneW - 60 : L.W * 0.5 - L.padX;
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {/* 제목·설명 */}
      <div style={{ position: 'absolute', left: L.padX, top: 0, bottom: 0, width: textW, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 26,
        opacity: titleP, transform: riseTransform(t, titleP, 1, 'x') }}>
        <Bar color={t.primary} radius={6} seed="phone-bar" style={{ width: 90, height: 12 }} />
        <div style={{ ...keepAll, fontSize: narrow ? 66 : 82, fontWeight: 900, color: ink, lineHeight: 1.2, letterSpacing: '-0.02em' }}>{data.title}</div>
        {data.caption && <div style={{ ...keepAll, fontSize: narrow ? 36 : 42, fontWeight: 700, color: sub, lineHeight: 1.45, opacity: ease(frame, (ev.title ?? 0) + 8, (ev.title ?? 0) + 20) }}>{data.caption}</div>}
      </div>
      {/* 휴대폰 */}
      <div style={{ position: 'absolute', right: narrow ? L.padX : L.W * 0.12, top: (L.H - phoneH) / 2 - (narrow ? 0 : 30), width: phoneW, height: phoneH,
        opacity: phoneP, transform: `translateY(${(1 - phoneP) * 80}px) rotate(${(1 - phoneP) * 4}deg)` }}>
        <Panel fill={surf.ink} radius={phoneW * 0.14} seed="phone-body" style={{ position: 'absolute', inset: 0, boxShadow: `0 30px 60px ${surf.ink}33` }} />
        <Panel fill={surf.card} radius={phoneW * 0.11} seed="phone-screen" style={{ position: 'absolute', inset: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 14 }}>
            <Bar color={surf.ink} radius={12} seed="phone-notch" style={{ width: phoneW * 0.3, height: 24 }} />
          </div>
          <div style={{ padding: '18px 24px 10px', fontSize: 22, fontWeight: 900, letterSpacing: '0.02em' }}>
            {t.brand.parts.map((p, i) => <span key={i} style={{ color: p.accent ? t.primary : surf.cardInk }}>{p.text}</span>)}
          </div>
          <div style={{ ...keepAll, padding: '0 24px 18px', fontSize: 36, fontWeight: 900, color: surf.cardInk }}>{data.screen_title}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '0 18px' }}>
            {rows.map((r, i) => {
              const at = (ev.rows || [])[i] ?? 12 + i * 10;
              const p = enter(t, frame, at, fps);
              const on = i === tap && tapP > 0;
              return (
                <div key={i} style={{ position: 'relative', opacity: p, transform: riseTransform(t, p, 0.8) }}>
                  <Panel {...cardPanel(t, surf)} fill={on ? t.primary : surf.fill} stroke={null} radius={18} seed={`phone-row${i}`}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '20px 20px', transform: `scale(${on ? 1 - 0.04 * Math.sin(tapP * Math.PI) : 1})` }}>
                    <span style={{ ...keepAll, fontSize: 28, fontWeight: 800, color: on ? t.skin.onColorInk : surf.cardInk }}>{r.text}</span>
                    <Icon name="arrow" size={26} color={on ? t.skin.onColorInk : surf.cardInk} sw={2.4} />
                  </Panel>
                  {i === tap && ripple > 0 && ripple < 1 && (
                    <div style={{ position: 'absolute', left: '55%', top: '50%', transform: `translate(-50%, -50%) scale(${0.4 + ripple})`, opacity: 1 - ripple }}>
                      <Dot size={90} fill="transparent" stroke={t.primary} sw={5} seed={`phone-tap${i}`} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {/* 아래 빈 자리: 내용 줄(자리표시) + 탭 바 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '26px 24px 0', opacity: 0.8 * phoneP }}>
            {[0.9, 0.7, 0.8].slice(0, Math.max(0, 5 - rows.length)).map((w, i) => (
              <Bar key={i} color={surf.fill} radius={8} seed={`phone-skel${i}`} style={{ width: `${w * 100}%`, height: 16 }} />
            ))}
          </div>
          <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-around', alignItems: 'center', padding: '16px 10px 22px' }}>
            {['home', 'search', 'user'].map((ic, i) => <Icon key={ic} name={ic} size={34} color={i === 0 ? t.primary : surf.cardInk} sw={2} />)}
          </div>
        </Panel>
      </div>
    </div>
  );
};

export default PhoneScreen;
