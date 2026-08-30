/**
 * Síntese epistemológica do perfil de pesquisa.
 * Transcrição de `gerar_descritivo_sessao` (backend.py:2379).
 */
import { erro, gerarComRetry, json, MODELOS_TEXTO } from './lib/gemini';

interface Payload {
  nomesProgramas?: string[];
  amostraTextos?: string;
}

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return erro('Use POST.', 405);

  let payload: Payload;
  try {
    payload = (await req.json()) as Payload;
  } catch {
    return erro('Corpo da requisição inválido (JSON esperado).', 400);
  }

  const nomes = payload.nomesProgramas ?? [];
  const amostra = (payload.amostraTextos ?? '').slice(0, 20000);
  if (nomes.length === 0 || !amostra) {
    return erro('Informe `nomesProgramas` e `amostraTextos`.', 400);
  }

  const prompt = `Você é um analista sênior de avaliação acadêmica.
Sua missão é criar um parágrafo descritivo e direto (máximo de 60 palavras) apresentando o perfil de pesquisa e o ecossistema do(s) seguinte(s) programa(s): ${nomes.join(', ')}.

Utilize a amostra de teses/conceitos abaixo como base:
---
${amostra}
---

Diretrizes rigorosas:
- Comece direto com a descrição.
- Sintetize os grandes domínios de conhecimento baseando-se nos documentos e no seu conhecimento prévio.
- NÃO repita o nome do(s) programa(s) no texto.
- Retorne APENAS o parágrafo limpo.`;

  try {
    const texto = await gerarComRetry({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      modelos: MODELOS_TEXTO,
      temperature: 0.3,
    });
    return json({ descritivo: texto.trim().replace(/\*\*/g, '').replace(/"/g, '') });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json(
      { descritivo: `Não foi possível gerar a síntese dinâmica no momento. (Aviso: ${msg})` },
      200,
    );
  }
};
