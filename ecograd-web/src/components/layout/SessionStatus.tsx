import { saveSession, useRecovery } from '@/services/session';
export function SessionStatus() {
  const { message, error, saved, saving } = useRecovery();
  return <section aria-label="Recuperação da sessão">
    {message && <p role="status" className="mx-3 mt-2 text-xs text-slate-300">{message}</p>}
    <details className="mx-3 my-2 rounded-lg border border-eco-border p-2 text-xs text-slate-300">
    <summary className="cursor-pointer p-1">{error ? 'Sessão: recuperação limitada' : saving ? 'Salvando sessão…' : saved ? `Sessão salva às ${saved}` : 'Recuperação da sessão'}</summary>
    <div className="mt-2 space-y-2">
      {error && <p role="alert" className="text-amber-200">{error}</p>}
      <p>Textos e preferências: até 1 MiB. Análise e resultados: até 64 MiB. Validade: 24 horas desde o último salvamento. O percurso usa mais 256 KiB, com até 60 visitas por análise. O navegador mantém até 4 sessões, limitadas a 128 MiB no total; as mais antigas podem ser removidas.</p>
      <p>Aguarde “Sessão salva” antes de recarregar. Cálculos e respostas em andamento precisam de reinício manual após recarregar. Atualizações da base invalidam resultados anteriores. O armazenamento é local a este navegador e pode ser apagado por ele.</p>
      <button type="button" className="btn" disabled={saving} onClick={saveSession}>Salvar sessão agora</button>
    </div>
  </details></section>;
}
