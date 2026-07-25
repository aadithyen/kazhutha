/** Court card illustrations — Jack, Queen, King. Inherits suit color via currentColor. */

interface Props {
  rank: 11 | 12 | 13;
  className?: string;
}

function OrnateFrame() {
  return (
    <g>
      <path
        d="M50 6c20 0 34 15 34 36 0 24-14 40-34 40S16 66 16 42C16 21 30 6 50 6z"
        fill="currentColor"
        fillOpacity={0.05}
      />
      <path
        d="M50 9c17 0 29 13 29 31 0 20-12 34-29 34S21 60 21 40C21 22 33 9 50 9z"
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.16}
        strokeWidth={1.1}
      />
      <path
        d="M16 90c10-7 22-11 34-11s24 4 34 11"
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.12}
        strokeWidth={0.9}
        strokeLinecap="round"
      />
      <path
        d="M22 94c7-5 17-8 28-8s21 3 28 8"
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.08}
        strokeWidth={0.7}
        strokeLinecap="round"
      />
    </g>
  );
}

function JackArt() {
  return (
    <g>
      <OrnateFrame />
      {/* feathered cap */}
      <path
        d="M33 30c1-11 9-15 17-9 5 4 6 10 4 16l-1 5H33l-1-5c-2-6-1-12 1-7z"
        fill="currentColor"
      />
      <path
        d="M50 14l12-9-4 14 5 2-13 5"
        fill="currentColor"
        fillOpacity={0.72}
      />
      <circle cx="50" cy="16" r="2" fill="currentColor" fillOpacity={0.3} />
      {/* face */}
      <ellipse cx="50" cy="47" rx="12.5" ry="14.5" fill="currentColor" />
      <path
        d="M41 43c3-2 7-2 11-1"
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.2}
        strokeWidth={1}
        strokeLinecap="round"
      />
      <circle cx="44.5" cy="45.5" r="1.1" fill="currentColor" fillOpacity={0.18} />
      <circle cx="55.5" cy="45.5" r="1.1" fill="currentColor" fillOpacity={0.18} />
      {/* ruffled collar */}
      <path
        d="M36 59c5 7 23 7 28 0l-2.5 5.5c-6.5 5.5-15.5 5.5-23 0L36 59z"
        fill="currentColor"
        fillOpacity={0.8}
      />
      <path
        d="M39 62.5c3.5 2.5 7.5 2.5 11 0M50 63.5c3.5 2.5 7.5 2.5 11 0"
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.18}
        strokeWidth={0.75}
        strokeLinecap="round"
      />
      {/* shoulders */}
      <path
        d="M27 78c11 9 25 9 36 0l-3.5 10c-8.5 5.5-18.5 5.5-29 0L27 78z"
        fill="currentColor"
        fillOpacity={0.52}
      />
      {/* leaf emblem */}
      <path
        d="M50 71c-3.5 7.5-3.5 15 0 22.5 3.5-7.5 3.5-15 0-22.5z"
        fill="currentColor"
        fillOpacity={0.32}
      />
      <path
        d="M50 75v15M44.5 82.5h11"
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.22}
        strokeWidth={0.85}
        strokeLinecap="round"
      />
    </g>
  );
}

function QueenArt() {
  return (
    <g>
      <OrnateFrame />
      {/* crown */}
      <path
        d="M29 25l6.5-11 7.5 7.5 6.5-9.5 6.5 10.5 2 8.5H27l2-6z"
        fill="currentColor"
      />
      <path
        d="M35.5 16.5v5M44 18.5v5M52.5 16.5v5"
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.22}
        strokeWidth={0.95}
        strokeLinecap="round"
      />
      <circle cx="35.5" cy="15.5" r="1.4" fill="currentColor" fillOpacity={0.32} />
      <circle cx="44" cy="17.5" r="1.4" fill="currentColor" fillOpacity={0.32} />
      <circle cx="52.5" cy="15.5" r="1.4" fill="currentColor" fillOpacity={0.32} />
      {/* hair */}
      <path
        d="M35.5 35c-2.5 10.5-0.5 21 6.5 29 2.5 2.5 5 3 8.5 3s6-0.5 8.5-3c7-8 9-18.5 6.5-29-4.5-8.5-17.5-10.5-30 0z"
        fill="currentColor"
        fillOpacity={0.88}
      />
      {/* face */}
      <ellipse cx="50" cy="49" rx="11.5" ry="13.5" fill="currentColor" />
      <path
        d="M42.5 45c3-2 7-2 10.5 0"
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.18}
        strokeWidth={0.95}
        strokeLinecap="round"
      />
      <circle cx="45.5" cy="48" r="1" fill="currentColor" fillOpacity={0.18} />
      <circle cx="54.5" cy="48" r="1" fill="currentColor" fillOpacity={0.18} />
      <path
        d="M48.5 53c2 1.8 4 1.8 6 0"
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.16}
        strokeWidth={0.85}
        strokeLinecap="round"
      />
      {/* necklace */}
      <path
        d="M39.5 61c4.5 5 16.5 5 21 0"
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.32}
        strokeWidth={1.1}
        strokeLinecap="round"
      />
      <circle cx="50" cy="63" r="1.7" fill="currentColor" fillOpacity={0.42} />
      {/* gown */}
      <path
        d="M31.5 67c6.5 10.5 30.5 10.5 37 0l-5 18.5c-8.5 6.5-19.5 6.5-27 0l-5-18.5z"
        fill="currentColor"
        fillOpacity={0.58}
      />
      <path
        d="M37.5 73.5h25M35.5 81.5h29"
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.14}
        strokeWidth={0.75}
        strokeLinecap="round"
      />
      {/* flower */}
      <circle cx="50" cy="89.5" r="3.8" fill="currentColor" fillOpacity={0.28} />
      <path
        d="M50 85.5v8M46 89.5h8M47 86.5l6 6M53 86.5l-6 6"
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.24}
        strokeWidth={0.75}
        strokeLinecap="round"
      />
    </g>
  );
}

function KingArt() {
  return (
    <g>
      <OrnateFrame />
      {/* crown with cross */}
      <path
        d="M27 27l7.5-13 7 8.5 8-10.5 8 12.5 2 9.5H25l2-7.5z"
        fill="currentColor"
      />
      <path
        d="M50 11.5v8.5M50 9.5v2"
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.28}
        strokeWidth={1.15}
        strokeLinecap="round"
      />
      <circle cx="34.5" cy="17.5" r="1.4" fill="currentColor" fillOpacity={0.32} />
      <circle cx="50" cy="15.5" r="1.4" fill="currentColor" fillOpacity={0.32} />
      <circle cx="65.5" cy="17.5" r="1.4" fill="currentColor" fillOpacity={0.32} />
      {/* hair + beard */}
      <path
        d="M33.5 37c-2.5 8.5-0.5 19 4.5 25 2.5 3 6 4 12 4s9.5-1 12-4c5-6 7-16.5 4.5-25-4.5-10.5-17.5-12.5-33 0z"
        fill="currentColor"
        fillOpacity={0.9}
      />
      <path
        d="M37.5 59c4.5 10.5 21.5 10.5 25 0 2 6.5-2 12.5-8 14.5-6 3.5-14.5 3.5-20.5 0-6-2.5-10.5-8.5-8-14.5z"
        fill="currentColor"
        fillOpacity={0.82}
      />
      {/* face */}
      <ellipse cx="50" cy="47" rx="10.5" ry="11.5" fill="currentColor" />
      <path
        d="M42.5 43c3-2 7-2 10 0"
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.18}
        strokeWidth={0.95}
        strokeLinecap="round"
      />
      <circle cx="45.5" cy="46" r="1" fill="currentColor" fillOpacity={0.18} />
      <circle cx="54.5" cy="46" r="1" fill="currentColor" fillOpacity={0.18} />
      <path
        d="M43 52.5c4 2 10 2 14 0"
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.2}
        strokeWidth={0.95}
        strokeLinecap="round"
      />
      {/* ermine collar */}
      <path
        d="M33.5 63c6.5 8.5 26.5 8.5 33 0l-4 6.5c-7.5 5.5-17.5 5.5-25 0l-4-6.5z"
        fill="currentColor"
        fillOpacity={0.68}
      />
      <circle cx="39.5" cy="67" r="0.9" fill="currentColor" fillOpacity={0.22} />
      <circle cx="50" cy="69" r="0.9" fill="currentColor" fillOpacity={0.22} />
      <circle cx="60.5" cy="67" r="0.9" fill="currentColor" fillOpacity={0.22} />
      {/* robe */}
      <path
        d="M25.5 73c11 10.5 37.5 10.5 48.5 0l-6 16.5c-10.5 7.5-26.5 7.5-36.5 0l-6-16.5z"
        fill="currentColor"
        fillOpacity={0.52}
      />
      {/* scepter */}
      <path
        d="M64.5 71v23"
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.42}
        strokeWidth={1.9}
        strokeLinecap="round"
      />
      <circle cx="64.5" cy="69" r="2.8" fill="currentColor" fillOpacity={0.32} />
      <path
        d="M62.5 69h4M64.5 67v4"
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.28}
        strokeWidth={0.65}
        strokeLinecap="round"
      />
    </g>
  );
}

export default function CourtCardArt({ rank, className = "" }: Props) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden role="img">
      {rank === 11 && <JackArt />}
      {rank === 12 && <QueenArt />}
      {rank === 13 && <KingArt />}
    </svg>
  );
}
