import { randomCode } from "@kazhutha/shared";
import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getStoredName, storeName } from "../lib/identity";

const inputClass =
  "w-full rounded-xl bg-neutral-50 px-4 py-3 text-base outline-none ring-1 ring-neutral-200 focus:ring-neutral-400 dark:bg-neutral-800 dark:ring-neutral-700 dark:text-neutral-100 dark:focus:ring-neutral-500";
const panelClass =
  "w-full rounded-xl border border-neutral-100 bg-white p-5 shadow-[0_2px_12px_rgba(15,23,42,0.06)] dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-[0_2px_12px_rgba(0,0,0,0.3)]";
const primaryBtnClass =
  "w-full rounded-xl bg-neutral-900 px-4 py-3 text-base font-semibold text-white shadow-[0_2px_12px_rgba(15,23,42,0.12)] active:scale-[0.98] dark:bg-neutral-100 dark:text-neutral-900 dark:shadow-[0_2px_12px_rgba(0,0,0,0.25)]";
const secondaryBtnClass =
  "w-full rounded-xl bg-neutral-100 px-4 py-3 text-base font-semibold text-neutral-900 ring-1 ring-neutral-200 active:scale-[0.98] dark:bg-neutral-800 dark:text-neutral-100 dark:ring-neutral-700";

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
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-8 bg-white px-4 py-10 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <header className="text-center">
        <h1 className="font-serif text-5xl font-semibold italic">Kazhutha</h1>
        <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">കഴുത · play the Kerala card game with friends</p>
      </header>

      <form onSubmit={handleCreate} className={panelClass}>
        <h2 className="mb-3 font-serif text-xl font-semibold italic">Create a room</h2>
        <input
          value={createName}
          onChange={(e) => setCreateName(e.target.value)}
          placeholder="Your name"
          maxLength={24}
          className={inputClass}
        />
        <button type="submit" className={`mt-3 ${primaryBtnClass}`}>
          Create room
        </button>
      </form>

      <div className="flex w-full items-center gap-3 text-neutral-400 dark:text-neutral-500">
        <div className="h-px flex-1 bg-neutral-200 dark:bg-neutral-700" />
        <span className="text-xs font-medium uppercase tracking-wide">or</span>
        <div className="h-px flex-1 bg-neutral-200 dark:bg-neutral-700" />
      </div>

      <form onSubmit={handleJoin} className={panelClass}>
        <h2 className="mb-3 font-serif text-xl font-semibold italic">Join a room</h2>
        <input
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value)}
          placeholder="Room code"
          maxLength={8}
          className={`mb-3 ${inputClass} uppercase`}
        />
        <input
          value={joinName}
          onChange={(e) => setJoinName(e.target.value)}
          placeholder="Your name"
          maxLength={24}
          className={inputClass}
        />
        <button type="submit" className={`mt-3 ${secondaryBtnClass}`}>
          Join room
        </button>
      </form>

      <p className="text-center text-xs text-neutral-400 dark:text-neutral-500">No accounts. No install. Just share the link.</p>
    </div>
  );
}
