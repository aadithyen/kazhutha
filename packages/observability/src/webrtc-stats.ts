export interface WebRtcStatsSample {
  connectionState: string;
  iceConnectionState: string;
  candidateType: "host" | "srflx" | "relay" | "unknown";
  protocol?: string;
  rttMs?: number;
  packetLoss?: number;
  jitterMs?: number;
  bytesSent?: number;
  bytesReceived?: number;
}

type StatRecord = Record<string, unknown>;

function statField<T>(stat: StatRecord, key: string): T | undefined {
  const value = stat[key];
  return value as T | undefined;
}

/**
 * Extract a small, privacy-safe subset from an RTCStatsReport.
 * Does not return SDP, ICE candidates, or IP addresses.
 */
export function summarizeRtcStats(report: RTCStatsReport): WebRtcStatsSample {
  let candidateType: WebRtcStatsSample["candidateType"] = "unknown";
  let protocol: string | undefined;
  let rttMs: number | undefined;
  let packetLoss: number | undefined;
  let jitterMs: number | undefined;
  let bytesSent = 0;
  let bytesReceived = 0;

  const statsById = new Map<string, StatRecord>();
  report.forEach((stat) => statsById.set(stat.id, stat as StatRecord));

  let selectedPairId: string | undefined;
  for (const stat of statsById.values()) {
    if (stat.type === "transport") {
      selectedPairId = statField<string>(stat, "selectedCandidatePairId");
      const proto = statField<string>(stat, "protocol");
      if (proto) protocol = proto;
    }
  }

  if (selectedPairId) {
    const pair = statsById.get(selectedPairId);
    if (pair?.type === "candidate-pair") {
      const rtt = statField<number>(pair, "currentRoundTripTime");
      if (typeof rtt === "number") rttMs = Math.round(rtt * 1000);
      const local = statsById.get(statField<string>(pair, "localCandidateId") ?? "");
      const remote = statsById.get(statField<string>(pair, "remoteCandidateId") ?? "");
      const type = statField<string>(remote ?? {}, "candidateType") ?? statField<string>(local ?? {}, "candidateType");
      if (type === "host" || type === "srflx" || type === "relay") candidateType = type;
    }
  }

  for (const stat of statsById.values()) {
    if (stat.type === "outbound-rtp" || stat.type === "inbound-rtp") {
      const sent = statField<number>(stat, "bytesSent");
      const received = statField<number>(stat, "bytesReceived");
      if (typeof sent === "number") bytesSent += sent;
      if (typeof received === "number") bytesReceived += received;
      if (stat.type === "inbound-rtp") {
        const lost = statField<number>(stat, "packetsLost");
        const recv = statField<number>(stat, "packetsReceived");
        if (typeof lost === "number" && typeof recv === "number") {
          const total = lost + recv;
          if (total > 0) packetLoss = lost / total;
        }
        const jitter = statField<number>(stat, "jitter");
        if (typeof jitter === "number") jitterMs = Math.round(jitter * 1000);
      }
    }
  }

  return {
    connectionState: "unknown",
    iceConnectionState: "unknown",
    candidateType,
    protocol,
    rttMs,
    packetLoss,
    jitterMs,
    bytesSent: bytesSent || undefined,
    bytesReceived: bytesReceived || undefined,
  };
}
