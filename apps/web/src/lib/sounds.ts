import { getSoundMuted } from "./preferences";

export type SoundEffect = "cardPlay" | "cardFold" | "vettuCollect";

const SOUND_FILES: Record<SoundEffect, string> = {
  cardPlay: "/sounds/card-play.ogg",
  cardFold: "/sounds/card-fold.ogg",
  vettuCollect: "/sounds/vettu-collect.ogg",
};

const VOLUMES: Record<SoundEffect, number> = {
  cardPlay: 0.35,
  cardFold: 0.3,
  vettuCollect: 0.45,
};

const templates = new Map<SoundEffect, HTMLAudioElement>();

function getTemplate(id: SoundEffect): HTMLAudioElement {
  let template = templates.get(id);
  if (!template) {
    template = new Audio(SOUND_FILES[id]);
    template.preload = "auto";
    templates.set(id, template);
  }
  return template;
}

export function preloadSounds() {
  (Object.keys(SOUND_FILES) as SoundEffect[]).forEach((id) => {
    getTemplate(id).load();
  });
}

export function playSound(id: SoundEffect) {
  if (getSoundMuted()) return;
  const audio = getTemplate(id).cloneNode(true) as HTMLAudioElement;
  audio.volume = VOLUMES[id];
  void audio.play().catch(() => {});
}
