import { GameState } from "@kazhutha/game";
import { PeerInfo, RoomClient } from "@kazhutha/network";
import { createContext, ReactNode, useContext, useEffect, useMemo, useRef, useState } from "react";
import { getOrCreatePlayerId, getStoredName } from "./identity";
import { getIceServers, getSignalingUrl } from "./network";

interface RoomContextValue {
  client: RoomClient;
  state: GameState;
  peers: PeerInfo[];
  signalingConnected: boolean;
  banner: string | null;
  dismissBanner: () => void;
}

const RoomContext = createContext<RoomContextValue | null>(null);

export function RoomProvider({ roomCode, children }: { roomCode: string; children: ReactNode }) {
  const playerId = useMemo(() => getOrCreatePlayerId(), []);
  const name = useMemo(() => getStoredName() || "Player", []);
  const clientRef = useRef<RoomClient | null>(null);

  if (!clientRef.current) {
    const persistedState = RoomClient.loadPersistedState(roomCode);
    clientRef.current = new RoomClient({
      signalingUrl: getSignalingUrl(),
      roomCode,
      playerId,
      name,
      iceServers: getIceServers(),
      persistedState,
    });
  }
  const client = clientRef.current;

  const [state, setState] = useState<GameState>(client.engine.getState());
  const [peers, setPeers] = useState<PeerInfo[]>([]);
  const [signalingConnected, setSignalingConnected] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const effectGeneration = useRef(0);

  useEffect(() => {
    const generation = ++effectGeneration.current;
    const unsubEngine = client.engine.subscribe(setState);
    const unsubRoom = client.on((ev) => {
      if (ev.type === "peers") setPeers(ev.peers);
      else if (ev.type === "hostLeft") {
        setBanner("Host disconnected. Acting host continues the game until they return.");
      } else if (ev.type === "actingHost") {
        if (ev.actingHostId === client.playerId) {
          setBanner("You are acting host until the room host returns.");
        } else {
          setBanner("Acting host elected. Game continues.");
        }
      } else if (ev.type === "hostReconnected") {
        setBanner("Host reconnected. Game resumed.");
      } else if (ev.type === "error") setBanner(ev.message);
      else if (ev.type === "signalingStatus") setSignalingConnected(ev.connected);
    });
    client.connect();
    return () => {
      unsubEngine();
      unsubRoom();
      const closedGeneration = generation;
      window.setTimeout(() => {
        if (effectGeneration.current === closedGeneration) client.disconnect();
      }, 0);
    };
  }, [client]);

  const value: RoomContextValue = {
    client,
    state,
    peers,
    signalingConnected,
    banner,
    dismissBanner: () => setBanner(null),
  };

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
}

export function useRoom(): RoomContextValue {
  const ctx = useContext(RoomContext);
  if (!ctx) throw new Error("useRoom must be used inside RoomProvider");
  return ctx;
}
