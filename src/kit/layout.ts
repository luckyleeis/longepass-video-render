import { createContext, useContext } from 'react';
import { useVideoConfig } from 'remotion';

/**
 * 템플릿이 그려지는 무대 크기. 기본은 영상 크기, 세로 쇼츠에서는 화면 가운데 정사각형 무대 (shortsFrame).
 * 템플릿은 영상 크기를 직접 읽지 않고 useLayout 으로 받는다.
 */
export const StageSize = createContext<{ width: number; height: number } | null>(null);

/**
 * 세로 쇼츠 화면 배치 (1080x1920 기준): 위 제목 띠 / 가운데 정사각형 무대 / 아래 자막.
 * 무대는 1200x1200 가상 크기로 그린 뒤 화면 폭에 맞게 줄인다 (16:9용 템플릿을 그대로 쓰기 위해).
 * 유튜브 쇼츠 화면의 위(검색·카메라)와 아래(채널명·설명)·오른쪽(버튼) UI를 피한 자리.
 */
export const shortsFrame = (W: number, H: number) => {
  const stage = 1200;
  const scale = W / stage;
  const top = Math.round(H * 0.225);
  return {
    stage, scale, top,
    bottom: top + Math.round(stage * scale),     // 무대 아래 끝
    titleTop: Math.round(H * 0.085),             // 제목 띠 시작
    captionTop: Math.round(H * 0.8),             // 자막 줄 위쪽
  };
};

/**
 * 화면 안전 영역. 템플릿은 화면 가장자리 여백/제목 위치를 직접 숫자로 쓰지 않고 여기서 받는다.
 * (기준 1920x1080. 다른 크기의 무대에서도 같은 비율 규칙으로 계산된다)
 */
export const useLayout = () => {
  const vc = useVideoConfig();
  const stage = useContext(StageSize);
  const W = stage?.width ?? vc.width, H = stage?.height ?? vc.height;
  const portrait = H > W;
  const padX = Math.round(W * (portrait ? 0.07 : 0.083));
  return {
    W, H, portrait,
    padX,                                         // 좌우 여백 (1920 기준 160)
    titleTop: Math.round(H * 0.12),               // 화면 위 제목 줄 (1080 기준 130)
    contentTop: Math.round(H * (portrait ? 0.22 : 0.25)), // 제목 아래 본문 시작 (1080 기준 270)
    contentW: W - padX * 2,
  };
};
