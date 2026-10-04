import React, { useMemo } from 'react';
import {
  AbsoluteFill, Audio, Easing, Sequence, interpolate, random, staticFile,
  useCurrentFrame, useVideoConfig,
} from 'remotion';
import { MotionThemeProvider, useMotionTheme } from '../kit/theme';
import { useFontsReady } from '../kit/fonts';
import { ease } from '../kit/skin';
import { MotionCaption, MotionProps, Shot, Surface, Transition } from '../kit/types';
import { TEMPLATES } from '../templates';
import { Mark, Panel } from '../kit/media';
import { StageSize, shortsFrame } from '../kit/layout';
import { highlightInk, highlightStyle } from '../kit/skin';
import { keepAll } from '../kit/parts';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const asset = (src: string) => (/^https?:\/\//.test(src) ? src : staticFile(src.replace(/^\/+/, '')));

/** 배경 무늬 (스킨이 정함) + 선택: 박자마다 숨쉬기, 회전 장식 링 */
const ShotBackground: React.FC<{ surf: Surface; beats: number[]; start: number }> = ({ surf, beats, start }) => {
  const frame = useCurrentFrame();
  const t = useMotionTheme();
  const abs = frame + start;
  let pulse = 0;
  if (t.skin.beatPulse) {
    let since = 99;
    for (const b of beats) { if (b <= abs) since = abs - b; else break; }
    pulse = Math.max(0, 1 - since / 8);
  }
  const g = surf.grid;
  const pattern: React.CSSProperties | null =
    t.skin.grid === 'squares' ? { backgroundImage: `linear-gradient(${g} 2px, transparent 2px), linear-gradient(90deg, ${g} 2px, transparent 2px)`, backgroundSize: '120px 120px', opacity: 0.35 + pulse * 0.35 }
      : t.skin.grid === 'lines' ? { backgroundImage: `linear-gradient(${g} 2px, transparent 2px)`, backgroundSize: '100% 72px', opacity: 0.7 }
        : t.skin.grid === 'dots' ? { backgroundImage: `radial-gradient(${g} 2.5px, transparent 3px)`, backgroundSize: '48px 48px', backgroundPosition: '24px 24px', opacity: 0.9 }
          : null;
  return (
    <AbsoluteFill style={{ background: surf.bg }}>
      {pattern && <AbsoluteFill style={pattern} />}
      {t.skin.ring && <div style={{ position: 'absolute', left: '50%', top: '50%', width: 1500, height: 1500, marginLeft: -750, marginTop: -750, borderRadius: '50%', border: `3px dashed ${g}`, transform: `rotate(${abs * 0.15}deg) scale(${1 + pulse * 0.015})`, opacity: 0.8 }} />}
    </AbsoluteFill>
  );
};

const ShotView: React.FC<{ shot: Shot; beats: number[] }> = ({ shot, beats }) => {
  const t = useMotionTheme();
  const frame = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  const surf = t.surfaces[shot.bg] || Object.values(t.surfaces)[0];
  const exit = shot.exit ? interpolate(frame, [shot.duration - 7, shot.duration], [1, 0], clamp) : 1;
  const layers = (
    <AbsoluteFill style={{ opacity: exit, transform: `translateY(${(1 - exit) * -t.skin.motion.distance}px) scale(${1 + (t.skin.motion.impact ? 0.025 : 0.012) * Math.min(1, frame / Math.max(1, shot.duration))})` }}>
      {shot.layers.map((ly, i) => {
        const M = TEMPLATES[ly.module];
        if (!M) return null;
        return <M key={i} data={ly.data} ev={ly.ev} dur={shot.duration} ink={surf.ink} sub={surf.sub} surf={surf} />;
      })}
    </AbsoluteFill>
  );
  // 세로 쇼츠: 템플릿은 가운데 정사각형 무대에 그리고, 배경은 화면 전체
  const fr = H > W ? shortsFrame(W, H) : null;
  return (
    <AbsoluteFill style={{ fontFamily: t.font }}>
      <ShotBackground surf={surf} beats={beats} start={shot.start} />
      {fr ? (
        <div style={{ position: 'absolute', left: 0, top: fr.top, width: fr.stage, height: fr.stage, transform: `scale(${fr.scale})`, transformOrigin: '0 0', overflow: 'hidden' }}>
          <StageSize.Provider value={{ width: fr.stage, height: fr.stage }}>{layers}</StageSize.Provider>
        </div>
      ) : layers}
    </AbsoluteFill>
  );
};

/** 컷을 덮는 전환. frame이 컷 지점 */
const TransitionView: React.FC<{ tr: Transition }> = ({ tr }) => {
  const frame = useCurrentFrame();
  const t = useMotionTheme();
  const half = tr.duration / 2;
  const f = frame - half; // -half..+half, 0 = 컷
  const colors = tr.colors || [t.primary, t.surfaces.alt.bg, t.accent];
  if (tr.type === 'stripes') {
    return (
      <AbsoluteFill style={{ overflow: 'hidden', pointerEvents: 'none' }}>
        {colors.map((c, i) => {
          const d = i * 2;
          const x = interpolate(f, [-half + d, 0 + d * 0.3, half + d], [-120, 0, 120], { ...clamp, easing: Easing.inOut(Easing.cubic) });
          return <div key={i} style={{ position: 'absolute', left: '-30%', width: '160%', top: `${-10 + i * 40}%`, height: '45%', background: c, transform: `translateX(${x}%) skewY(-12deg)` }} />;
        })}
      </AbsoluteFill>
    );
  }
  if (tr.type === 'glitch') {
    const on = Math.abs(f) < half;
    if (!on) return null;
    return (
      <AbsoluteFill style={{ pointerEvents: 'none' }}>
        {Array.from({ length: 9 }).map((_, i) => {
          const y = random(`g-y-${i}-${frame}`) * 100;
          const h = 3 + random(`g-h-${i}-${frame}`) * 12;
          const dx = (random(`g-x-${i}-${frame}`) - 0.5) * 240;
          return <div key={i} style={{ position: 'absolute', left: 0, right: 0, top: `${y}%`, height: `${h}%`, background: i % 3 === 0 ? t.surfaces.alt.bg : i % 3 === 1 ? t.primary : t.surfaces.base.bg, transform: `translateX(${dx}px)` }} />;
        })}
      </AbsoluteFill>
    );
  }
  if (tr.type === 'iris') {
    const r = interpolate(f, [-half, 0, half], [0, 160, 0], { ...clamp, easing: Easing.inOut(Easing.cubic) });
    const show = f < 0 ? r : 160 - (160 - r);
    return <AbsoluteFill style={{ pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ width: `${show}vmax`, height: `${show}vmax`, borderRadius: '50%', background: colors[0] }} /></AbsoluteFill>;
  }
  if (tr.type === 'fade') {
    // 다음 장면 배경색으로 잠깐 덮었다가 걷힘 (화면 전체가 하얗게 번쩍이지 않게)
    const o = interpolate(Math.abs(f), [0, half], [1, 0], { ...clamp, easing: Easing.inOut(Easing.sin) });
    return <AbsoluteFill style={{ background: colors[0], opacity: o, pointerEvents: 'none' }} />;
  }
  if (tr.type === 'slide') {
    // 강조색 얇은 띠가 앞서고 다음 배경 면이 오른쪽에서 밀고 들어와 왼쪽으로 빠짐
    const p = f < 0 ? ease(f, -half, 0) : 1 + ease(f, 0, half);
    const x = 100 - p * 100; // 100 → 0 → -100 (%)
    const band = colors[1] || t.primary;
    return (
      <AbsoluteFill style={{ overflow: 'hidden', pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: '100%', transform: `translateX(${x}%)`, background: colors[0] }}>
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: -36, width: 36, background: band }} />
          <div style={{ position: 'absolute', top: 0, bottom: 0, right: -36, width: 36, background: band }} />
        </div>
      </AbsoluteFill>
    );
  }
  const o = interpolate(Math.abs(f), [0, half], [1, 0], clamp);
  return <AbsoluteFill style={{ background: '#ffffff', opacity: o, pointerEvents: 'none' }} />;
};

/** 세로 쇼츠 위쪽: 브랜드 + 쇼츠 제목 (영상 내내 고정) */
const ShortsHeader: React.FC<{ props: MotionProps; surf: Surface; accentBg: boolean }> = ({ props, surf, accentBg }) => {
  const t = useMotionTheme();
  const fr = shortsFrame(props.width, props.height);
  const title = props.hud?.title || '';
  const emphasis = props.hud?.emphasis;
  const lines = title.split('\n').map((l) => l.trim()).filter(Boolean);
  const longest = Math.max(...lines.map((l) => l.length), 1);
  const fs = Math.min(92, (props.width * 0.86) / longest);
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: fr.titleTop, height: fr.top - fr.titleTop, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: t.font }}>
      <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: '-0.01em', marginBottom: 18 }}>
        {t.brand.parts.map((p, i) => <span key={i} style={{ color: p.accent ? (accentBg ? t.accent : t.primary) : surf.ink }}>{p.text}</span>)}
      </div>
      {lines.map((line, i) => {
        const parts = emphasis && line.includes(emphasis) ? line.split(emphasis) : null;
        return (
          <div key={i} style={{ ...keepAll, fontSize: fs, fontWeight: 900, lineHeight: 1.15, color: surf.ink, letterSpacing: '-0.03em', whiteSpace: 'nowrap' }}>
            {parts ? (
              <>
                {parts[0]}
                <span style={{ position: 'relative', display: 'inline-block' }}>
                  <Mark style={highlightStyle(t, surf, 1, fs)} seed={`short-hl${i}`} />
                  <span style={{ position: 'relative', zIndex: 1, color: highlightInk(t, surf, surf.ink) }}>{emphasis}</span>
                </span>
                {parts.slice(1).join(emphasis)}
              </>
            ) : line}
          </div>
        );
      })}
    </div>
  );
};

const Hud: React.FC<{ props: MotionProps }> = ({ props }) => {
  const frame = useCurrentFrame();
  const t = useMotionTheme();
  const shot = props.shots.find((s) => frame >= s.start && frame < s.start + s.duration) || props.shots[props.shots.length - 1];
  const surf = t.surfaces[shot.bg] || Object.values(t.surfaces)[0];
  if (shot.label === 'BRAND') return null;   // 채널 인트로 동안은 구석 로고·챕터 표시 없음
  if (props.height > props.width) {
    return <AbsoluteFill style={{ pointerEvents: 'none' }}><ShortsHeader props={props} surf={surf} accentBg={shot.bg === 'accent'} /></AbsoluteFill>;
  }
  const chapters = props.chapters || [];
  let ci = 0;
  chapters.forEach((c, i) => { if (frame >= c.start) ci = i; });
  const showChapter = chapters.length > 1 && ci > 0 && shot.label !== 'CHAPTER';
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', top: 44, left: 56, fontSize: 30, fontWeight: 900, letterSpacing: '-0.01em', color: surf.ink, fontFamily: t.font }}>
        {t.brand.parts.map((p, i) => <span key={i} style={{ color: p.accent ? (shot.bg === 'accent' ? t.accent : t.primary) : surf.ink }}>{p.text}</span>)}
        {t.brand.suffix && <span style={{ fontSize: 20, marginLeft: 10, opacity: 0.6 }}>{t.brand.suffix}</span>}
      </div>
      {showChapter && (
        <Panel radius={999} seed="hud-chapter"
          stroke={t.skin.cardBorderColor === 'ink' ? surf.ink : surf.line} sw={t.skin.cardBorderColor === 'ink' ? 3 : 2}
          fill={t.skin.cardBorderColor === 'ink' ? 'transparent' : surf.card}
          style={{ position: 'absolute', top: 40, right: 56, display: 'flex', alignItems: 'center', gap: 12, padding: '8px 20px', color: t.skin.cardBorderColor === 'ink' ? surf.ink : surf.cardInk, fontSize: 24, fontWeight: 800, fontFamily: t.font }}>
          <span style={{ fontFamily: t.mono, color: t.primary, fontWeight: 900 }}>{String(ci).padStart(2, '0')}</span>
          {chapters[ci].title}
        </Panel>
      )}
      {chapters.length > 0 && (
        <div style={{ position: 'absolute', left: 56, right: 56, bottom: 30, display: 'flex', gap: 8 }}>
          {chapters.map((c, i) => {
            const end = i + 1 < chapters.length ? chapters[i + 1].start : props.total_frames;
            const p = interpolate(frame, [c.start, end], [0, 1], clamp);
            return (
              <div key={i} style={{ flex: Math.max(1, end - c.start), height: 6, borderRadius: 3, background: `${surf.ink}26`, overflow: 'hidden' }}>
                <div style={{ width: `${p * 100}%`, height: '100%', background: i === ci ? t.primary : surf.ink }} />
              </div>
            );
          })}
        </div>
      )}
    </AbsoluteFill>
  );
};

/** 화면에 박는 자막: 핵심어는 브랜드색으로 */
const Captions: React.FC<{ captions: MotionCaption[] }> = ({ captions }) => {
  const frame = useCurrentFrame();
  const t = useMotionTheme();
  const { width: W, height: H } = useVideoConfig();
  const portrait = H > W;
  const cap = captions.find((c) => frame >= c.start && frame < c.end);
  if (!cap) return null;
  const local = frame - cap.start;
  const inP = interpolate(local, [0, 4], [0, 1], clamp);
  let nodes: React.ReactNode[] = [cap.text];
  for (const h of cap.highlight || []) {
    nodes = nodes.flatMap((n, i): React.ReactNode[] => {
      if (typeof n !== 'string' || !n.includes(h)) return [n];
      const parts = n.split(h);
      return parts.flatMap((p, j): React.ReactNode[] => (j < parts.length - 1 ? [p, <span key={`${h}-${i}-${j}`} style={{ color: t.primary }}>{h}</span>] : [p]));
    });
  }
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, ...(portrait ? { top: shortsFrame(W, H).captionTop } : { bottom: 110 }), display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
      <Panel fill={t.skin.captionBg} radius={18} seed="caption" fillStyle="solid" style={{ padding: portrait ? '16px 30px' : '14px 34px', color: '#fff', fontSize: portrait ? 58 : 50, fontWeight: 800, fontFamily: t.font, transform: `translateY(${(1 - inP) * 10}px)`, opacity: inP }}>
        {nodes}
      </Panel>
    </div>
  );
};

const MusicTrack: React.FC<{ props: MotionProps }> = ({ props }) => {
  const { music, narration_intervals, total_frames } = props;
  const vols = useMemo(() => {
    if (!music) return new Float32Array(0);
    const arr = new Float32Array(total_frames);
    const ramp = 8;
    for (let f = 0; f < total_frames; f++) {
      let duck = 0;
      for (const [a, b] of narration_intervals) {
        if (f >= a - ramp && f <= b + ramp) {
          const d = f < a ? (f - (a - ramp)) / ramp : f > b ? 1 - (f - b) / ramp : 1;
          duck = Math.max(duck, Math.min(1, Math.max(0, d)));
        }
      }
      let v = music.open + (music.under_voice - music.open) * duck;
      v *= Math.min(1, (total_frames - f) / 30);
      arr[f] = v;
    }
    return arr;
  }, [music, narration_intervals, total_frames]);
  if (!music) return null;
  return <Audio src={asset(music.src)} trimBefore={music.trimBefore} loop volume={(f) => vols[Math.min(f, vols.length - 1)] ?? 0} />;
};

export const MotionVideo: React.FC<MotionProps> = (props) => {
  useFontsReady(props.theme.font);
  return (
    <MotionThemeProvider theme={props.theme}>
      <AbsoluteFill style={{ background: '#000' }}>
        {props.shots.map((s) => (
          <Sequence key={s.id} from={s.start} durationInFrames={s.duration} name={`${s.id} ${s.label}`}>
            <ShotView shot={s} beats={props.beat_frames} />
          </Sequence>
        ))}
        <Hud props={props} />
        <Captions captions={props.captions} />
        {props.transitions.map((tr, i) => (
          <Sequence key={`tr-${i}`} from={tr.frame - Math.floor(tr.duration / 2)} durationInFrames={tr.duration} name={`transition ${tr.type}`}>
            <TransitionView tr={tr} />
          </Sequence>
        ))}
        {props.voice.map((v, i) => (
          <Sequence key={`v-${i}`} from={v.from} durationInFrames={v.duration} layout="none" name="voice">
            <Audio src={asset(v.src)} trimBefore={v.trimBefore} volume={v.volume ?? 1} />
          </Sequence>
        ))}
        {props.sfx.map((x, i) => (
          <Sequence key={`s-${i}`} from={x.from} durationInFrames={x.duration} layout="none" name={`sfx ${x.src.split('/').pop()}`}>
            <Audio src={asset(x.src)} volume={x.volume ?? 1} />
          </Sequence>
        ))}
        <MusicTrack props={props} />
      </AbsoluteFill>
    </MotionThemeProvider>
  );
};
