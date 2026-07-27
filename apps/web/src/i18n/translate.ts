type Params = Record<string, string | number>;

function getNestedValue(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => {
    if (current && typeof current === "object" && key in current) {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

export function translate(messages: unknown, key: string, params?: Params): string {
  const value = getNestedValue(messages, key);
  if (typeof value !== "string") return key;
  if (!params) return value;
  return value.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`));
}

export function translateError(messages: unknown, message: string): string {
  const translated = getNestedValue(messages, `errors.${message}`);
  return typeof translated === "string" ? translated : message;
}
