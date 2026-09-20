/**
 * Verificação contra o índice real. O contrato deste pacote é a API remota, e
 * um teste que a dispensasse não checaria nada: `node test.mjs`.
 */
import assert from 'node:assert/strict';
import { contarAcervo, panoramaTematico, obrasDoTema, resumosDasObras, consultar, dicionario } from './indice.mjs';

const TEMA = [['gestão do conhecimento']];

const [acervo] = await contarAcervo();
assert.ok(acervo.registros > 0, 'acervo vazio');
assert.ok(acervo.trabalhos_distintos <= acervo.registros, 'trabalho distinto não pode passar de registro');
assert.ok(acervo.base_version, 'índice sem carimbo de versão: carga interrompida');

const p = await panoramaTematico(TEMA, { amostra: 10 });
assert.ok(p.obras > 0, 'tema conhecido não casou nada');
assert.ok(p.amostra.length <= 10, 'amostra passou do pedido');
assert.equal(p.busca_por_significado, false, 'vetor não deveria entrar daqui');
// D2: a amostra é recorte, não total — quem soma a amostra erra a conta.
assert.ok(p.obras >= p.amostra.length, 'amostra maior que o conjunto');
assert.ok(p.amostra.every((o) => o.documento_id && o.titulo), 'obra da amostra sem id ou título');

const lista = await obrasDoTema(TEMA, { teto: 5 });
assert.ok(lista.ids.length <= 5, 'teto ignorado');
assert.ok(lista.com_resumo <= lista.obras, 'com resumo passou do total');

const resumos = await resumosDasObras(lista.ids.slice(0, 2));
assert.equal(resumos.length, Math.min(2, lista.ids.length), 'faltou resumo pedido');
assert.ok(resumos.every((o) => o.resumo?.length), 'resumo vazio numa obra listada como legível');

const q = await consultar('select count(*) as n from obras', 1);
assert.ok(Number(q.linhas[0].n) > 0, 'consulta SQL não contou obra nenhuma');
await assert.rejects(consultar('delete from documento'), /só é aceito SELECT/, 'escrita deveria ser recusada');
await assert.rejects(consultar('select 1; select 2'), /uma consulta por vez/, 'duas consultas deveriam ser recusadas');

const d = await dicionario();
assert.ok(d.linhas.length > 50, 'dicionário curto demais para descrever o esquema');

console.log(`ok — ${acervo.registros} registros, base ${acervo.base_version}; "${TEMA[0][0]}": ${p.obras} obras`);
