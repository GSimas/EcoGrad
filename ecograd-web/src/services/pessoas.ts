import { create } from 'zustand';
import { useEcoGradStore } from '../stores/useEcoGradStore';

/**
 * Uma pessoa que o acervo registra sob mais de uma grafia. `canonico` é o nome
 * que passa a valer em toda a análise; `grafias` guarda todas as formas fundidas,
 * inclusive a canônica, para que a fusão seja auditável e reversível.
 */
export interface GrupoPessoa { canonico: string; grafias: string[] }

const CHAVE = 'ecograd.pessoas.v1';
/** Teto defensivo: o estado vive no localStorage e é lido a cada carga. */
const MAX_GRUPOS = 500;
const MAX_GRAFIAS = 50;

const texto = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/**
 * Aceita apenas grupos bem formados e descarta o resto sem falhar: o valor vem
 * do navegador e pode ter sido editado à mão ou gravado por outra versão.
 */
export function validarPessoas(valor: unknown): GrupoPessoa[] {
  if (!Array.isArray(valor)) return [];
  const vistos = new Set<string>();
  const grupos: GrupoPessoa[] = [];
  for (const bruto of valor.slice(0, MAX_GRUPOS)) {
    if (!bruto || typeof bruto !== 'object') continue;
    const canonico = texto((bruto as GrupoPessoa).canonico);
    const lista = (bruto as GrupoPessoa).grafias;
    if (!canonico || !Array.isArray(lista)) continue;
    // O canônico sempre entra, e uma grafia só pode pertencer a um grupo.
    const grafias = [...new Set([canonico, ...lista.map(texto)])].filter((g) => g && !vistos.has(g)).slice(0, MAX_GRAFIAS);
    if (grafias.length < 2 || !grafias.includes(canonico)) continue;
    grafias.forEach((g) => vistos.add(g));
    grupos.push({ canonico, grafias });
  }
  return grupos;
}

function ler(): GrupoPessoa[] {
  try { return validarPessoas(JSON.parse(localStorage.getItem(CHAVE) ?? 'null')); } catch { return []; }
}

/** Grafia (já com trim) → nome canônico. Só contém as grafias não canônicas. */
export function mapaDeGrafias(grupos: readonly GrupoPessoa[]): Map<string, string> {
  const mapa = new Map<string, string>();
  for (const g of grupos) for (const grafia of g.grafias) if (grafia !== g.canonico) mapa.set(grafia, g.canonico);
  return mapa;
}

/** O nome que vale para esta grafia; devolve o próprio nome quando não há fusão. */
export const canonizar = (mapa: Map<string, string>, nome: string) => mapa.get(nome.trim()) ?? nome;

/** O grupo a que esta grafia pertence, se houver. */
export const grupoDe = (grupos: readonly GrupoPessoa[], nome: string) =>
  grupos.find((g) => g.grafias.includes(nome.trim()));

interface EstadoPessoas {
  grupos: GrupoPessoa[];
  mapa: Map<string, string>;
  erro: boolean;
  /** Funde as grafias num só nome. Grafias já fundidas em outro grupo migram para este. */
  unificar: (canonico: string, grafias: readonly string[]) => void;
  /** Desfaz a fusão de um grupo, devolvendo cada grafia ao seu nome original. */
  desfazer: (canonico: string) => void;
}

function gravar(grupos: GrupoPessoa[]) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(grupos));
    return false;
  } catch { return true; }
}

export const usePessoas = create<EstadoPessoas>((set, get) => {
  const iniciais = ler();
  return {
    grupos: iniciais,
    mapa: mapaDeGrafias(iniciais),
    erro: false,
    unificar(canonico, grafias) {
      const alvo = texto(canonico);
      const todas = [...new Set([alvo, ...grafias.map(texto)])].filter(Boolean);
      if (!alvo || todas.length < 2) return;
      // Absorve grupos que já continham qualquer uma destas grafias, em vez de
      // deixar a mesma pessoa espalhada por dois grupos.
      const restantes: GrupoPessoa[] = [];
      const absorvidas: string[] = [];
      for (const g of get().grupos) {
        if (g.grafias.some((x) => todas.includes(x))) absorvidas.push(...g.grafias);
        else restantes.push(g);
      }
      const grupos = validarPessoas([...restantes, { canonico: alvo, grafias: [...new Set([...todas, ...absorvidas])] }]);
      set({ grupos, mapa: mapaDeGrafias(grupos), erro: gravar(grupos) });
    },
    desfazer(canonico) {
      const grupos = get().grupos.filter((g) => g.canonico !== canonico);
      set({ grupos, mapa: mapaDeGrafias(grupos), erro: gravar(grupos) });
    },
  };
});

// A store deriva a base ativa sozinha a partir deste mapa; aqui só publicamos
// as fusões, na carga e a cada alteração.
useEcoGradStore.getState().definirFusoes(usePessoas.getState().mapa);
usePessoas.subscribe((estado, anterior) => {
  if (estado.mapa !== anterior.mapa) useEcoGradStore.getState().definirFusoes(estado.mapa);
});
