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

/**
 * Enough voices for the deal (a card every 40ms while each clip is ~150ms);
 * overlapping plays beyond this steal the oldest voice.
 */
const POOL_SIZE = 4;

const pools = new Map<SoundEffect, { voices: HTMLAudioElement[]; next: number }>();

function getPool(id: SoundEffect) {
  let pool = pools.get(id);
  if (!pool) {
    const voices: HTMLAudioElement[] = [];
    for (let i = 0; i < POOL_SIZE; i++) {
      const audio = new Audio(SOUNDS[id].src);
      audio.preload = "auto";
      voices.push(audio);
    }
    pool = { voices, next: 0 };
    pools.set(id, pool);
  }
  return pool;
}

/**
 * Create and prime every voice. Fixed elements (instead of a clone per play)
 * matter on iOS Safari, which only allows playback on elements that were
 * touched by a user gesture; call this from the first interaction.
 */
export function preloadSounds() {
  (Object.keys(SOUNDS) as SoundEffect[]).forEach((id) => {
    getPool(id).voices.forEach((audio) => audio.load());
  });
}

export function playSound(id: SoundEffect) {
  if (getSoundMuted()) return;
  const config = SOUNDS[id];
  const pool = getPool(id);
  const audio = pool.voices[pool.next];
  pool.next = (pool.next + 1) % pool.voices.length;
  audio.pause();
  audio.currentTime = 0;
  audio.volume = config.volume;
  audio.playbackRate = config.playbackRate ?? 1;
  void audio.play().catch(() => {});
}
