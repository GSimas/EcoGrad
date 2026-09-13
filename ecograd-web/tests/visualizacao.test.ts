import assert from 'node:assert/strict';
import { test } from 'node:test';
import { consultarLinhas, consultaInicial, celulaCSV, contextoPublicavel, csvComContexto, pacoteExportacao, valorNumericoTabela } from '../src/lib/visualizacao';

test('search and numeric sort preserve raw metrics, stable ties and missing values last', () => {
  const rows = [{nome:'Água',v:10},{nome:'água azul',v:2},{nome:'Água clara',v:2},{nome:'Outra',v:0},{nome:'água sem dado',v:null}];
  const before = JSON.stringify(rows);
  assert.deepEqual(consultarLinhas(rows,['nome','v'],{...consultaInicial,busca:'agua',coluna:'v'}).map((l)=>l.v),[2,2,10,null]);
  assert.deepEqual(consultarLinhas(rows,['nome','v'],{...consultaInicial,coluna:'v',direcao:'desc'}).map((l)=>l.v),[10,2,2,0,null]);
  assert.equal(JSON.stringify(rows),before);
  assert.deepEqual(consultarLinhas(rows,['nome'],{...consultaInicial,coluna:'unknown'}),rows);
});
test('formatted numeric strings sort numerically; tiny metrics do not display as zero', () => {
  const rows=[{v:'0.1'},{v:'0.0123'},{v:'10.0000'},{v:'2.0000'}];
  assert.deepEqual(consultarLinhas(rows,['v'],{...consultaInicial,coluna:'v'}).map((l)=>l.v),['0.0123','0.1','2.0000','10.0000']);
  assert.notEqual(valorNumericoTabela(0.000013),'0');
  assert.equal(valorNumericoTabela(0),'0');
});
test('exports include every filtered row, raw precision, column units and no unexpected fields', () => {
  const rows=Array.from({length:61},(_,i)=>({termo:'Nome completo '+i,valor:i/100000,interno:'excluir'}));
  const result=consultarLinhas(rows,['termo','valor'],{...consultaInicial,coluna:'valor',direcao:'desc'});
  const pkg=pacoteExportacao(result,[{chave:'termo',rotulo:'Termo completo'},{chave:'valor',rotulo:'Índice adimensional'}],{janela:[2020,2024]});
  assert.equal(pkg.dados.length,61); assert.equal(pkg.dados[0].valor,0.0006);
  assert.equal(pkg.dados[0].interno,undefined);
  assert.equal(pkg.colunas[1].rotulo,'Índice adimensional');
  const csv=csvComContexto(pkg);
  assert.equal(csv.split('\r\n').length,62);
  assert.ok(csv.includes('Contexto: janela')); assert.ok(csv.includes('[2020,2024]'));
});
test('CSV protects formulas in names and metadata, escapes quotes and keeps numeric negatives', () => {
  assert.equal(celulaCSV('=HYPERLINK("x")'),'"\'=HYPERLINK(""x"")"');
  assert.equal(celulaCSV('-nome'),'"\'-nome"');
  assert.equal(celulaCSV(-0.23),'"-0.23"');
  assert.equal(celulaCSV('texto,\n"citado"'),'"texto,\n""citado"""');
});
test('export context uses an allowlist and distinguishes unknown dates from observed years', () => {
  const state={baseVersion:'v1',programasSelecionados:['Coleção A'],cursosTccSelecionados:['TCC B'],rota:'dashboard',buscaTipo:'Documento',buscaTermo:'entidade de outra página',docs:[{ano:2020},{ano:null},{ano:2023}],chat:{entrada:'segredo'},ui:{'selecao.rascunho':'privado'},apiKey:'credencial'};
  const c=contextoPublicavel(state);const raw=JSON.stringify(c);
  assert.deepEqual(c.periodoObservado,[2020,2023]); assert.equal(c.dataColeta,'Não informada');assert.equal(c.entidade,null);
  for(const value of ['segredo','privado','credencial','entidade de outra página']) assert.ok(!raw.includes(value));
  assert.deepEqual(contextoPublicavel({...state,rota:'busca'}).entidade,{tipo:'Documento',nome:'entidade de outra página'});
});

test('term navigation follows the exact extractor of network, propagation or foresight', async () => {
  const {trabalhosDoTermo}=await import('../src/lib/visualizacao-termos');
  const doc={titulo:'Influência na vegetação',ano:2020,palavras_chave:['Água doce'],autores:[],orientador:'',co_orientadores:[],resumo:'',nivel_academico:'Outros',programa_origem:'TCC',url:'',macrotema:'',ontologia_ia:{teorias_e_modelos:['Teoria de Redes'],ferramentas_e_artefatos:[],metodos_e_tecnicas:[]}};
  const docs=[doc];const before=JSON.stringify(docs);
  assert.equal(trabalhosDoTermo(docs,'Influencia',{modo:'rede',fonte:'Palavras-chave'}).length,1);
  assert.equal(trabalhosDoTermo(docs,'Água Doce',{modo:'rede',fonte:'Palavras-chave'}).length,1);
  assert.equal(trabalhosDoTermo(docs,'Agua Doce',{modo:'rede',fonte:'Palavras-chave'}).length,0);
  assert.equal(trabalhosDoTermo(docs,'agua doce',{modo:'propagacao',fonte:'Palavras-chave'}).length,1);
  assert.equal(trabalhosDoTermo(docs,'Influencia',{modo:'foresight',tipo:'Palavra-chave'}).length,0);
  assert.equal(trabalhosDoTermo(docs,'Água doce',{modo:'foresight',tipo:'Palavra-chave'}).length,1);
  assert.equal(trabalhosDoTermo(docs,'Teoria De Redes',{modo:'rede',fonte:'Artefatos Extraídos'}).length,1);
  assert.equal(trabalhosDoTermo(docs,'Teoria de redes',{modo:'propagacao',fonte:'Artefatos Extraídos'}).length,1);
  assert.equal(trabalhosDoTermo(docs,'Teoria de Redes',{modo:'foresight',tipo:'Artefatos (Ontologia IA)'}).length,1);
  assert.equal(JSON.stringify(docs),before);
});
