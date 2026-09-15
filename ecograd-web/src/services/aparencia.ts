import { create } from 'zustand';

export type Tema = 'escuro' | 'claro' | 'sistema';
export type Fonte = 'sem-serifa' | 'serifada' | 'dislexica';
export type Tamanho = 'pequeno' | 'medio' | 'grande';
export type Movimento = 'sistema' | 'reduzido';
export type Contraste = 'padrao' | 'alto';
type Preferencias = { tema: Tema; fonte: Fonte; tamanho: Tamanho; movimento: Movimento; contraste: Contraste };
const CHAVE = 'ecograd.aparencia.v1';
const padrao: Preferencias = { tema: 'escuro', fonte: 'sem-serifa', tamanho: 'medio', movimento: 'sistema', contraste: 'padrao' };
const umDe = <T extends string>(valores: readonly T[], v: unknown, alternativa: T): T => (valores as readonly unknown[]).includes(v) ? v as T : alternativa;
export function validarAparencia(valor: unknown): Preferencias {
  const v = (valor && typeof valor === 'object' ? valor : {}) as Partial<Preferencias>;
  return {
    tema: umDe(['escuro', 'claro', 'sistema'], v.tema, padrao.tema),
    fonte: umDe(['sem-serifa', 'serifada', 'dislexica'], v.fonte, padrao.fonte),
    tamanho: umDe(['pequeno', 'medio', 'grande'], v.tamanho, padrao.tamanho),
    movimento: v.movimento === 'reduzido' ? 'reduzido' : padrao.movimento,
    contraste: v.contraste === 'alto' ? 'alto' : padrao.contraste,
  };
}
function ler(): Preferencias {
  try { return validarAparencia(JSON.parse(localStorage.getItem(CHAVE) ?? 'null')); } catch { return padrao; }
}
const sistemaClaro = typeof matchMedia !== 'undefined' ? matchMedia('(prefers-color-scheme: light)') : null;
const sistemaReduzido = typeof matchMedia !== 'undefined' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
export const useAparencia = create<Preferencias & { claro: boolean; reduzir: boolean; erro: boolean; definir: (p: Partial<Preferencias>) => void }>((set, get) => ({
  ...ler(), claro: false, reduzir: false, erro: false,
  definir(p) {
    const prefs = validarAparencia({ ...get(), ...p });
    let erro = false;
    try { localStorage.setItem(CHAVE, JSON.stringify(prefs)); } catch { erro = true; }
    set({ ...prefs, erro }); aplicar();
  },
}));
export function resolverAparencia(s: Preferencias, sistemaClaro: boolean, sistemaReduzido: boolean) {
  return { claro: s.tema === 'claro' || (s.tema === 'sistema' && sistemaClaro), reduzir: s.movimento === 'reduzido' || sistemaReduzido };
}
function aplicar() {
  const s = useAparencia.getState();
  const { claro, reduzir } = resolverAparencia(s, !!sistemaClaro?.matches, !!sistemaReduzido?.matches);
  useAparencia.setState({ claro, reduzir });
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.tema = claro ? 'claro' : 'escuro';
    document.documentElement.dataset.fonte = s.fonte;
    document.documentElement.dataset.tamanho = s.tamanho;
    document.documentElement.dataset.contraste = s.contraste;
    document.documentElement.dataset.movimento = reduzir ? 'reduzido' : 'padrao';
  }
}
// Presentation preferences are independent of analysis/history: changing them never restarts work.
aplicar();
sistemaClaro?.addEventListener('change', aplicar);
sistemaReduzido?.addEventListener('change', aplicar);
