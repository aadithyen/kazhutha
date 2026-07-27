/** Pixel sizes for `PlayingCard` lg/md variants (16px root). */
export const CARD_LG = { width: 168, height: 240 };
export const CARD_MD = { width: 76, height: 108 };
export const CARD_SM = { width: 48, height: 72 };

/** Horizontal spacing between cards in the hand fan (lg size). */
export const CARD_SPREAD = 68;

/** Deal animation uses sm cards; scale fan spacing to match hand proportions. */
export const DEAL_FLY_SPREAD = Math.round(CARD_SPREAD * (CARD_SM.width / CARD_LG.width));

export const PILE_CARD_SCALE = CARD_MD.width / CARD_LG.width;

export interface Point {
  x: number;
  y: number;
}

export function rectCenter(rect: DOMRect): Point {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

const PILE_CARD_GAP = 12;

/** Fallback center when batched events skip rendering a pile card before round end. */
export function estimatePileCardCenter(index: number, total: number, pileCenter: Point): Point {
  const step = CARD_MD.width + PILE_CARD_GAP;
  const span = total * step - PILE_CARD_GAP;
  const startX = pileCenter.x - span / 2 + CARD_MD.width / 2;
  return { x: startX + index * step, y: pileCenter.y };
}

export function estimatePileCardRect(index: number, total: number, pileCenter: Point): DOMRect {
  const center = estimatePileCardCenter(index, total, pileCenter);
  return new DOMRect(center.x - CARD_MD.width / 2, center.y - CARD_MD.height / 2, CARD_MD.width, CARD_MD.height);
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
