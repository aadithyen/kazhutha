import { randomCode } from "@kazhutha/shared";
import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getStoredName, storeName } from "../lib/identity";

export default function HomePage() {
  const navigate = useNavigate();
  const [createName, setCreateName] = useState(getStoredName());
  const [joinName, setJoinName] = useState(getStoredName());
  const [joinCode, setJoinCode] = useState("");

  function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!createName.trim()) return;
    storeName(createName);
    navigate(`/room/${randomCode(6)}`);
  }

  function handleJoin(e: FormEvent) {
    e.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (!joinName.trim() || !code) return;
    storeName(joinName);
    navigate(`/room/${code}`);
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-8 px-4 py-10">
      <header className="text-center">
        <h1 className="text-4xl font-bold text-amber-400">Kazhutha</h1>
        <p className="mt-1 text-sm text-slate-400">കഴുത · play the Kerala card game with friends</p>
      </header>

      <form onSubmit={handleCreate} className="w-full rounded-2xl bg-slate-800/60 p-5 shadow-lg">
        <h2 className="mb-3 text-lg font-semibold">Create a room</h2>
        <input
          value={createName}
          onChange={(e) => setCreateName(e.target.value)}
          placeholder="Your name"
          maxLength={24}
          className="w-full rounded-lg bg-slate-900 px-4 py-3 text-base outline-none ring-1 ring-slate-700 focus:ring-amber-400"
        />
        <button
          type="submit"
          className="mt-3 w-full rounded-lg bg-amber-400 px-4 py-3 text-base font-semibold text-slate-900 active:scale-[0.98]"
        >
          Create room
        </button>
      </form>

      <div className="flex w-full items-center gap-3 text-slate-500">
        <div className="h-px flex-1 bg-slate-700" />
        <span className="text-xs uppercase">or</span>
        <div className="h-px flex-1 bg-slate-700" />
      </div>

      <form onSubmit={handleJoin} className="w-full rounded-2xl bg-slate-800/60 p-5 shadow-lg">
        <h2 className="mb-3 text-lg font-semibold">Join a room</h2>
        <input
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value)}
          placeholder="Room code"
          maxLength={8}
          className="mb-3 w-full rounded-lg bg-slate-900 px-4 py-3 text-base uppercase outline-none ring-1 ring-slate-700 focus:ring-amber-400"
        />
        <input
          value={joinName}
          onChange={(e) => setJoinName(e.target.value)}
          placeholder="Your name"
          maxLength={24}
          className="w-full rounded-lg bg-slate-900 px-4 py-3 text-base outline-none ring-1 ring-slate-700 focus:ring-amber-400"
        />
        <button
          type="submit"
          className="mt-3 w-full rounded-lg bg-slate-700 px-4 py-3 text-base font-semibold active:scale-[0.98]"
        >
          Join room
        </button>
      </form>

      <p className="text-center text-xs text-slate-500">No accounts. No install. Just share the link.</p>
    </div>
  );
}
