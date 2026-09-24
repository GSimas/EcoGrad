import { useId, useState, type FormEvent } from 'react';
import { Eye, EyeOff, KeyRound } from 'lucide-react';
import { Select } from '@/components/ui/Select';
import { esquecerChaveIA, PROVEDORES, provedorPorId, salvarConfigIA, validarConfigIA, type ConfigSalva } from '@/lib/provedores-ia';

/**
 * Formulário do provedor e da chave de API do UFSCão.
 *
 * Mora num módulo próprio porque a tela de Configurações e a conversa da
 * apresentação também o usam: importá-lo de `ConsultorIA` arrastava o painel
 * inteiro do consultor para o bundle inicial.
 */
export function ConfiguracaoIA({ inicial, onSalvo, onEsquecer }: { inicial: ConfigSalva | null; onSalvo: (c: ConfigSalva) => void; onEsquecer: () => void }) {
  const id = useId();
  // Chave de API se digita errado com facilidade e o erro só aparece na primeira
  // pergunta, longe daqui. Ver o que foi colado é a checagem mais barata; começa
  // escondida porque a tela pode estar sendo projetada.
  const [chaveVisivel, setChaveVisivel] = useState(false);
  const [rascunho, setRascunho] = useState<ConfigSalva>(() => inicial ?? { provedor: PROVEDORES[0].id, modelo: PROVEDORES[0].modelo, baseUrl: PROVEDORES[0].baseUrl, chave: '', lembrar: false });
  const [erro, setErro] = useState<string | null>(null);
  const provedor = provedorPorId(rascunho.provedor);
  const alterar = (v: Partial<ConfigSalva>) => { setRascunho({ ...rascunho, ...v }); setErro(null); };
  // A chave de um provedor não serve para outro: trocar de provedor limpa o campo.
  const trocar = (valor: string) => { const p = provedorPorId(valor); alterar({ provedor: p.id, modelo: p.modelo, baseUrl: p.baseUrl, chave: valor === inicial?.provedor ? inicial.chave : '' }); };
  const salvar = (e: FormEvent) => {
    e.preventDefault();
    const invalida = validarConfigIA(rascunho);
    if (invalida) { setErro(invalida); return; }
    try { salvarConfigIA(rascunho); onSalvo({ ...rascunho, chave: rascunho.chave.trim(), modelo: rascunho.modelo.trim(), baseUrl: rascunho.baseUrl.trim() }); }
    catch { setErro('O navegador não permitiu salvar a configuração. Libere o armazenamento deste site e tente novamente.'); }
  };
  return <form className="space-y-4 text-sm" onSubmit={salvar}>
    <div className="space-y-1">
      <h3 className="flex items-center gap-2 font-semibold"><KeyRound size={16} aria-hidden /> Use sua própria chave de API</h3>
      <p className="text-xs leading-relaxed text-slate-300">A chave fica apenas neste navegador e vai direto para o provedor escolhido, sem passar pelos servidores do EcoGrad. O uso é cobrado pelo provedor, na sua conta.</p>
    </div>
    <div className="space-y-1"><label htmlFor={id + '-provedor'}>Provedor</label><Select id={id + '-provedor'} valor={rascunho.provedor} onChange={trocar} opcoes={PROVEDORES.map((p) => ({ valor: p.id, rotulo: p.nome }))} /></div>
    {provedor.id === 'personalizado' && <div className="space-y-1">
      <label htmlFor={id + '-url'}>URL base da API</label>
      <input id={id + '-url'} className="input" type="url" inputMode="url" spellCheck={false} placeholder="https://exemplo.com/v1" value={rascunho.baseUrl} onChange={(e) => alterar({ baseUrl: e.target.value })} />
      <p className="text-xs text-slate-400">Qualquer serviço compatível com a API de chat da OpenAI, como Together, Fireworks, Ollama ou LM Studio (HTTP apenas em localhost).</p>
    </div>}
    <div className="space-y-1">
      <label htmlFor={id + '-modelo'}>Modelo</label>
      <input id={id + '-modelo'} className="input" spellCheck={false} autoComplete="off" placeholder="identificador-do-modelo" value={rascunho.modelo} onChange={(e) => alterar({ modelo: e.target.value })} />
      <p className="text-xs text-slate-400">Use o identificador exato do modelo, como aparece no painel do provedor.</p>
    </div>
    <div className="space-y-1">
      <label htmlFor={id + '-chave'}>Chave de API</label>
      <div className="flex items-center gap-2">
        <input id={id + '-chave'} className="input min-w-0 flex-1" type={chaveVisivel ? 'text' : 'password'} spellCheck={false} autoComplete="off"
          value={rascunho.chave} onChange={(e) => alterar({ chave: e.target.value })} />
        <button type="button" className="btn h-11 w-11 shrink-0 px-0" onClick={() => setChaveVisivel((v) => !v)}
          aria-pressed={chaveVisivel} aria-controls={id + '-chave'}
          aria-label={chaveVisivel ? 'Esconder a chave de API' : 'Mostrar a chave de API'}
          title={chaveVisivel ? 'Esconder a chave' : 'Mostrar a chave'}>
          {chaveVisivel ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {provedor.chaves && <a className="inline-block min-h-11 py-2 text-xs text-eco-accent underline" href={provedor.chaves} target="_blank" rel="noopener noreferrer">Obter chave em {provedor.nome} ↗<span className="sr-only"> (nova aba)</span></a>}
    </div>
    <label className="flex items-start gap-2">
      <input type="checkbox" className="mt-1" checked={rascunho.lembrar} onChange={(e) => alterar({ lembrar: e.target.checked })} />
      <span>Lembrar a chave neste navegador<span className="block text-xs text-slate-400">Sem essa opção, a chave é apagada ao fechar a aba. Não marque em computadores compartilhados.</span></span>
    </label>
    {erro && <p role="alert" className="erro">{erro}</p>}
    <div className="flex flex-wrap gap-2">
      <button type="submit" className="btn btn-primary">Salvar e conversar</button>
      {!!inicial?.chave && <button type="button" className="btn" onClick={() => { esquecerChaveIA(); onEsquecer(); alterar({ chave: '' }); }}>Esquecer chave</button>}
    </div>
    <p className="text-xs text-slate-400">Se um provedor bloquear chamadas diretas do navegador (CORS), use OpenRouter ou outro serviço compatível.</p>
  </form>;
}
