export default function BrandMark({ className = '' }: { className?: string }) {
  return (
    <svg className={`brand-mark ${className}`} width="42" height="42" viewBox="0 0 42 42" fill="none" aria-hidden="true">
      <rect x="1.5" y="1.5" width="39" height="39" rx="13" fill="currentColor" stroke="#FFFFFF" strokeOpacity="0.24" strokeWidth="1.5"/>
      <path d="M8.5 23C8.5 14 14 9 21 9C28 9 33.5 14 33.5 23H8.5Z" fill="#FFFFFF"/>
      <circle cx="21" cy="15.2" r="3.7" fill="currentColor"/>
      <path d="M9.4 20.8C10.1 17.8 11.4 15.6 13.1 14.3L14 20.8H9.4ZM32.6 20.8C31.9 17.8 30.6 15.6 28.9 14.3L28 20.8H32.6Z" fill="currentColor"/>
      <path d="M14.5 23H27.5V28.2C27.5 31.6 24.6 34.2 21 34.2C17.4 34.2 14.5 31.6 14.5 28.2V23Z" fill="#FFF7EA"/>
      <rect x="17.8" y="25.2" width="2.1" height="4.2" rx="1" fill="#1F1512"/>
      <rect x="22.1" y="25.2" width="2.1" height="4.2" rx="1" fill="#1F1512"/>
      <circle cx="34.5" cy="7.5" r="3.2" fill="#FDB813"/>
    </svg>
  );
}
