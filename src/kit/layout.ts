import { useVideoConfig } from 'remotion';

/**
 * 화면 안전 영역. 템플릿은 화면 가장자리 여백/제목 위치를 직접 숫자로 쓰지 않고 여기서 받는다.
 * (기준 1920x1080. 세로 9:16에서도 같은 비율 규칙으로 계산된다)
 */
export const useLayout = () => {
  const { width: W, height: H } = useVideoConfig();
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
