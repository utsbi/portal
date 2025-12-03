'use client';

export function PortalHero() {
  return (
    <div className="flex flex-col items-center text-center space-y-9">
      {/* Icon */}
      {/* <div className="hero-content w-20 h-20 rounded-2xl bg-zinc-800/80 backdrop-blur-sm flex items-center justify-center shadow-2xl shadow-zinc-950/50 border border-zinc-700/50">
        <div className="relative">
          <div className="absolute inset-0 bg-linear-to-br from-blue-500/20 to-purple-500/20 rounded-full blur-xl" />
          <span className="text-4xl relative z-10">  ✨ </span>
        </div>
      </div> */}

      {/* Heading */}
      <div className="hero-content space-y-3">
        <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-gray-400">
          Hello, John Doe!
        </h1>
        <h2 className="text-xl md:text-xl font-light text-gray-100">
          How can I help you?
        </h2>
      </div>
    </div>
  );
}
