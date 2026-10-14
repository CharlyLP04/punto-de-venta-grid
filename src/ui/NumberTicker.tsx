import { memo } from 'react';
import { money } from '../model';

const digits = Array.from({ length: 10 }, (_, n) => n);

// Animates presentation only: every accessible label and every transaction uses exact cents.
function NumberTicker({ cents, className = '' }: { cents: number; className?: string }) {
  const formatted = money(cents);
  return <span className={`number-ticker ${className}`} role="img" aria-label={formatted}>
    <span className="ticker-reels" aria-hidden="true">
      {Array.from(formatted).map((character, index) => /\d/.test(character)
        ? <span className="digit-window" key={`digit-${formatted.length - index}`}>
            <span className="digit-reel" style={{ transform: `translateY(-${Number(character)}em)` }}>
              {digits.map(digit => <span key={digit}>{digit}</span>)}
            </span>
          </span>
        : <span className="digit-separator" key={`separator-${formatted.length - index}`}>{character}</span>)}
    </span>
  </span>;
}

export default memo(NumberTicker);
