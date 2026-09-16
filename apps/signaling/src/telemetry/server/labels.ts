/** HTTP status bucket for low-cardinality OTLP labels (alert-friendly). */
export function httpStatusClass(statusCode: number): "2xx" | "3xx" | "4xx" | "5xx" {
  if (statusCode >= 500) return "5xx";
  if (statusCode >= 400) return "4xx";
  if (statusCode >= 300) return "3xx";
  return "2xx";
}
