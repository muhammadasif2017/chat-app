export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between bg-sidebar p-12">
        <span className="text-sidebar-fg-active text-lg font-semibold tracking-tight">
          Chat App
        </span>
        <div>
          <p className="text-3xl font-bold text-sidebar-fg-active leading-snug">
            Stay connected,
            <br />
            wherever you are.
          </p>
          <p className="mt-3 text-sm text-sidebar-fg">
            Real-time messaging built for people who value speed and simplicity.
          </p>
        </div>
        <p className="text-xs text-sidebar-fg">© 2026 Chat App</p>
      </div>
      <div className="flex min-h-screen items-center justify-center bg-white p-8 lg:min-h-0">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
