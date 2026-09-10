import type { Card } from "@kazhutha/shared";
import { useState } from "react";
import { Link } from "react-router-dom";
import LanguageSwitcher from "../components/LanguageSwitcher";
import PlayingCard from "../components/PlayingCard";
import { useLocale } from "../i18n";

const SOURCE_URL = "https://github.com/aadithyen/kazhutha";

const panelClass =
  "rounded-xl border border-neutral-100 bg-white p-4 shadow-[0_2px_12px_rgba(15,23,42,0.06)] dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-[0_2px_12px_rgba(0,0,0,0.3)]";
const secondaryBtnClass =
  "w-full rounded-xl bg-neutral-100 px-4 py-3 text-base font-semibold text-neutral-900 ring-1 ring-neutral-200 transition-transform active:scale-[0.98] dark:bg-neutral-800 dark:text-neutral-100 dark:ring-neutral-700";

/** Static fan of real game cards. Back card first so the Ace of Spades lands on top. */
const HERO_PILE: { card?: Card; x: number; y: number; rotate: number }[] = [
  { x: -46, y: 8, rotate: -18 },
  { card: { suit: "H", rank: 13 }, x: -18, y: 1, rotate: -7 },
  { card: { suit: "C", rank: 7 }, x: 12, y: 0, rotate: 4 },
  { card: { suit: "S", rank: 14 }, x: 38, y: 6, rotate: 14 },
];

function HeroCardPile() {
  return (
    <div className="relative h-[7.75rem] w-[12rem]" aria-hidden>
      {HERO_PILE.map((slot, i) => (
        <div
          key={i}
          className="absolute left-1/2 top-1/2"
          style={{ transform: `translate(calc(-50% + ${slot.x}px), calc(-50% + ${slot.y}px)) rotate(${slot.rotate}deg)` }}
        >
          <PlayingCard card={slot.card} faceDown={!slot.card} size="md" />
        </div>
      ))}
    </div>
  );
}

function SectionHeading({ kicker, title, subtitle }: { kicker: string; title: string; subtitle?: string }) {
  return (
    <header className="text-center">
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">{kicker}</p>
      <h2 className="mt-1 font-serif text-3xl font-semibold italic">{title}</h2>
      {subtitle && <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">{subtitle}</p>}
    </header>
  );
}

const ABOUT_SUITS = [
  { symbol: "♠", color: "text-neutral-900 dark:text-neutral-100" },
  { symbol: "♥", color: "text-rose-600" },
  { symbol: "♣", color: "text-neutral-900 dark:text-neutral-100" },
];

export default function LandingPage() {
  const { t, messages } = useLocale();
  const [rulesOpen, setRulesOpen] = useState(false);
  const about = [
    { title: t("landing.p2pTitle"), body: t("landing.p2pBody") },
    { title: t("landing.lightTitle"), body: t("landing.lightBody") },
    { title: t("landing.openTitle"), body: t("landing.openBody") },
  ];

  return (
    <div className="relative mx-auto flex min-h-dvh max-w-md flex-col bg-white px-4 pb-10 pt-16 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <LanguageSwitcher className="absolute right-4 top-4" />

      <section className="flex flex-col items-center pb-16 pt-4 text-center">
        <HeroCardPile />
        <h1 className="mt-8 font-serif text-6xl font-semibold italic">{t("app.title")}</h1>
        <p className="mt-3 max-w-xs text-base text-neutral-500 dark:text-neutral-400">{t("landing.tagline")}</p>
        <Link
          to="/play"
          className="mt-8 w-full rounded-xl bg-neutral-900 px-6 py-4 text-center text-lg font-semibold text-white shadow-[0_4px_18px_rgba(15,23,42,0.18)] transition-transform active:scale-[0.98] dark:bg-neutral-100 dark:text-neutral-900 dark:shadow-[0_4px_18px_rgba(0,0,0,0.35)]"
        >
          {t("landing.playNow")}
        </Link>
        <p className="mt-3 text-xs text-neutral-400 dark:text-neutral-500">{t("landing.playHint")}</p>
      </section>

      <section className="flex flex-col gap-4 pb-16">
        <SectionHeading kicker={t("landing.howKicker")} title={t("landing.howTitle")} subtitle={t("landing.howSubtitle")} />
        <ol className="flex flex-col gap-3">
          {messages.landing.steps.map((step, i) => (
            <li key={i} className={`${panelClass} flex gap-4`}>
              <span className="w-6 shrink-0 font-serif text-3xl font-semibold italic leading-none text-neutral-300 dark:text-neutral-600">
                {i + 1}
              </span>
              <div>
                <p className="font-semibold">{step.title}</p>
                <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <button
          type="button"
          onClick={() => setRulesOpen((open) => !open)}
          aria-expanded={rulesOpen}
          aria-controls="full-rules"
          className={secondaryBtnClass}
        >
          {rulesOpen ? t("landing.hideRules") : t("landing.fullRules")}
        </button>
        {rulesOpen && (
          <ol id="full-rules" className={`${panelClass} flex flex-col divide-y divide-neutral-100 dark:divide-neutral-800`}>
            {messages.landing.rules.map((rule, i) => (
              <li key={i} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                <span className="w-5 shrink-0 pt-0.5 font-serif text-base font-semibold text-neutral-400 dark:text-neutral-500">
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm font-semibold">{rule.title}</p>
                  <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">{rule.body}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="flex flex-col gap-4 pb-12">
        <SectionHeading kicker={t("landing.aboutKicker")} title={t("landing.aboutTitle")} />
        <ul className="flex flex-col gap-3">
          {about.map((item, i) => (
            <li key={i} className={`${panelClass} flex gap-4`}>
              <span className={`w-6 shrink-0 font-serif text-3xl leading-none ${ABOUT_SUITS[i].color}`} aria-hidden>
                {ABOUT_SUITS[i].symbol}
              </span>
              <div>
                <p className="font-semibold">{item.title}</p>
                <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{item.body}</p>
              </div>
            </li>
          ))}
        </ul>
        <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer" className={`${secondaryBtnClass} text-center`}>
          {t("landing.viewSource")}
        </a>
      </section>

      <footer className="mt-auto flex items-center justify-center gap-3 text-xs text-neutral-400 dark:text-neutral-500">
        <span className="font-serif italic">{t("app.title")}</span>
        <span aria-hidden>·</span>
        <a
          href={SOURCE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="underline-offset-2 hover:text-neutral-600 hover:underline dark:hover:text-neutral-300"
        >
          {t("common.source")}
        </a>
      </footer>
    </div>
  );
}
