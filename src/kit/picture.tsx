import React, { useState } from 'react';
import { Img, Loop, OffthreadVideo, staticFile, useVideoConfig } from 'remotion';
import { Surface } from './types';
import { useMotionTheme } from './theme';
import { Icon, Panel } from './media';
import { keepAll } from './parts';

/**
 * 자료(사진·영상) 층. 템플릿은 <img>/<video>를 직접 쓰지 않고 여기 부품을 쓴다.
 * 자료 값은 Python(studio/assets.py)이 job.json 의 자료를 public/_jobs 로 복사하고 채운 것:
 *   {src, kind: image|video, w, h, duration(초), focus: [x, y] 0~1, credit, fit: cover|contain, start(초)}
 * 갤러리 예시처럼 문자열("samples/a.jpg")이 올 수도 있다. 값이 없거나 읽기에 실패하면 fallback 을 그린다 —
 * 자료가 없어도 템플릿이 장면을 만들 수 있어야 한다 (백엔드가 이미지를 안 보냈을 때, 에이전트가 못 구했을 때).
 */
export type AssetRef = {
  src: string; kind: 'image' | 'video'; w?: number; h?: number; duration?: number;
  focus?: [number, number]; credit?: string; fit?: 'cover' | 'contain'; start?: number;
};

const VIDEO_RE = /\.(mp4|mov|webm|m4v|mkv)$/i;

/** data 칸 값 → 자료 (없으면 null) */
export const assetOf = (v: unknown): AssetRef | null => {
  if (!v) return null;
  if (typeof v === 'string') return { src: v, kind: VIDEO_RE.test(v) ? 'video' : 'image' };
  if (typeof v === 'object' && typeof (v as any).src === 'string' && (v as any).src) {
    const a = v as AssetRef;
    return { ...a, kind: a.kind || (VIDEO_RE.test(a.src) ? 'video' : 'image') };
  }
  return null;
};

/** 자료의 가로/세로 비율 (모르면 기본값) */
export const aspectOf = (a: AssetRef | null, fallback = 16 / 9) => (a?.w && a?.h ? a.w / a.h : fallback);

const url = (src: string) => staticFile(src.replace(/^\/+/, ''));

/**
 * 사진/영상 한 장을 상자(w×h)에 채운다.
 * zoom: 확대 배율 (템플릿이 시간에 따라 1 → 1.1 처럼 키우면 천천히 다가가는 효과), pan: 추가 이동(px).
 * 확대·이동의 기준점은 자료의 focus (잘릴 때 남길 중심).
 * dur: 장면 길이(프레임) — 영상 자료가 장면보다 짧으면 되풀이한다.
 */
export const Picture: React.FC<{
  asset: AssetRef | null; w: number | string; h: number | string;
  zoom?: number; pan?: [number, number]; dur?: number; radius?: number;
  fallback?: React.ReactNode; style?: React.CSSProperties;
}> = ({ asset, w, h, zoom = 1, pan = [0, 0], dur, radius = 0, fallback, style }) => {
  const [failed, setFailed] = useState(false);
  const { fps } = useVideoConfig();
  const box: React.CSSProperties = { position: 'relative', width: w, height: h, overflow: 'hidden', borderRadius: radius, ...style };
  if (!asset || failed) return <div style={box}>{fallback}</div>;
  const fx = (asset.focus?.[0] ?? 0.5) * 100, fy = (asset.focus?.[1] ?? 0.5) * 100;
  const media: React.CSSProperties = {
    position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: asset.fit || 'cover', objectPosition: `${fx}% ${fy}%`,
    transform: `translate(${pan[0]}px, ${pan[1]}px) scale(${zoom})`, transformOrigin: `${fx}% ${fy}%`,
  };
  let el: React.ReactNode;
  if (asset.kind === 'video') {
    const skip = Math.round((asset.start || 0) * fps);
    const len = asset.duration ? Math.max(1, Math.floor(asset.duration * fps) - skip) : 0;
    const v = <OffthreadVideo src={url(asset.src)} muted trimBefore={skip} style={media} onError={() => setFailed(true)} />;
    el = len && dur && len < dur ? <Loop durationInFrames={len}>{v}</Loop> : v;
  } else {
    el = <Img src={url(asset.src)} style={media} onError={() => setFailed(true)} />;
  }
  return <div style={box}>{el}</div>;
};

/**
 * 자료가 없을 때의 대체 그림: 색 면 + 큰 선 아이콘 (+ 이름표). 빈 칸처럼 보이지 않고 일부러 만든 삽화처럼.
 * tone: 바탕색 (기본 강조색). 아이콘은 kit/media 의 ICON_NAMES 중 하나.
 */
export const PictureFallback: React.FC<{
  icon?: string; label?: string; tone?: string; ink?: string; iconSize?: number; place?: 'center' | 'left' | 'right';
}> = ({ icon = 'camera', label, tone, ink, iconSize = 220, place = 'center' }) => {
  const t = useMotionTheme();
  const fill = tone || t.accent;
  const color = ink || t.skin.onAccentInk;
  const justify = place === 'center' ? 'center' : place === 'left' ? 'flex-start' : 'flex-end';
  return (
    <Panel fill={fill} seed={`fallback-${icon}`} fillStyle="solid" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: justify, padding: place === 'center' ? 0 : '0 8%', color }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, opacity: place === 'center' ? 1 : 0.9 }}>
        <Icon name={icon} size={iconSize} color={color} sw={1.6} />
        {label && <div style={{ ...keepAll, fontSize: Math.round(iconSize * 0.22), fontWeight: 900, textAlign: 'center', padding: '0 40px' }}>{label}</div>}
      </div>
    </Panel>
  );
};

/** 사진 위 글자를 읽히게 하는 어두운 그라데이션. side: 어두운 쪽 */
export const Scrim: React.FC<{ side?: 'bottom' | 'left' | 'right' | 'top' | 'all'; strength?: number }> = ({ side = 'bottom', strength = 0.85 }) => {
  const t = useMotionTheme();
  const dark = t.surfaces.alt?.bg || t.surfaces.base.bg;
  const a = (x: number) => `${dark}${Math.round(Math.min(1, Math.max(0, x)) * 255).toString(16).padStart(2, '0')}`;
  const bg = side === 'all'
    ? a(strength * 0.6)
    : `linear-gradient(to ${side === 'bottom' ? 'top' : side === 'top' ? 'bottom' : side === 'left' ? 'right' : 'left'}, ${a(strength)} 0%, ${a(strength * 0.55)} 45%, ${a(0)} 80%)`;
  return <div style={{ position: 'absolute', inset: 0, background: bg, pointerEvents: 'none' }} />;
};

/** 사진 위에 올리는 글자의 면: 어두운 면(alt) 색 세트 (사진은 대부분 Scrim 으로 어둡게 깐다) */
export const useOverlaySurface = (): Surface => {
  const t = useMotionTheme();
  return t.surfaces.alt || Object.values(t.surfaces)[0];
};

/** 출처 표기 (화면 구석에 작게). 자료의 credit 이 있을 때만. 기본 자리는 오른쪽 아래 (챕터 진행 막대 위, 자막과 겹치지 않게 폭 제한) */
export const Credit: React.FC<{ asset: AssetRef | null; align?: 'left' | 'right'; bottom?: number; inset?: number }> = ({ asset, align = 'right', bottom = 50, inset = 56 }) => {
  const t = useMotionTheme();
  if (!asset?.credit) return null;
  return (
    <div style={{ position: 'absolute', bottom, [align]: inset, display: 'flex' }}>
      <Panel fill={t.skin.captionBg} radius={8} seed="credit" fillStyle="solid" style={{ ...keepAll, padding: '4px 12px', fontSize: 20, fontWeight: 700, color: t.skin.onAccentInk, opacity: 0.85, maxWidth: 460 }}>
        {asset.credit}
      </Panel>
    </div>
  );
};
