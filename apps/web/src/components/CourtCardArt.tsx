/** Minimal outline bust/head art for Jack, Queen, King court cards. */

interface Props {
  rank: 11 | 12 | 13;
  className?: string;
}

const STROKE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function JackArt() {
  return (
    <g>
      {/* feathered cap */}
      <path d="M36 14c2-8 10-10 16-4 2 2 3 5 2 8" {...STROKE} />
      <path d="M48 10l8-6-2 10" {...STROKE} />
      {/* profile head */}
      <path d="M34 22c0-6 6-10 14-8 8 2 12 10 10 18-2 8-8 14-16 14-6 0-10-4-12-10" {...STROKE} />
      {/* nose / jaw */}
      <path d="M48 30c4 2 6 8 4 14" {...STROKE} />
      {/* neck */}
      <path d="M38 52v10" {...STROKE} />
      {/* shoulders / collar */}
      <path d="M26 68c8 6 22 6 30 0" {...STROKE} />
      <path d="M30 62l4 6M42 62l-4 6" {...STROKE} />
    </g>
  );
}

function QueenArt() {
  return (
    <g>
      {/* crown */}
      <path d="M24 18l6-8 8 6 8-6 6 8v6H24z" {...STROKE} />
      <path d="M30 14v4M38 16v4M46 14v4" {...STROKE} />
      {/* profile head */}
      <path d="M30 28c0-6 8-10 16-6 6 3 10 10 8 18-2 8-8 12-14 10-6-2-10-8-8-16" {...STROKE} />
      {/* hair curl */}
      <path d="M34 36c-2 4-2 10 2 14" {...STROKE} />
      {/* neck */}
      <path d="M36 54v8" {...STROKE} />
      {/* shoulders */}
      <path d="M24 72c10 8 24 8 34 0" {...STROKE} />
      <path d="M28 66h8M40 66h8" {...STROKE} />
    </g>
  );
}

function KingArt() {
  return (
    <g>
      {/* crown with cross */}
      <path d="M22 20l7-10 7 7 7-7 7 10v8H22z" {...STROKE} />
      <path d="M38 8v6M38 6v2" {...STROKE} />
      {/* profile head + beard */}
      <path d="M28 30c0-8 10-12 18-6 6 4 8 12 6 20-2 6-6 10-12 10-8 0-14-6-14-14" {...STROKE} />
      <path d="M30 48c2 8 10 12 18 8" {...STROKE} />
      {/* mustache */}
      <path d="M34 44c4 2 8 2 12 0" {...STROKE} />
      {/* neck */}
      <path d="M38 58v6" {...STROKE} />
      {/* shoulders / robe */}
      <path d="M20 74c12 10 28 10 40 0" {...STROKE} />
      <path d="M26 68l6 8M46 68l-6 8" {...STROKE} />
    </g>
  );
}

export default function CourtCardArt({ rank, className = "" }: Props) {
  return (
    <svg
      viewBox="0 0 64 80"
      className={className}
      aria-hidden
      role="img"
    >
      {rank === 11 && <JackArt />}
      {rank === 12 && <QueenArt />}
      {rank === 13 && <KingArt />}
    </svg>
  );
}
