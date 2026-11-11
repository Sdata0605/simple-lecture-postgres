import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

// Physics - Atom with orbiting electrons
const PhysicsIcon = () => (
  <svg viewBox="0 0 60 60" className="w-full h-full">
    <circle cx="30" cy="30" r="6" className="fill-blue-400" />
    <ellipse cx="30" cy="30" rx="20" ry="8" className="stroke-blue-300 stroke-2 fill-none" />
    <ellipse cx="30" cy="30" rx="20" ry="8" className="stroke-cyan-300 stroke-2 fill-none" style={{ transform: 'rotate(60deg)', transformOrigin: 'center' }} />
    <ellipse cx="30" cy="30" rx="20" ry="8" className="stroke-sky-300 stroke-2 fill-none" style={{ transform: 'rotate(-60deg)', transformOrigin: 'center' }} />
  </svg>
);

// Chemistry - Flask
const ChemistryIcon = () => (
  <svg viewBox="0 0 60 60" className="w-full h-full">
    <path d="M22 10 L22 25 L10 50 L50 50 L38 25 L38 10" className="stroke-green-400 stroke-2 fill-green-400/20" />
    <rect x="20" y="5" width="20" height="8" rx="2" className="fill-green-300" />
    <circle cx="25" cy="40" r="3" className="fill-green-300/60" />
    <circle cx="35" cy="38" r="2" className="fill-green-200/60" />
  </svg>
);

// Maths - Pi Symbol
const MathsIcon = () => (
  <svg viewBox="0 0 60 60" className="w-full h-full">
    <text x="30" y="42" textAnchor="middle" className="fill-purple-400 text-3xl font-serif">π</text>
  </svg>
);

// Biology - DNA Helix
const BiologyIcon = () => (
  <svg viewBox="0 0 60 60" className="w-full h-full">
    <path d="M20 10 Q30 20 40 10 Q30 0 20 10" className="stroke-pink-400 stroke-2 fill-none" />
    <path d="M20 25 Q30 35 40 25 Q30 15 20 25" className="stroke-pink-300 stroke-2 fill-none" />
    <path d="M20 40 Q30 50 40 40 Q30 30 20 40" className="stroke-pink-400 stroke-2 fill-none" />
    <path d="M20 55 Q30 65 40 55 Q30 45 20 55" className="stroke-pink-300 stroke-2 fill-none" />
    <line x1="25" y1="10" x2="35" y2="10" className="stroke-pink-200 stroke-1" />
    <line x1="25" y1="25" x2="35" y2="25" className="stroke-pink-200 stroke-1" />
    <line x1="25" y1="40" x2="35" y2="40" className="stroke-pink-200 stroke-1" />
  </svg>
);

// Sigma Symbol
const SigmaIcon = () => (
  <svg viewBox="0 0 60 60" className="w-full h-full">
    <text x="30" y="42" textAnchor="middle" className="fill-indigo-400 text-3xl font-serif">Σ</text>
  </svg>
);

// Infinity Symbol
const InfinityIcon = () => (
  <svg viewBox="0 0 60 60" className="w-full h-full">
    <text x="30" y="40" textAnchor="middle" className="fill-cyan-400 text-3xl">∞</text>
  </svg>
);

// Molecule
const MoleculeIcon = () => (
  <svg viewBox="0 0 60 60" className="w-full h-full">
    <circle cx="30" cy="20" r="6" className="fill-orange-400" />
    <circle cx="15" cy="40" r="5" className="fill-orange-300" />
    <circle cx="45" cy="40" r="5" className="fill-orange-300" />
    <line x1="30" y1="26" x2="18" y2="36" className="stroke-orange-400 stroke-2" />
    <line x1="30" y1="26" x2="42" y2="36" className="stroke-orange-400 stroke-2" />
  </svg>
);

// Wave
const WaveIcon = () => (
  <svg viewBox="0 0 60 60" className="w-full h-full">
    <path d="M5 30 Q15 10 25 30 Q35 50 45 30 Q55 10 60 30" className="stroke-teal-400 stroke-2 fill-none" />
  </svg>
);

// Cell
const CellIcon = () => (
  <svg viewBox="0 0 60 60" className="w-full h-full">
    <ellipse cx="30" cy="30" rx="22" ry="18" className="stroke-rose-400 stroke-2 fill-rose-400/10" />
    <circle cx="30" cy="30" r="8" className="fill-rose-300/40 stroke-rose-400 stroke-1" />
    <circle cx="30" cy="30" r="3" className="fill-rose-500" />
  </svg>
);

// Prism
const PrismIcon = () => (
  <svg viewBox="0 0 60 60" className="w-full h-full">
    <polygon points="30,10 10,50 50,50" className="stroke-violet-400 stroke-2 fill-violet-400/20" />
    <line x1="30" y1="30" x2="55" y2="25" className="stroke-red-400 stroke-1" />
    <line x1="30" y1="30" x2="55" y2="30" className="stroke-yellow-400 stroke-1" />
    <line x1="30" y1="30" x2="55" y2="35" className="stroke-blue-400 stroke-1" />
  </svg>
);

const iconComponents = [
  PhysicsIcon,
  ChemistryIcon,
  MathsIcon,
  BiologyIcon,
  SigmaIcon,
  InfinityIcon,
  MoleculeIcon,
  WaveIcon,
  CellIcon,
  PrismIcon,
];

const floatAnimations = [
  'animate-wobble',
  'animate-spin-slow',
  'animate-pulse',
  'animate-bounce',
  'animate-float-particle',
];

// Fewer icons than before (was 30) so fewer elements animate at once.
const GRID_COLS = 4;
const GRID_ROWS = 3;
const PARTICLE_COUNT = 8;

// Small seeded generator: layout is computed once and stays identical across re-renders.
function createSeededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export interface PreparationProgress {
  current: number;
  total: number;
}

export interface PreparationAnimationProps {
  className?: string;
  title?: string;
  /** Real status line (for example the AI tutor stage). */
  statusText?: string;
  /** Secondary line (for example elapsed time). */
  detailText?: string;
  /** When total > 0 the bar shows a determinate fill; otherwise it sweeps continuously. */
  progress?: PreparationProgress | null;
  onCancel?: () => void;
  cancelLabel?: string;
}

const PreparationAnimationBase: React.FC<PreparationAnimationProps> = ({
  className,
  title = 'Preparing presentation...',
  statusText,
  detailText,
  progress,
  onCancel,
  cancelLabel = 'Cancel',
}) => {
  // Computed once per mount. No Math.random during render, so icons and particles do not jump.
  const icons = useMemo(() => {
    const rand = createSeededRandom(7);
    const cellWidth = 100 / GRID_COLS;
    const cellHeight = 100 / GRID_ROWS;
    return Array.from({ length: GRID_COLS * GRID_ROWS }, (_, i) => {
      const col = i % GRID_COLS;
      const row = Math.floor(i / GRID_COLS);
      const IconComponent = iconComponents[i % iconComponents.length];
      return {
        id: i,
        Component: IconComponent,
        style: {
          position: 'absolute' as const,
          top: `${row * cellHeight + cellHeight / 2 + (rand() - 0.5) * 8}%`,
          left: `${col * cellWidth + cellWidth / 2 + (rand() - 0.5) * 8}%`,
          transform: `translate(-50%, -50%) rotate(${rand() * 40 - 20}deg)`,
          opacity: 0.25 + rand() * 0.25,
          width: `${35 + rand() * 25}px`,
          height: `${35 + rand() * 25}px`,
          animationDelay: `${rand() * 3}s`,
          animationDuration: `${3 + rand() * 4}s`,
        },
        animationClass: floatAnimations[Math.floor(rand() * floatAnimations.length)],
      };
    });
  }, []);

  const particles = useMemo(() => {
    const rand = createSeededRandom(19);
    return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      id: i,
      top: `${rand() * 100}%`,
      left: `${rand() * 100}%`,
      delay: `${rand() * 5}s`,
      duration: `${6 + rand() * 4}s`,
    }));
  }, []);

  const percent =
    progress && progress.total > 0
      ? Math.min(100, Math.max(0, Math.round((progress.current / progress.total) * 100)))
      : null;

  return (
    <div className={cn("relative min-h-[400px] w-full h-full flex items-center justify-center overflow-hidden", className)}>
      {/* Floating educational icons */}
      <div className="absolute inset-0 overflow-hidden">
        {icons.map(({ id, Component, style, animationClass }) => (
          <div key={id} className={animationClass} style={style}>
            <Component />
          </div>
        ))}
      </div>

      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {particles.map((p) => (
          <div
            key={`particle-${p.id}`}
            className="absolute w-1.5 h-1.5 rounded-full bg-primary/20 animate-float-particle"
            style={{ top: p.top, left: p.left, animationDelay: p.delay, animationDuration: p.duration }}
          />
        ))}
      </div>

      {/* Center content card. No backdrop-blur: blurring over animated layers repaints every frame. */}
      <div className="relative z-10 flex flex-col items-center text-center px-8 py-8 bg-background/95 rounded-xl border border-border/50 shadow-xl max-w-sm w-[90%]">
        <h3 className="text-2xl font-bold mb-3 bg-gradient-to-r from-primary via-primary to-pink-500 bg-clip-text text-transparent">
          {title}
        </h3>

        {statusText && (
          <p className="text-sm font-medium text-foreground mb-3" aria-live="polite">
            {statusText}
          </p>
        )}

        {/* Progress bar: determinate when a real count exists, otherwise one continuous linear sweep. */}
        <div
          className="w-full h-2.5 bg-muted/50 rounded-full overflow-hidden mb-4 relative"
          role="progressbar"
          aria-label="Preparation progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent ?? undefined}
        >
          {percent !== null ? (
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-primary via-primary to-pink-500 transition-[width] duration-500 ease-linear"
              style={{ width: `${percent}%` }}
            />
          ) : (
            <div
              className="prep-bar-sweep absolute inset-y-0 left-0 w-2/5 rounded-full bg-gradient-to-r from-primary via-primary to-pink-500"
              style={{ willChange: 'transform' }}
            />
          )}
        </div>

        <p className="text-sm text-muted-foreground">
          {detailText ?? 'This may take a few minutes'}
        </p>

        {onCancel && (
          <Button variant="outline" size="sm" className="mt-4" onClick={onCancel}>
            {cancelLabel}
          </Button>
        )}
      </div>

      {/* Linear, seamless sweep. Only transform is animated. */}
      <style>{`
        @keyframes prep-bar-sweep {
          from { transform: translateX(-100%); }
          to { transform: translateX(250%); }
        }
        .prep-bar-sweep { animation: prep-bar-sweep 1.6s linear infinite; }
      `}</style>
    </div>
  );
};

export const PreparationAnimation = React.memo(PreparationAnimationBase);
