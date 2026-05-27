export default function LoginLoading() {
  // Fixed full-screen overlay covers the static layout's navbar + footer
  // while the server component decides whether to redirect or render the form.
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-sbi-dark">
      <div className="flex flex-col items-center gap-5">
        <span className="text-3xl font-light tracking-tight text-white">
          <span className="text-sbi-green">S</span>BI
        </span>
        <span className="h-px w-12 overflow-hidden bg-white/10">
          <span
            className="block h-full w-1/2 bg-sbi-green"
            style={{ animation: "loadingBar 1s ease-in-out infinite" }}
          />
        </span>
      </div>
      <style>{`
        @keyframes loadingBar {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      `}</style>
    </div>
  );
}
