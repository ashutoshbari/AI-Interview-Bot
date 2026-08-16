'use client';

export default function BackgroundAI() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden select-none">
      {/* Dynamic Ambient Glow Orbs */}
      <div
        className="absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-20 dark:opacity-30 blur-3xl animate-float"
        style={{
          background: 'radial-gradient(circle, #7c3aed 0%, transparent 70%)',
        }}
      />
      <div
        className="absolute top-1/3 -right-32 w-[28rem] h-[28rem] rounded-full opacity-20 dark:opacity-25 blur-3xl"
        style={{
          background: 'radial-gradient(circle, #0088cc 0%, transparent 70%)',
        }}
      />
      <div
        className="absolute -bottom-32 left-1/4 w-[32rem] h-[32rem] rounded-full opacity-15 dark:opacity-20 blur-3xl"
        style={{
          background: 'radial-gradient(circle, #4f46e5 0%, transparent 70%)',
        }}
      />

      {/* Subtle Geometric Background Grid */}
      <div
        className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
        style={{
          backgroundImage: `
            linear-gradient(to right, currentColor 1px, transparent 1px),
            linear-gradient(to bottom, currentColor 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      />
    </div>
  );
}
