/** Pixel sizes for `PlayingCard` lg/md variants (16px root). */
export const CARD_LG = { width: 134, height: 192 };
export const CARD_MD = { width: 76, height: 108 };

export const PILE_CARD_SCALE = CARD_MD.width / CARD_LG.width;

export interface Point {
  x: number;
  y: number;
}

export function rectCenter(rect: DOMRect): Point {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

export function unitVectorToPile(from: Point, pile: Point): Point {
  const dx = pile.x - from.x;
  const dy = pile.y - from.y;
  const dist = Math.hypot(dx, dy) || 1;
  return { x: dx / dist, y: dy / dist };
}

/** Keep rotated card bounding box inside the viewport. */
export function clampOverlayPosition(x: number, y: number, angleDeg: number, width: number, height: number): Point {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const halfW = (width * cos + height * sin) / 2;
  const halfH = (width * sin + height * cos) / 2;
  const padding = 10;

  return {
    x: Math.min(Math.max(x, halfW + padding), window.innerWidth - halfW - padding),
    y: Math.min(Math.max(y, halfH + padding), window.innerHeight - halfH - padding),
  };
}
