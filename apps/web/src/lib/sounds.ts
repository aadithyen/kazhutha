import { getSoundMuted } from "./preferences";

export type SoundEffect = "cardPlay" | "cardFold" | "vettuCollect" | "cardShuffle" | "cardDeal";

interface SoundConfig {
  src: string;
  volume: number;
  playbackRate?: number;
}

const SOUNDS: Record<SoundEffect, SoundConfig> = {
  cardPlay: { src: "/sounds/card-play.ogg", volume: 0.24, playbackRate: 0.95 },
  cardFold: { src: "/sounds/card-fold.ogg", volume: 0.18, playbackRate: 0.72 },
  vettuCollect: { src: "/sounds/vettu-collect.ogg", volume: 0.45 },
  cardShuffle: { src: "/sounds/card-shuffle.ogg", volume: 0.32, playbackRate: 1.05 },
  cardDeal: { src: "/sounds/card-deal.ogg", volume: 0.14, playbackRate: 1.15 },
};

const templates = new Map<SoundEffect, HTMLAudioElement>();

function getTemplate(id: SoundEffect): HTMLAudioElement {
  let template = templates.get(id);
  if (!template) {
    template = new Audio(SOUNDS[id].src);
    template.preload = "auto";
    templates.set(id, template);
  }
  return template;
}

export function preloadSounds() {
  (Object.keys(SOUNDS) as SoundEffect[]).forEach((id) => {
    getTemplate(id).load();
  });
}

export function playSound(id: SoundEffect) {
  if (getSoundMuted()) return;
  const config = SOUNDS[id];
  const audio = getTemplate(id).cloneNode(true) as HTMLAudioElement;
  audio.volume = config.volume;
  audio.playbackRate = config.playbackRate ?? 1;
  void audio.play().catch(() => {});
}
