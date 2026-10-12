import { GameState } from "@kazhutha/game";
import { PeerInfo, RoomClient } from "@kazhutha/network";
import { createContext, ReactNode, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useLocale } from "../i18n";
import { reportClientEvent } from "./analytics";
import { getAppVersion } from "./appVersion";
import { getOrCreatePlayerId, getStoredName } from "./identity";
import { fetchIceServers, getSignalingUrl } from "./network";
interface RoomContextValue {
  client: RoomClient;
  state: GameState;
  peers: PeerInfo[];
  signalingConnected: boolean;
  banner: string | null;
  dismissBanner: () => void;
  /** Host removed this player; the room UI should offer a way out instead of a spinner. */
  kicked: boolean;
}

const RoomContext = createContext<RoomContextValue | null>(null);

export function RoomProvider({ roomCode, children }: { roomCode: string; children: ReactNode }) {
  const { t, translateError } = useLocale();
  const playerId = useMemo(() => getOrCreatePlayerId(), []);
  const name = useMemo(() => getStoredName() || t("common.defaultPlayer"), [t]);
  const clientRef = useRef<RoomClient | null>(null);

  if (!clientRef.current) {
    const raw = RoomClient.loadPersistedState(roomCode);
    const persistedState =
      raw && (raw.phase !== "lobby" || raw.hostId === playerId) ? raw : null;
    clientRef.current = new RoomClient({
      signalingUrl: getSignalingUrl(),
      roomCode,
      playerId,
      name,
      clientVersion: getAppVersion(),
      persistedState,
    });
  }
  const client = clientRef.current;

  const [state, setState] = useState<GameState>(client.engine.getState());
  const [peers, setPeers] = useState<PeerInfo[]>([]);
  const [signalingConnected, setSignalingConnected] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [kicked, setKicked] = useState(false);
  const effectGeneration = useRef(0);
  const prevPhaseRef = useRef(state.phase);
  const prevPeerStatusRef = useRef<Map<string, string>>(new Map());

  // Translators live in refs so a locale switch does not tear down and rebuild
  // the connection (re-fetching ICE servers and re-joining).
  const tRef = useRef(t);
  const translateErrorRef = useRef(translateError);
  tRef.current = t;
  translateErrorRef.current = translateError;

  useEffect(() => {
    const generation = ++effectGeneration.current;
    const unsubEngine = client.engine.subscribe(setState);
    const unsubRoom = client.on((ev) => {
      if (ev.type === "peers") setPeers(ev.peers);
      else if (ev.type === "hostLeft") {
        setBanner(tRef.current("banners.hostLeft"));
      } else if (ev.type === "hostReconnected") {
        setBanner(tRef.current("banners.hostReconnected"));
      } else if (ev.type === "kicked") {
        setKicked(true);
      } else if (ev.type === "error") {
        // A kicked player who reloads gets the rejection on JoinRoom instead of the event.
        if (ev.message === "Removed from this room") setKicked(true);
        setBanner(translateErrorRef.current(ev.message));
        reportClientEvent("client_error", "warn", {
          roomCode,
          peerId: playerId,
          message: ev.message,
        });
      } else if (ev.type === "signalingStatus") {
        setSignalingConnected(ev.connected);
        reportClientEvent(
          ev.connected ? "signaling_connected" : "signaling_disconnect",
          ev.connected ? "info" : "warn",
          { roomCode, peerId: playerId },
        );
      }
    });
    // Fetch TURN credentials before connecting so peer links use them; on
    // failure connect anyway with the default STUN-only config.
    void fetchIceServers().then((servers) => {
      if (effectGeneration.current !== generation) return;
      if (servers) client.setIceServers(servers);
      else {
        reportClientEvent("ice_fetch_failed", "warn", { roomCode, peerId: playerId });
      }
      client.connect();
    });
    return () => {
      unsubEngine();
      unsubRoom();
      const closedGeneration = generation;
      window.setTimeout(() => {
        if (effectGeneration.current === closedGeneration) client.disconnect();
      }, 0);
    };
  }, [client, playerId, roomCode]);

  useEffect(() => {
    const prev = prevPhaseRef.current;
    if (prev !== state.phase) {
      reportClientEvent("game_phase", "info", {
        roomCode,
        peerId: playerId,
        detail: `${prev}->${state.phase}`,
      });
      if (state.phase === "playing" && prev === "lobby") {
        reportClientEvent("game_started", "info", { roomCode, peerId: playerId });
      }
      if (state.phase === "finished") {
        reportClientEvent("game_finished", "info", { roomCode, peerId: playerId });
      }
      prevPhaseRef.current = state.phase;
    }
  }, [state.phase, roomCode, playerId]);

  useEffect(() => {
    for (const peer of peers) {
      const was = prevPeerStatusRef.current.get(peer.id);
      if (was && was !== "disconnected" && peer.status === "disconnected") {
        reportClientEvent("webrtc_disconnect", "warn", {
          roomCode,
          peerId: playerId,
          message: `peer ${peer.id}`,
        });
      }
      if (peer.status === "connected" && was !== "connected") {
        reportClientEvent("webrtc_connected", "info", { roomCode, peerId: playerId });
      }
      prevPeerStatusRef.current.set(peer.id, peer.status);
    }
  }, [peers, roomCode, playerId]);

  const value: RoomContextValue = {
    client,
    state,
    peers,
    signalingConnected,
    banner,
    dismissBanner: () => setBanner(null),
    kicked,
  };

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
}

export function useRoom(): RoomContextValue {
  const ctx = useContext(RoomContext);
  if (!ctx) throw new Error("useRoom must be used inside RoomProvider");
  return ctx;
}
