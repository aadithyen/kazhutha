export interface AppConfig {
  version: string;
  minClientVersion: string;
}

export function loadAppConfig(): AppConfig {
  return {
    version: process.env.APP_VERSION ?? "0.1.0",
    minClientVersion: process.env.MIN_CLIENT_VERSION ?? "",
  };
}
