import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Documento } from '../src/types';
import { coberturaRadar, corteEfetivo, motivoRadarVazio, LEITURA_QUADRANTE, LEITURA_VEREDITO } from '../src/lib/interpretacao';
import { prepararRadarForesight, segmentarPorKMeans, segmentarPorPercentil } from '../src/lib/foresight-math';
import { calcularMetricasMemeticas, tempoDeMeiaVida } from '../src/lib/memetics';
const doc = (ano:number|null, titulo='Trabalho'):Documento => ({ano,titulo,nivel_academico:'Outros',autores:[],orientador:'',co_orientadores:[],palavras_chave:['ecologia'],macrotema:'',resumo:'',programa_origem:'TCC',url:''});
test('coverage follows scientific inclusive cutoff, excluding undated records without mutation',()=>{
 const docs=[doc(2010),doc(2023),doc(2024),doc(2026),doc(null)];
 const before=JSON.stringify(docs);const c=coberturaRadar(docs,3,'Palavra-chave');
 assert.deepEqual(c,{primeiro:2010,ultimo:2026,corte:2023,passado:2,recente:2,semAno:1,comTermosDatados:4,limiteOcorrencias:10});
 const result=prepararRadarForesight(docs,{},3);assert.equal(result[0].Total,4);assert.equal(result[0]['Aparições Recentes'],2);assert.equal(JSON.stringify(docs),before);
});
test('empty guidance distinguishes absent years, absent dimension, unsplit periods and frequency exclusions',()=>{
 assert.match(motivoRadarVazio(coberturaRadar([doc(null)],3,'Palavra-chave')),/anos válidos/);
 assert.match(motivoRadarVazio(coberturaRadar([doc(2020)],3,'Artefatos (Ontologia IA)')),/Não há termos/);
 assert.match(motivoRadarVazio(coberturaRadar([doc(2020)],3,'Palavra-chave')),/dois períodos/);
 assert.match(motivoRadarVazio(coberturaRadar([doc(2010),doc(2026)],3,'Palavra-chave')),/cortes de frequência/);
});
test('effective method reports the existing K-Means fallback and keeps raw categories',()=>{
 const rows=prepararRadarForesight([doc(2010),doc(2024),doc(2026)],{},3);
 assert.deepEqual(segmentarPorKMeans(rows),segmentarPorPercentil(rows,.65));
 assert.equal(corteEfetivo(true,rows.length,.9).percentil,.65);
 assert.equal(corteEfetivo(false,rows.length,.9).percentil,.9);
 assert.equal(corteEfetivo(true,4,.9).percentil,null);
 assert.match(corteEfetivo(true,0,.9).metodo,/Aguardando/);
 assert.equal(Object.keys(LEITURA_VEREDITO).length,8);
 assert.match(LEITURA_VEREDITO['✓ Confirmado (Caiu/Morreu)'],/variação ≤ 0% ou volume posterior < 3/);
 for(const row of segmentarPorKMeans(rows).linhas) assert.ok(LEITURA_QUADRANTE[row.Quadrante!]);
});
test('memetic presentation distinguishes zero-year spans, absent spans and zero-title complement',()=>{
 const sameYear=calcularMetricasMemeticas([doc(2020,'A'),doc(2020,'B')]);
 assert.equal(sameYear.longevidade[0].tempo_vida_anos,0);
 assert.equal(tempoDeMeiaVida(sameYear.longevidade),0);
 const undated=calcularMetricasMemeticas([doc(null,'A'),doc(null,'B')]);assert.equal(undated.longevidade.length,0);
 const missingTitle=calcularMetricasMemeticas([doc(2020,'')]);assert.equal(missingTitle.fecundidade[0].fecundidade,0);assert.equal(missingTitle.sobreviventes,1);
 const duplicate=calcularMetricasMemeticas([doc(2010,'A'),doc(2020,'A')]);assert.equal(duplicate.mortalidade,1);assert.equal(duplicate.longevidade.length,0);
});
