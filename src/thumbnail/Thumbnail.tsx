import React from 'react';
import { AbsoluteFill } from 'remotion';
import { MotionTheme } from '../kit/types';
import { MotionThemeProvider } from '../kit/theme';
import { useFontsReady } from '../kit/fonts';
import { highlightInk, highlightStyle } from '../kit/skin';
import { keepAll } from '../kit/parts';
import { Mark, Panel } from '../kit/media';
import { Bill, CalendarPage, Certificate, DocumentSheet, IdCard, Passbook } from '../kit/objects';

/**
 * 유튜브 썸네일: 가로 롱폼 (1280x720 기준), 세로 쇼츠 표지 (1080x1920, H > W 이면). 작게 보여도 읽히도록 큰 글자 2줄 + 강조 구절 + 사물 하나.
 * props: theme(스타일), text(큰 글자, 14자 안팎), emphasis(text 안의 강조 구절), badge(왼쪽 위 작은 표), object, object_label
 */
export interface ThumbnailProps {
  width: number;
  height: number;
  theme: MotionTheme;
  text: string;
  emphasis?: string;
  badge?: string;
  object?: string;
  object_label?: string;
}

/**
 * 큰 글자를 2줄로. 우선순위: 직접 넣은 줄바꿈(\n) → 문장 부호/띄어쓰기 → 강조 구절의 앞뒤 경계 → 가운데.
 * 영문/숫자 단어 중간에서는 자르지 않는다.
 */
const splitLines = (text: string, emphasis?: string): string[] => {
  if (text.includes('\n')) return text.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 3);
  const t = text.trim();
  if (t.length <= 8) return [t];
  const mid = t.length / 2;
  const isWord = (c: string) => /[A-Za-z0-9]/.test(c);
  const cands: number[] = [];   // i = i번째 글자 앞에서 자른다
  for (let i = 1; i < t.length; i++) if ('，,！!？?：: 、'.includes(t[i - 1])) cands.push(i);
  if (emphasis && t.includes(emphasis)) {
    const a = t.indexOf(emphasis);
    cands.push(a, a + emphasis.length);
  }
  const ok = cands.filter((i) => i > 1 && i < t.length - 1 && Math.abs(i - mid) <= t.length / 3 && !(isWord(t[i - 1]) && isWord(t[i])));
  let cut = ok.sort((x, y) => Math.abs(x - mid) - Math.abs(y - mid))[0];
  if (cut === undefined) {
    cut = Math.ceil(mid);
    while (cut < t.length - 1 && isWord(t[cut - 1]) && isWord(t[cut])) cut += 1;
  }
  return [t.slice(0, cut).trim(), t.slice(cut).trim()].filter(Boolean);
};

const ObjectArt: React.FC<{ name?: string; label?: string; t: MotionTheme; size: number }> = ({ name, label, t, size }) => {
  const ink = t.skin.onColorInk, sw = t.skin.objectStroke + 1;
  switch (name) {
    case 'cash': return <Bill w={size} sw={sw} color={t.accent2} ink={ink} />;
    case 'document': return <DocumentSheet w={size * 0.72} sw={sw} ink={ink} accent={t.primary} title={label || '申請書'} />;
    case 'calendar': return <CalendarPage w={size * 0.75} sw={sw} ink={ink} accent={t.danger} big={label || '90'} />;
    case 'idcard': return <IdCard w={size} sw={sw} ink={ink} accent={t.accent} />;
    case 'passbook': return <Passbook w={size * 0.68} sw={sw} ink={ink} accent={t.accent2} />;
    default: return <Certificate w={size} sw={sw} primary={t.primary} ink={ink} title={label || '技術士證'} />;
  }
};

/** 큰 글자 줄들 (강조 구절은 형광펜) */
const BigLines: React.FC<{ lines: string[]; emphasis?: string; size: number; surf: any; t: MotionTheme; align?: 'left' | 'center' }> = ({ lines, emphasis, size, surf, t, align = 'left' }) => (
  <>
    {lines.map((line, i) => {
      const parts = emphasis && line.includes(emphasis) ? line.split(emphasis) : null;
      return (
        <div key={i} style={{ ...keepAll, fontSize: size, fontWeight: 900, lineHeight: 1.12, color: surf.ink, letterSpacing: '-0.03em', whiteSpace: 'nowrap', textAlign: align }}>
          {parts ? (
            <>
              {parts[0]}
              <span style={{ position: 'relative', display: 'inline-block' }}>
                <Mark style={highlightStyle(t, surf, 1, size)} seed={`thumb-hl${i}`} />
                <span style={{ position: 'relative', zIndex: 1, color: highlightInk(t, surf, surf.ink) }}>{emphasis}</span>
              </span>
              {parts.slice(1).join(emphasis)}
            </>
          ) : line}
        </div>
      );
    })}
  </>
);

/** 세로 (쇼츠 표지 1080x1920): 배지 → 큰 글자 → 사물 → 브랜드, 가운데 정렬. 쇼츠 목록에서 위아래가 잘려도 읽히게 가운데에 모은다 */
const Portrait: React.FC<ThumbnailProps> = ({ width: W, height: H, theme: t, text, emphasis, badge, object, object_label }) => {
  const surf = t.surfaces[t.primary_surface || 'base'] || Object.values(t.surfaces)[0];
  const s = W / 1080;
  const lines = splitLines(text || '', emphasis);
  const longest = Math.max(...lines.map((l) => l.length), 1);
  const size = Math.min(150, (W * 0.86) / longest);
  return (
    <AbsoluteFill style={{ background: surf.bg, fontFamily: t.font, overflow: 'hidden' }}>
      <AbsoluteFill style={{ backgroundImage: `radial-gradient(${surf.grid} ${3 * s}px, transparent ${3.5 * s}px)`, backgroundSize: `${48 * s}px ${48 * s}px`, opacity: 0.8 }} />
      <div style={{ position: 'absolute', left: '50%', top: H * 0.66, width: 900 * s, height: 900 * s, marginLeft: -450 * s, marginTop: -450 * s, borderRadius: '50%',
        background: `radial-gradient(circle, ${t.primary}40 0%, ${t.primary}10 55%, transparent 70%)` }} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: H * 0.2, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {badge && (
          <Panel fill={t.primary} radius={12 * s} seed="thumb-badge" style={{ ...keepAll, padding: `${10 * s}px ${28 * s}px`, color: t.skin.onColorInk, fontSize: 48 * s, fontWeight: 900, marginBottom: 36 * s }}>{badge}</Panel>
        )}
        <BigLines lines={lines} emphasis={emphasis} size={size} surf={surf} t={t} align="center" />
      </div>
      <div style={{ position: 'absolute', left: '50%', top: H * 0.66, transform: 'translate(-50%, -50%) rotate(-7deg)' }}>
        <ObjectArt name={object} label={object_label} t={t} size={560 * s} />
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: H * 0.1, textAlign: 'center', fontSize: 44 * s, fontWeight: 900, letterSpacing: '-0.01em' }}>
        {t.brand.parts.map((p, i) => <span key={i} style={{ color: p.accent ? t.primary : surf.ink }}>{p.text}</span>)}
        {t.brand.suffix && <span style={{ color: surf.sub, fontSize: 30 * s, marginLeft: 12 * s }}>{t.brand.suffix}</span>}
      </div>
    </AbsoluteFill>
  );
};

const Inner: React.FC<ThumbnailProps> = (props) => {
  const { width: W, height: H, theme: t, text, emphasis, badge, object, object_label } = props;
  useFontsReady(t.font);
  if (H > W) return <Portrait {...props} />;
  const surf = t.surfaces[t.primary_surface || 'base'] || Object.values(t.surfaces)[0];
  const s = W / 1280;
  const lines = splitLines(text || '', emphasis);
  const longest = Math.max(...lines.map((l) => l.length), 1);
  const size = Math.min(132, (W * 0.56) / longest) ;
  const brandColor = (accent?: boolean) => (accent ? t.primary : surf.ink);
  return (
    <AbsoluteFill style={{ background: surf.bg, fontFamily: t.font, overflow: 'hidden' }}>
      <AbsoluteFill style={{ backgroundImage: `radial-gradient(${surf.grid} ${2.5 * s}px, transparent ${3 * s}px)`, backgroundSize: `${40 * s}px ${40 * s}px`, opacity: 0.8 }} />
      {/* 오른쪽 사물 + 은은한 원 */}
      <div style={{ position: 'absolute', right: -60 * s, top: '50%', width: 560 * s, height: 560 * s, marginTop: -280 * s, borderRadius: '50%',
        background: `radial-gradient(circle, ${t.primary}40 0%, ${t.primary}10 55%, transparent 70%)` }} />
      <div style={{ position: 'absolute', right: 70 * s, top: '50%', transform: 'translateY(-50%) rotate(-7deg)' }}>
        <ObjectArt name={object} label={object_label} t={t} size={400 * s} />
      </div>
      {/* 왼쪽 글자 */}
      <div style={{ position: 'absolute', left: 64 * s, top: 0, bottom: 0, width: W * 0.6, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        {badge && (
          <div style={{ display: 'flex', marginBottom: 26 * s }}>
            <Panel fill={t.primary} radius={10 * s} seed="thumb-badge" style={{ ...keepAll, padding: `${8 * s}px ${22 * s}px`, color: t.skin.onColorInk, fontSize: 38 * s, fontWeight: 900 }}>{badge}</Panel>
          </div>
        )}
        <BigLines lines={lines} emphasis={emphasis} size={size * s} surf={surf} t={t} />
      </div>
      {/* 브랜드 */}
      <div style={{ position: 'absolute', left: 64 * s, bottom: 40 * s, fontSize: 34 * s, fontWeight: 900, letterSpacing: '-0.01em' }}>
        {t.brand.parts.map((p, i) => <span key={i} style={{ color: brandColor(p.accent) }}>{p.text}</span>)}
        {t.brand.suffix && <span style={{ color: surf.sub, fontSize: 24 * s, marginLeft: 10 * s }}>{t.brand.suffix}</span>}
      </div>
    </AbsoluteFill>
  );
};

export const Thumbnail: React.FC<ThumbnailProps> = (props) => (
  <MotionThemeProvider theme={props.theme}>
    <Inner {...props} />
  </MotionThemeProvider>
);
