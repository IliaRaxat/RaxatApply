'use client';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
}

export function GlassCard({ children, className = '' }: GlassCardProps) {
  return (
    <div className={`
      relative overflow-hidden
      bg-white/20 backdrop-blur-xl
      border border-white/30
      rounded-3xl
      shadow-[0_8px_32px_rgba(0,0,0,0.1)]
      before:absolute before:inset-0 before:rounded-3xl
      before:bg-gradient-to-br before:from-white/40 before:to-transparent before:pointer-events-none
      ${className}
    `}>
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}
