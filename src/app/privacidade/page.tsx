import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Política de Privacidade — Receita da Hora" };

/**
 * RASCUNHO factual do que o app faz com dados. Precisa de revisão do responsável jurídico/DPO antes de ir a produção
 * (base legal, controlador, contato do encarregado, prazos). Ver docs/PASSO_A_PASSO_CONFIGURACAO_MANUAL.md.
 */
export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl space-y-5 px-6 py-12 leading-relaxed">
      <Link href="/" className="text-sm underline underline-offset-4">← Voltar</Link>
      <h1 className="text-[32px] font-medium">Política de Privacidade</h1>
      <p><em>Versão preliminar — sujeita a revisão jurídica antes do lançamento.</em></p>

      <h2 className="text-xl font-medium">O que guardamos</h2>
      <ul className="list-disc space-y-1 pl-6">
        <li><strong>Sem conta:</strong> suas preferências, receitas salvas e feedback ficam apenas no seu aparelho (armazenamento local do navegador).</li>
        <li><strong>Com conta:</strong> e-mail, perfil de gosto (dietas, alergias, ingredientes que você evita, objetivos, tempo e refeições habituais), receitas salvas, feedback e histórico de sugestões vistas/abertas.</li>
        <li><strong>Localização para o clima (opcional):</strong> cidade, país e fuso horário que você informar, usados só para sugerir receitas conforme o tempo. Você pode desativar nas preferências.</li>
      </ul>

      <h2 className="text-xl font-medium">Para quê</h2>
      <p>Para sugerir receitas adequadas a você e respeitar suas restrições alimentares. Não vendemos seus dados nem os usamos para publicidade.</p>

      <h2 className="text-xl font-medium">Seus direitos</h2>
      <p>Na aba Biblioteca → Conta você pode exportar seus dados, apagar seu histórico de sugestões e excluir sua conta (o que remove perfil, salvos, feedback e histórico dos nossos servidores).</p>

      <h2 className="text-xl font-medium">Operadores</h2>
      <p>Autenticação e banco de dados: Supabase. Envio de e-mails de acesso: Resend. Hospedagem: Vercel. Conteúdo das receitas: Cloudflare.</p>

      <h2 className="text-xl font-medium">Contato</h2>
      <p>[definir o e-mail do responsável/encarregado antes do lançamento]</p>
    </main>
  );
}
