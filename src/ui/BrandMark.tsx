/** Vector mark: a checkout grid and a G-shaped counter, crisp at any scale. */
export default function BrandMark({ className = '' }: { className?: string }) {
  return <svg className={`brand-mark ${className}`} width="40" height="40" viewBox="0 0 40 40" role="img" aria-label="Grid POS" fill="none">
    <rect x="1" y="1" width="38" height="38" rx="11" fill="currentColor" opacity=".12"/>
    <path d="M28 12H17a7 7 0 0 0-7 7v4a7 7 0 0 0 7 7h12V20h-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
    <rect x="17" y="10" width="4" height="4" rx="1" fill="currentColor"/>
    <path d="m15 21 3 3 5-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>;
}
