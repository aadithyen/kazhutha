/** Court card centerpieces — minimal heraldic emblems. Inherits suit color via currentColor. */

interface Props {
  rank: 11 | 12 | 13;
  className?: string;
}

function Medallion() {
  return (
    <g>
      <circle cx="50" cy="50" r="40" fill="currentColor" fillOpacity={0.03} />
      <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeOpacity={0.08} strokeWidth={0.5} />
    </g>
  );
}

function JackArt() {
  return (
    <g>
      <Medallion />
      {/* plume */}
      <path
        d="M57 26c12-12 26-2 18 14"
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.35}
        strokeWidth={1.4}
        strokeLinecap="round"
      />
      <path
        d="M57 26c8-10 20-8 22 4"
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.16}
        strokeWidth={0.7}
        strokeLinecap="round"
      />
      {/* cap */}
      <path
        d="M34 44c0-11 7-18 16-18s16 7 16 18l-1.5 8H35.5L34 44z"
        fill="currentColor"
        fillOpacity={0.82}
      />
      <path
        d="M35.5 50h29"
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.12}
        strokeWidth={0.65}
      />
      {/* collar chevron */}
      <path
        d="M40 58l10 8 10-8"
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.38}
        strokeWidth={1.3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M44 64l6 5 6-5"
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.2}
        strokeWidth={0.9}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* base arc */}
      <path
        d="M30 76q20 9 40 0"
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.16}
        strokeWidth={1.1}
        strokeLinecap="round"
      />
    </g>
  );
}

function QueenArt() {
  return (
    <g>
      <Medallion />
      {/* five-point crown */}
      <path
        d="M22 56l7.5-26 9.5 15 10.5-20 10.5 20 9.5-15 7.5 26z"
        fill="currentColor"
        fillOpacity={0.1}
        stroke="currentColor"
        strokeOpacity={0.72}
        strokeWidth={1.15}
        strokeLinejoin="round"
      />
      <path
        d="M20 56h60"
        stroke="currentColor"
        strokeOpacity={0.14}
        strokeWidth={0.7}
      />
      <rect x="19" y="54" width="62" height="4.5" rx="0.8" fill="currentColor" fillOpacity={0.5} />
      {/* gems */}
      <circle cx="29.5" cy="36" r="1.6" fill="currentColor" fillOpacity={0.3} />
      <circle cx="50" cy="24" r="2" fill="currentColor" fillOpacity={0.36} />
      <circle cx="70.5" cy="36" r="1.6" fill="currentColor" fillOpacity={0.3} />
      {/* necklace */}
      <path
        d="M35 68q15 11 30 0"
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.24}
        strokeWidth={1}
        strokeLinecap="round"
      />
      <circle cx="50" cy="71.5" r="2.2" fill="currentColor" fillOpacity={0.28} />
    </g>
  );
}

function KingArt() {
  return (
    <g>
      <Medallion />
      {/* cross finial */}
      <path
        d="M50 15v9M46.5 18.5h7"
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.38}
        strokeWidth={1}
        strokeLinecap="round"
      />
      {/* three-point imperial crown */}
      <path
        d="M20 56l10-28 10 12 10-18 10 18 10-12 10 28z"
        fill="currentColor"
        fillOpacity={0.1}
        stroke="currentColor"
        strokeOpacity={0.76}
        strokeWidth={1.2}
        strokeLinejoin="round"
      />
      <rect x="18" y="54" width="64" height="5" rx="0.8" fill="currentColor" fillOpacity={0.52} />
      <circle cx="30" cy="34" r="1.6" fill="currentColor" fillOpacity={0.3} />
      <circle cx="50" cy="22" r="2" fill="currentColor" fillOpacity={0.36} />
      <circle cx="70" cy="34" r="1.6" fill="currentColor" fillOpacity={0.3} />
      {/* collar */}
      <path
        d="M32 66h36"
        stroke="currentColor"
        strokeOpacity={0.16}
        strokeWidth={1}
        strokeLinecap="round"
      />
      {/* scepter */}
      <path
        d="M67 63v21"
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.3}
        strokeWidth={1.3}
        strokeLinecap="round"
      />
      <circle cx="67" cy="60.5" r="2.6" fill="currentColor" fillOpacity={0.22} />
      <path
        d="M65.5 60.5h3M67 59v3"
        stroke="currentColor"
        strokeOpacity={0.18}
        strokeWidth={0.5}
        strokeLinecap="round"
      />
      {/* robe hem */}
      <path
        d="M28 80q22 10 44 0"
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.14}
        strokeWidth={1}
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
