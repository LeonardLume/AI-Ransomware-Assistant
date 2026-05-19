export type MetricStripItem = {
  label: string;
  value: string;
  detail?: string;
};

export default function MetricStrip({ items }: { items: MetricStripItem[] }) {
  return (
    <div className="report-metric-strip grid gap-4 rounded-2xl px-4 py-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            {item.label}
          </div>
          <div className="mt-1 truncate text-2xl font-semibold tracking-normal text-white">
            {item.value}
          </div>
          {item.detail ? (
            <div className="mt-1 truncate text-[13px] text-slate-500">{item.detail}</div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
