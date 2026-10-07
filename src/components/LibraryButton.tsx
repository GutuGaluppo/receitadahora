import { LibraryStack } from "./icons";

/**
 * Ícone da Biblioteca (marcações empilhadas). Cor = accentStrong da receita.
 * `boxed` é a versão sobre a foto no mobile (quadrado arredondado translúcido).
 */
export function LibraryButton({ onClick, boxed }: { onClick: () => void; boxed?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Abrir biblioteca"
      className={`lib-icon themed flex h-11 w-11 items-center justify-center text-strong ${
        boxed ? "rounded-2xl bg-card shadow-sm" : "rounded-xl"
      }`}
    >
      <LibraryStack size={boxed ? 24 : 30} />
    </button>
  );
}
