const STYLES = {
  available: "bg-brand-100 text-brand-800",
  "in-development": "bg-amber-soft text-ink-800",
  planned: "bg-ink-100 text-ink-600",
};

const LABELS = {
  available: "Available",
  "in-development": "In development",
  planned: "Planned",
};

export default function StatusBadge({ status = "planned" }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        STYLES[status] || STYLES.planned
      }`}
    >
      {LABELS[status] || status}
    </span>
  );
}
