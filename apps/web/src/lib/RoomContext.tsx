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
    clientRef.current = new RoomClient({
      signalingUrl: getSignalingUrl(),
      roomCode,
      playerId,
      name,
      iceServers: getIceServers(),
    });
  }
  const client = clientRef.current;

  const [state, setState] = useState<GameState>(client.engine.getState());
  const [peers, setPeers] = useState<PeerInfo[]>([]);
  const [signalingConnected, setSignalingConnected] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  useEffect(() => {
    const unsubEngine = client.engine.subscribe(setState);
    const unsubRoom = client.on((ev) => {
      if (ev.type === "peers") setPeers(ev.peers);
      else if (ev.type === "hostLeft") setBanner("Host disconnected. Ask them to recreate the room.");
      else if (ev.type === "error") setBanner(ev.message);
      else if (ev.type === "signalingStatus") setSignalingConnected(ev.connected);
    });
    client.connect();
    return () => {
      unsubEngine();
      unsubRoom();
      client.disconnect();
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
