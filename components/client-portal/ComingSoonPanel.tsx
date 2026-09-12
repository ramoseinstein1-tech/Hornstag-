export default function ComingSoonPanel({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <p className="eyebrow mb-3">CLIENT PORTAL</p>
      <h1 className="display-md uppercase">
        <span className="text-gradient">{title}</span>
      </h1>
      <p className="mt-3 max-w-lg text-sm leading-relaxed text-text-muted">
        {description}
      </p>

      <div
        className="hs-panel mt-10 flex min-h-[280px] flex-col items-center justify-center gap-3 p-10 text-center"
        style={{ borderStyle: "dashed" }}
      >
        <span className="hs-chip">COMING SOON</span>
        <p className="max-w-sm text-sm text-text-faint">
          This section is part of the initial client portal structure and
          will be built out next.
        </p>
      </div>
    </div>
  );
}
