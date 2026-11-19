export default function Icon({ name }: { name: string }) {
  const paths: Record<string, React.ReactNode> = {
    mine: (
      <>
        <rect x="4" y="4" width="16" height="16" rx="4" />
        <path d="m8 12 3 3 5-6" />
      </>
    ),
    progress: (
      <>
        <path d="M4 4v16h16M8 15v-4m5 4V7m5 8v-6" />
      </>
    ),
    board: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="3" />
        <path d="M9 4v16m6-16v16M6 8v4m6-4v7m6-7v3" />
      </>
    ),
    users: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 4v2" />
      </>
    ),
    departments: (
      <>
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M8 7h2m4 0h2M8 11h2m4 0h2m-6 10v-6h4v6" />
      </>
    ),
    admin: (
      <>
        <path d="m12 3 8 4v5c0 4-4 7-8 9-4-2-8-5-8-9V7z" />
        <path d="m8 12 3 3 5-6" />
      </>
    ),
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 4.5 4.5" />
      </>
    ),
  };
  return (
    <svg
      className="icon"
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name] || paths.board}
    </svg>
  );
}
