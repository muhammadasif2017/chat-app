const LOG_LINES = [
  '02:41:07 — connection established',
  '02:41:09 — presence: online',
  '02:41:14 — message received',
  '02:41:22 — typing…',
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between bg-ink p-12">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-ember flex-shrink-0" aria-hidden="true" />
          <span className="font-display text-paper-raised text-base font-semibold tracking-widest uppercase">
            Chat App
          </span>
        </div>
        <div>
          <p className="font-display text-3xl font-semibold text-paper-raised leading-snug">
            Stay connected,
            <br />
            wherever you are.
          </p>
          <p className="mt-3 text-sm text-paper-raised/60 max-w-xs">
            Real-time messaging built for people who value speed and simplicity.
          </p>
          <div className="mt-8 flex flex-col gap-1.5 font-meta text-[11px] text-paper-raised/40">
            {LOG_LINES.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </div>
        <p className="font-meta text-xs text-paper-raised/40">© 2026 Chat App</p>
      </div>
      <div className="flex min-h-screen items-center justify-center bg-paper-raised p-8 lg:min-h-0">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
