import logoSrc from '../assets/logo.png';

export default function BrandMark({ className = '' }: { className?: string }) {
  return (
    <img
      src={logoSrc}
      alt="Grid POS"
      className={`brand-mark ${className}`}
      width={40}
      height={40}
      style={{ objectFit: 'contain', borderRadius: '10px' }}
    />
  );
}
