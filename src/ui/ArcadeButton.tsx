import { useEffect, useRef, type ButtonHTMLAttributes } from 'react';
import { reducedMotion } from './interaction';

export function KbdBadge({ children }: { children: string }) {
  return <kbd className="kbd-badge">{children}</kbd>;
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'success' | 'danger';
  shortcut?: string;
  pressToken?: number;
};

export default function ArcadeButton({
  variant = 'primary', shortcut, pressToken = 0, children, className = '', type = 'button', ...props
}: Props) {
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!pressToken || reducedMotion()) return;
    const animation = button.current?.animate([
      { transform: 'translateY(0)' },
      { transform: 'translateY(3px)', offset: 0.3 },
      { transform: 'translateY(0)' },
    ], { duration: 180, easing: 'ease-out' });
    return () => animation?.cancel();
  }, [pressToken]);

  return <button ref={button} type={type} className={`arcade-button arcade-${variant} ${className}`} {...props}>
    <span className="arcade-label">{children}</span>
    {shortcut && <KbdBadge>{shortcut}</KbdBadge>}
  </button>;
}
