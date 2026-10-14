// Shared spring response for small tactile movements; no animation runtime is required.
export const springTransition = { stiffness: 450, damping: 30, mass: 1, duration: 420 } as const;

export function springScale(from = 0.96): Keyframe[] {
  const { stiffness, damping, mass, duration } = springTransition;
  const decay = damping / (2 * mass);
  const frequency = Math.sqrt(stiffness / mass - decay ** 2);
  return Array.from({ length: 29 }, (_, index) => {
    const progress = index / 28;
    const time = progress * duration / 1000;
    const displacement = Math.exp(-decay * time) *
      (Math.cos(frequency * time) + decay / frequency * Math.sin(frequency * time));
    const scale = index === 28 ? 1 : 1 + (from - 1) * displacement;
    return { offset: progress, transform: `scale(${scale})` };
  });
}

export function reducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
