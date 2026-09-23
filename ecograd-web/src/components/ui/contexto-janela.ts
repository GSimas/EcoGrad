import { createContext, useContext } from 'react';

/**
 * Diz a um bloco se ele está dentro da janela aberta por `BlocoEmJanela`. Lá o
 * título da janela já nomeia o bloco, e gráficos, tabelas e redes guardam as
 * descrições e instruções numa dica "i" em vez de letra miúda.
 *
 * Módulo à parte, sem dependências: `Tabela` e `Grafico` o leem, e importá-lo
 * de `BlocoEmJanela` fecharia um ciclo com `primitives`.
 */
export const EmJanela = createContext(false);
export const useEmJanela = () => useContext(EmJanela);
