import React from 'react';
import { SCircle, SPath, SRect, useMedia } from './media';

/**
 * 코드로 그리는 사물 그래픽 (SVG). 색은 호출하는 쪽에서 테마 색을 넘긴다.
 * 도형은 그림 재료 층(media.tsx)의 부품이라 스타일의 재료(clean/sketch)대로 그려진다.
 * 글자는 바깥의 글꼴(스타일 font)을 물려받는다.
 */

/** 바닥 그림자: 손그림 재료에서는 그리지 않는다 */
const ShadowRect: React.FC<{ x: number; y: number; w: number; h: number; rx: number; opacity: number }> = (p) =>
  useMedia().kind === 'sketch' ? null : <rect x={p.x} y={p.y} width={p.w} height={p.h} rx={p.rx} fill="#000" opacity={p.opacity} />;

export const Certificate: React.FC<{ w: number; sw?: number; primary: string; ink: string; title?: string }> = ({ w, sw = 6, primary, ink, title = '技術士證' }) => (
  <svg width={w} height={w * 0.72} viewBox="0 0 500 360">
    <ShadowRect x={8} y={14} w={484} h={338} rx={22} opacity={0.12} />
    <SRect x={0} y={0} w={484} h={338} rx={22} fill="#fffdf6" stroke={ink} sw={sw} />
    <SRect x={22} y={22} w={440} h={294} rx={12} fill="none" stroke={primary} sw={5} strokeDasharray="14 8" />
    <text x="242" y="96" textAnchor="middle" fontSize="54" fontWeight="900" fill={ink}>{title}</text>
    <SRect x={70} y={140} w={250} h={16} rx={8} fill={ink} opacity={0.75} />
    <SRect x={70} y={178} w={200} h={16} rx={8} fill={ink} opacity={0.35} />
    <SRect x={70} y={216} w={230} h={16} rx={8} fill={ink} opacity={0.35} />
    <SCircle cx={380} cy={230} r={58} fill={primary} stroke={ink} sw={sw} />
    <SPath d="M350 284 L340 340 L380 318 L420 340 L410 284" fill={primary} stroke={ink} sw={sw} strokeLinejoin="round" />
    <SPath d="M355 230 l17 17 l34 -34" stroke={ink} sw={10} fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const Bill: React.FC<{ w: number; sw?: number; color: string; ink: string; label?: string }> = ({ w, sw = 6, color, ink, label = 'NT$' }) => (
  <svg width={w} height={w * 0.5} viewBox="0 0 300 150">
    <SRect x={3} y={3} w={294} h={144} rx={14} fill={color} stroke={ink} sw={sw} />
    <SRect x={18} y={18} w={264} h={114} rx={8} fill="none" stroke={ink} sw={3} opacity={0.5} />
    <SCircle cx={150} cy={75} r={34} fill="#fff" stroke={ink} sw={5} />
    <text x="150" y="88" textAnchor="middle" fontSize="34" fontWeight="900" fill={ink}>$</text>
    <text x="40" y="52" fontSize="26" fontWeight="900" fill={ink}>{label}</text>
  </svg>
);

export const Coin: React.FC<{ d: number; sw?: number; color: string; ink: string }> = ({ d, sw = 6, color, ink }) => (
  <svg width={d} height={d} viewBox="0 0 100 100">
    <SCircle cx={50} cy={50} r={46} fill={color} stroke={ink} sw={sw} />
    <SCircle cx={50} cy={50} r={32} fill="none" stroke={ink} sw={4} opacity={0.5} />
    <text x="50" y="64" textAnchor="middle" fontSize="40" fontWeight="900" fill={ink}>$</text>
  </svg>
);

export const DocumentSheet: React.FC<{ w: number; sw?: number; ink: string; accent: string; title?: string }> = ({ w, sw = 6, ink, accent, title = '申請書' }) => (
  <svg width={w} height={w * 1.3} viewBox="0 0 300 390">
    <ShadowRect x={10} y={14} w={280} h={370} rx={18} opacity={0.12} />
    <SPath d="M0 0 H220 L280 60 V370 H0 Z" fill="#ffffff" stroke={ink} sw={sw} strokeLinejoin="round" />
    <SPath d="M220 0 V60 H280" fill={accent} stroke={ink} sw={sw} strokeLinejoin="round" />
    <text x="30" y="70" fontSize="38" fontWeight="900" fill={ink}>{title}</text>
    {[120, 160, 200, 240, 280].map((y, i) => (
      <SRect key={y} x={30} y={y} w={i % 2 ? 160 : 210} h={14} rx={7} fill={ink} opacity={i === 0 ? 0.7 : 0.3} />
    ))}
    <SRect x={150} y={310} w={110} h={34} rx={8} fill={accent} stroke={ink} sw={4} />
  </svg>
);

export const CalendarPage: React.FC<{ w: number; sw?: number; ink: string; accent: string; big: string; unit?: string }> = ({ w, sw = 6, ink, accent, big, unit = '天' }) => (
  <svg width={w} height={w * 1.05} viewBox="0 0 300 315">
    <ShadowRect x={10} y={20} w={280} h={290} rx={22} opacity={0.12} />
    <SRect x={0} y={10} w={280} h={290} rx={22} fill="#ffffff" stroke={ink} sw={sw} />
    <SPath d="M0 32 Q0 10 22 10 H258 Q280 10 280 32 V90 H0 Z" fill={accent} stroke={ink} sw={sw} />
    <SRect x={60} y={0} w={16} h={44} rx={8} fill={ink} />
    <SRect x={204} y={0} w={16} h={44} rx={8} fill={ink} />
    {/* 글자 수에 맞춰 줄인다 (90 → 120px, 按月審核 → 65px) */}
    <text x="140" y={232 - Math.max(0, 120 - Math.min(120, 260 / Math.max(1, String(big).length))) * 0.4} textAnchor="middle"
      fontSize={Math.min(120, 260 / Math.max(1, String(big).length))} fontWeight="900" fill={ink}>{big}</text>
    {/^\d/.test(String(big)) && <text x="140" y="280" textAnchor="middle" fontSize="34" fontWeight="900" fill={ink} opacity="0.6">{unit}</text>}
  </svg>
);

export const IdCard: React.FC<{ w: number; sw?: number; ink: string; accent: string }> = ({ w, sw = 6, ink, accent }) => (
  <svg width={w} height={w * 0.64} viewBox="0 0 320 205">
    <ShadowRect x={8} y={12} w={312} h={190} rx={20} opacity={0.12} />
    <SRect x={0} y={0} w={312} h={190} rx={20} fill="#ffffff" stroke={ink} sw={sw} />
    <SRect x={0} y={0} w={312} h={44} rx={20} fill={accent} stroke={ink} sw={sw} />
    <SRect x={22} y={64} w={90} h={106} rx={12} fill={accent} opacity={0.35} stroke={ink} sw={4} />
    <SCircle cx={67} cy={102} r={20} fill={ink} opacity={0.6} />
    <SPath d="M37 165 Q67 125 97 165" fill={ink} opacity={0.6} />
    {[78, 108, 138].map((y, i) => <SRect key={y} x={132} y={y} w={i ? 120 : 150} h={14} rx={7} fill={ink} opacity={i ? 0.3 : 0.7} />)}
  </svg>
);

export const Passbook: React.FC<{ w: number; sw?: number; ink: string; accent: string }> = ({ w, sw = 6, ink, accent }) => (
  <svg width={w} height={w * 1.2} viewBox="0 0 260 312">
    <ShadowRect x={10} y={14} w={240} h={292} rx={18} opacity={0.12} />
    <SRect x={0} y={0} w={240} h={292} rx={18} fill={accent} stroke={ink} sw={sw} />
    <SRect x={22} y={22} w={196} h={248} rx={10} fill="none" stroke={ink} sw={3} opacity={0.5} />
    <text x="120" y="120" textAnchor="middle" fontSize="40" fontWeight="900" fill={ink}>存摺</text>
    <SCircle cx={120} cy={190} r={34} fill="#ffffff" stroke={ink} sw={5} />
    <text x="120" y="203" textAnchor="middle" fontSize="36" fontWeight="900" fill={ink}>$</text>
  </svg>
);

/**
 * 도장 찍힌 자국 (원형 테두리 + 글자). 글자는 안쪽 원 안에 들어가게 크기를 맞추고, 4자 이상이면 두 줄로.
 * sub(작은 글자)는 안쪽 점선 원을 따라 아래쪽에 둥글게.
 */
export const StampMark: React.FC<{ d: number; sw?: number; color: string; text: string; sub?: string }> = ({ d, color, text, sub }) => {
  const arcId = `stamp-arc-${React.useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const chars = Array.from(text || '');
  const lines = chars.length >= 4 ? [chars.slice(0, Math.ceil(chars.length / 2)).join(''), chars.slice(Math.ceil(chars.length / 2)).join('')] : [chars.join('')];
  const per = Math.max(...lines.map((l) => Array.from(l).length), 1);
  // 안쪽 점선 원(반지름 72) 안의 글자 칸: 폭은 한 줄 ~116 / 두 줄 ~100, 높이는 sub(아래 둥근 글자)가 있으면 그 위까지
  const top = 44, bottom = sub ? 126 : 156;
  const fs = Math.min(56, (lines.length > 1 ? 100 : 116) / per, (bottom - top) / (lines.length * 1.04));
  const cy = (top + bottom) / 2;
  const subChars = Array.from(sub || '').length;
  const subFs = Math.min(18, 110 / Math.max(1, subChars * 0.8));
  return (
    <svg width={d} height={d} viewBox="0 0 200 200">
      <SCircle cx={100} cy={100} r={90} fill="none" stroke={color} sw={10} />
      <SCircle cx={100} cy={100} r={72} fill="none" stroke={color} sw={4} strokeDasharray="6 6" />
      {lines.map((l, i) => (
        <text key={i} x="100" y={cy + fs * 0.36 + (i - (lines.length - 1) / 2) * fs * 1.04} textAnchor="middle" fontSize={fs} fontWeight="900" fill={color}>{l}</text>
      ))}
      {sub && (
        <>
          <defs><path id={arcId} d="M 42 100 A 58 58 0 0 0 158 100" fill="none" /></defs>
          <text fontSize={subFs} fontWeight="800" fill={color} letterSpacing="2">
            <textPath href={`#${arcId}`} startOffset="50%" textAnchor="middle">{sub}</textPath>
          </text>
        </>
      )}
    </svg>
  );
};

/** 체크박스가 있는 조건 카드 */
export const CheckCard: React.FC<{ w: number; sw?: number; stroke?: string; ink: string; bg: string; primary: string; title: string; checked: number; idx: number }> = ({
  w, sw = 6, stroke, ink, bg, primary, title, checked, idx,
}) => (
  <svg width={w} height={w * 1.25} viewBox="0 0 240 300">
    <ShadowRect x={8} y={12} w={224} h={282} rx={22} opacity={0.14} />
    <SRect x={0} y={0} w={224} h={282} rx={22} fill={bg} stroke={stroke || ink} sw={sw} />
    <text x="24" y="52" fontSize="26" fontWeight="900" fill={ink} opacity="0.4" fontFamily="Menlo, monospace">{String(idx + 1).padStart(2, '0')}</text>
    <SRect x={62} y={80} w={100} h={100} rx={18} fill={checked > 0 ? primary : '#fff'} stroke={stroke || ink} sw={sw} />
    {checked > 0 && (
      <SPath d="M84 130 l20 20 l40 -46" stroke={ink} sw={12} fill="none" strokeLinecap="round" strokeLinejoin="round" reveal={checked} />
    )}
    {checked <= 0 && <text x="112" y="150" textAnchor="middle" fontSize="64" fontWeight="900" fill={ink} opacity="0.25">?</text>}
    <text x="112" y="238" textAnchor="middle" fontSize="34" fontWeight="900" fill={ink}>{title}</text>
  </svg>
);

/** 자동차 실루엣 */
export const Car: React.FC<{ w: number; sw?: number; color: string; ink: string; accent?: string }> = ({
  w, sw = 6, color, ink, accent,
}) => (
  <svg width={w} height={w * 0.56} viewBox="0 0 320 180">
    <ShadowRect x={10} y={14} w={300} h={150} rx={18} opacity={0.12} />
    <SPath d="M70 95 L110 35 H220 L265 95 Z" fill={color} stroke={ink} sw={sw} strokeLinejoin="round" />
    <SPath d="M115 45 H160 V90 H85 Z" fill="#ffffff" stroke={ink} sw={3} opacity={0.85} strokeLinejoin="round" />
    <SPath d="M170 45 H215 L245 90 H170 Z" fill="#ffffff" stroke={ink} sw={3} opacity={0.85} strokeLinejoin="round" />
    <SRect x={15} y={85} w={290} h={55} rx={16} fill={color} stroke={ink} sw={sw} />
    <SRect x={285} y={98} w={18} h={16} rx={4} fill={accent || '#FACC15'} stroke={ink} sw={2} />
    <SRect x={16} y={98} w={14} h={16} rx={4} fill="#EF4444" stroke={ink} sw={2} />
    <SCircle cx={85} cy={140} r={26} fill="#1E293B" stroke={ink} sw={sw} />
    <SCircle cx={85} cy={140} r={12} fill="#94A3B8" stroke={ink} sw={2} />
    <SCircle cx={235} cy={140} r={26} fill="#1E293B" stroke={ink} sw={sw} />
    <SCircle cx={235} cy={140} r={12} fill="#94A3B8" stroke={ink} sw={2} />
  </svg>
);

/** 스쿠터 / 기차(機車) 실루엣 */
export const Scooter: React.FC<{ w: number; sw?: number; color: string; ink: string; accent?: string }> = ({
  w, sw = 6, color, ink, accent,
}) => (
  <svg width={w} height={w * 0.75} viewBox="0 0 300 225">
    <ShadowRect x={10} y={15} w={280} h={195} rx={18} opacity={0.12} />
    <SPath d="M205 45 L180 145" stroke={ink} sw={sw} strokeLinecap="round" />
    <SRect x={190} y={35} w={40} h={18} rx={6} fill={color} stroke={ink} sw={sw} />
    <SCircle cx={225} cy={44} r={8} fill={accent || '#FACC15'} stroke={ink} sw={2} />
    <SPath d="M80 95 Q130 95 155 115 L185 140 H130 L95 150 Z" fill={color} stroke={ink} sw={sw} strokeLinejoin="round" />
    <SRect x={75} y={85} w={75} h={16} rx={8} fill="#1E293B" stroke={ink} sw={3} />
    <SCircle cx={205} cy={175} r={28} fill="#1E293B" stroke={ink} sw={sw} />
    <SCircle cx={205} cy={175} r={12} fill="#94A3B8" stroke={ink} sw={2} />
    <SCircle cx={85} cy={175} r={28} fill="#1E293B" stroke={ink} sw={sw} />
    <SCircle cx={85} cy={175} r={12} fill="#94A3B8" stroke={ink} sw={2} />
  </svg>
);

/** 삼각 경고/주의 표지판 */
export const WarningSign: React.FC<{ w: number; sw?: number; color: string; ink: string; label?: string }> = ({
  w, sw = 6, color, ink, label = '!'
}) => (
  <svg width={w} height={w * 0.9} viewBox="0 0 300 270">
    <ShadowRect x={15} y={15} w={270} h={240} rx={22} opacity={0.12} />
    <SPath d="M150 20 L285 245 H15 Z" fill={color} stroke={ink} sw={sw} strokeLinejoin="round" />
    <SPath d="M150 48 L265 232 H35 Z" fill="none" stroke={ink} sw={4} opacity={0.65} strokeLinejoin="round" />
    <text x="150" y="200" textAnchor="middle" fontSize={label.length > 1 ? 65 : 110} fontWeight="900" fill={ink}>{label}</text>
  </svg>
);

/** 원형 속도 제한 / 규제 표지판 */
export const SpeedLimitSign: React.FC<{ w: number; sw?: number; ink: string; label?: string; danger?: string }> = ({
  w, sw = 6, ink, label = '50', danger = '#EF4444'
}) => (
  <svg width={w} height={w} viewBox="0 0 260 260">
    <ShadowRect x={10} y={14} w={240} h={240} rx={120} opacity={0.12} />
    <SCircle cx={130} cy={130} r={118} fill="#ffffff" stroke={danger} sw={22} />
    <SCircle cx={130} cy={130} r={118} fill="none" stroke={ink} sw={sw} />
    <text x="130" y="160" textAnchor="middle" fontSize={label.length > 2 ? 72 : 96} fontWeight="900" fill={ink}>{label}</text>
  </svg>
);

/** 3색 신호등 */
export const TrafficLight: React.FC<{ w: number; sw?: number; ink: string; active?: 'red' | 'yellow' | 'green' }> = ({
  w, sw = 6, ink, active = 'green'
}) => (
  <svg width={w} height={w * 2.25} viewBox="0 0 140 315">
    <ShadowRect x={8} y={12} w={124} h={290} rx={32} opacity={0.14} />
    <SRect x={0} y={0} w={124} h={290} rx={32} fill="#1E293B" stroke={ink} sw={sw} />
    <SCircle cx={62} cy={55} r={32} fill={active === 'red' ? '#EF4444' : '#7F1D1D'} stroke={ink} sw={4} />
    <SCircle cx={62} cy={145} r={32} fill={active === 'yellow' ? '#FACC15' : '#713F12'} stroke={ink} sw={4} />
    <SCircle cx={62} cy={235} r={32} fill={active === 'green' ? '#10B981' : '#064E3B'} stroke={ink} sw={4} />
  </svg>
);

