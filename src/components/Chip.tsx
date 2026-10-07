export function Chip({
  selected,
  onClick,
  children,
  disabled,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      disabled={disabled}
      onClick={onClick}
      className={`themed min-h-11 rounded-full border-[1.5px] px-4 text-[15px] transition-colors duration-300 disabled:cursor-not-allowed disabled:opacity-40 ${
        selected ? "border-strong bg-strong text-white" : "border-strong/35 text-fg hover:border-strong"
      }`}
    >
      {children}
    </button>
  );
}
