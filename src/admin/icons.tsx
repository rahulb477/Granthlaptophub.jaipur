import React from "react";

const ICONS: Record<string, React.ReactNode> = {
  check: <path d="m4 12.5 5 5L20 6.5" />,
  box: <><path d="M12 2 3 7v10l9 5 9-5V7Z" /><path d="M3 7l9 5 9-5" /><path d="M12 12v10" /></>,
  laptop: <><rect x="4" y="4.5" width="16" height="11" rx="1.5" /><path d="M2 19.5h20" /></>,
  star: <path d="m12 2.8 2.9 5.9 6.5 1-4.7 4.5 1.1 6.5L12 17.6l-5.8 3.1 1.1-6.5-4.7-4.5 6.5-1Z" />,
  badge: <><path d="M12 1.8 14.4 4l3.3-.4.7 3.3 3 1.6-1.6 3 1.6 3-3 1.6-.7 3.3-3.3-.4L12 22.2 9.6 20l-3.3.4-.7-3.3-3-1.6 1.6-3-1.6-3 3-1.6.7-3.3 3.3.4Z" /><path d="m8.8 12 2.2 2.2 4.2-4.4" /></>,
  shield: <><path d="M12 2 4 5.5V11c0 5 3.4 9.3 8 10.5 4.6-1.2 8-5.5 8-10.5V5.5Z" /><path d="m8.8 11.8 2.2 2.2 4.2-4.2" /></>,
  wallet: <><rect x="2" y="6" width="20" height="14" rx="3" /><path d="M16 13h.01" /><path d="M2 10h20" /></>,
  truck: <><path d="M1.5 5.5h13v11h-13z" /><path d="M14.5 9.5h4l3 3v4h-7" /><circle cx="6" cy="18.5" r="2" /><circle cx="18" cy="18.5" r="2" /></>,
  wrench: <path d="M14.7 6.3a4.5 4.5 0 0 0-6 5.6L3 17.6V21h3.4l5.7-5.7a4.5 4.5 0 0 0 5.6-6L14.5 12l-2.5-2.5Z" />,
  headset: <><path d="M4 13a8 8 0 0 1 16 0" /><rect x="2.5" y="13" width="4.5" height="7" rx="2" /><rect x="17" y="13" width="4.5" height="7" rx="2" /></>,
  store: <><path d="M4 7 5.5 3h13L20 7" /><path d="M4 7h16v3a2.5 2.5 0 0 1-5 0 2.5 2.5 0 0 1-5 0 2.5 2.5 0 0 1-5 0Z" /><path d="M5.5 12.5V21h13v-8.5" /><path d="M9.5 21v-5h5v5" /></>,
  play: <path d="M7 4.8v14.4L19.5 12Z" fill="currentColor" stroke="none" />,
  phone: <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8.1 10a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c1 .3 1.9.5 2.9.7a2 2 0 0 1 1.6 1.9Z" />,
  pin: <><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></>,
  refresh: <><path d="M21 12a9 9 0 1 1-2.6-6.4" /><path d="M21 3v6h-6" /></>,
  x: <><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>,
  arrow: <><path d="M4 12h16" /><path d="m14 6 6 6-6 6" /></>,
  cart: <><circle cx="9" cy="20" r="1.6" /><circle cx="18" cy="20" r="1.6" /><path d="M2.5 3.5h3l2.6 12h10.4l2-8.5H6.6" /></>,
  whatsapp: <><path d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3Z" /><path d="M8.8 9.2c0 3.6 2.4 6 6 6l1.4-1.3-1.8-1.4-1 .7a5.4 5.4 0 0 1-2.6-2.6l.7-1-1.4-1.8Z" /></>,
};

export function Icon({ name, className = "w-5 h-5" }: { name: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {ICONS[name] ?? ICONS.box}
    </svg>
  );
}
