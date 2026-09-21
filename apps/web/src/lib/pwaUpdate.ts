import { registerSW } from "virtual:pwa-register";

export type ReloadHandler = () => void;

export function registerPwaUpdate(onNeedRefresh: (reload: ReloadHandler) => void): void {
  if (import.meta.env.DEV) return;

  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      onNeedRefresh(() => {
        void updateSW(true);
      });
    },
  });
}
