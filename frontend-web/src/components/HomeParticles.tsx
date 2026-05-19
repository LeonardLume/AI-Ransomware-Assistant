const points = [
  "left-[12%] top-[18%] h-1 w-1 opacity-45",
  "left-[18%] top-[25%] h-1.5 w-1.5 opacity-35",
  "left-[31%] top-[6%] h-1.5 w-1.5 opacity-50",
  "left-[38%] top-[22%] h-1 w-1 opacity-60",
  "left-[44%] top-[8%] h-1 w-1 opacity-40",
  "left-[52%] top-[26%] h-1.5 w-1.5 opacity-45",
  "left-[65%] top-[7%] h-1 w-1 opacity-55",
  "left-[77%] top-[20%] h-1 w-1 opacity-38",
  "left-[86%] top-[4%] h-1 w-1 opacity-55",
  "left-[8%] top-[72%] h-1.5 w-1.5 opacity-55",
  "left-[23%] top-[75%] h-1.5 w-1.5 opacity-42",
  "left-[35%] top-[76%] h-1 w-1 opacity-38",
  "left-[49%] top-[88%] h-1 w-1 opacity-48",
  "left-[58%] top-[98%] h-1 w-1 opacity-36",
  "left-[71%] top-[82%] h-1 w-1 opacity-40",
  "left-[82%] top-[95%] h-1.5 w-1.5 opacity-52",
];

export default function HomeParticles() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      {points.map((className, index) => (
        <span
          key={index}
          className={`absolute rounded-full bg-white/80 shadow-[0_0_10px_rgba(255,255,255,0.22)] ${className}`}
        />
      ))}
    </div>
  );
}
