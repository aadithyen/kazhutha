export function getAppVersion(): string {
  return import.meta.env.VITE_APP_VERSION ?? "dev";
}
