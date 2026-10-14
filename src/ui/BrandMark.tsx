export default function BrandMark({ className = '' }: { className?: string }) {
  return <svg className={`brand-mark ${className}`} viewBox="0 0 40 40" fill="none" aria-hidden="true">
    <rect x="1" y="1" width="38" height="38" rx="13" fill="currentColor"/>
    <path d="M8 22c0-8 5.4-13 12-13s12 5 12 13H8Z" fill="#FDFBF7"/>
    <path d="M14 22h12v5a6 6 0 0 1-12 0v-5Z" fill="#FDFBF7"/>
    <rect x="17" y="24" width="2" height="4" rx="1" fill="currentColor"/>
    <rect x="22" y="24" width="2" height="4" rx="1" fill="currentColor"/>
    <circle cx="20" cy="15" r="3.5" fill="currentColor"/>
    <path d="M9 20a9 9 0 0 1 3-5l1 5H9Zm22 0a9 9 0 0 0-3-5l-1 5h4Z" fill="currentColor"/>
  </svg>;
}
