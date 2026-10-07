/** Bookmark + pequena pilha. Cor = accentStrong da receita atual. */
export function LibraryButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Abrir biblioteca"
      className="lib-icon themed flex h-11 w-11 items-center justify-center rounded-full text-strong"
    >
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
        <path d="M9 4.5h10a2 2 0 0 1 2 2V8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.45" />
        <path d="M6.5 7h11a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.7" />
        <path
          d="M4 11.5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2V24l-7-4.6L4 24V11.5Z"
          fill="currentColor"
        />
      </svg>
    </button>
  );
}
