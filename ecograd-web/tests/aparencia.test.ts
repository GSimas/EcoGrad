import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { adaptarGrafico } from '../src/lib/aparencia-graficos';
import { useAparencia, validarAparencia, resolverAparencia } from '../src/services/aparencia';
import { useEcoGradStore } from '../src/stores/useEcoGradStore';

test('chart theme and reduced motion preserve data, categories, functions and original options', () => {
  const formatter = (x: unknown) => String(x);
  const source = { animation:true, textStyle:{color:'#CBD5E1'}, xAxis:{data:['#CBD5E1', 'Termo completo']}, tooltip:{formatter,backgroundColor:'#161B22'}, series:[{animation:true, data:[0,1.23456789,NaN],itemStyle:{color:'#E74C3C'}}] };
  const result = adaptarGrafico(source,true,true);
  assert.notEqual(result,source);assert.equal(result.textStyle.color,'#334155');assert.equal(result.tooltip.backgroundColor,'#FFFFFF');
  assert.equal(result.tooltip.formatter,formatter);assert.deepEqual(result.xAxis.data,source.xAxis.data);assert.deepEqual(result.series[0].data,source.series[0].data);
  assert.equal(result.series[0].itemStyle.color,'#E74C3C');assert.equal(result.series[0].animation,false);assert.equal(source.animation,true);assert.equal(source.textStyle.color,'#CBD5E1');
});
test('invalid or old appearance preferences fall back without admitting arbitrary fields', () => {
  const padrao = {tema:'escuro',fonte:'sem-serifa',tamanho:'medio',movimento:'sistema',contraste:'padrao'};
  // `densidade` é a preferência aposentada: valores gravados antes são ignorados, não migrados.
  assert.deepEqual(validarAparencia({tema:'invalido',densidade:'compacta',fonte:'dislexica',tamanho:'grande',movimento:'reduzido',contraste:'alto',rascunho:'privado'}),
    {tema:'escuro',fonte:'dislexica',tamanho:'grande',movimento:'reduzido',contraste:'alto'});
  assert.deepEqual(validarAparencia(null), padrao);
  assert.deepEqual(validarAparencia({fonte:'gotica',tamanho:'gigante',contraste:'medio'}), padrao);
});
test('changing appearance never changes documents, drafts, IA, history UI or worker states, including storage failure', () => {
  const previous=useEcoGradStore.getState();
  useAparencia.getState().definir({tema:'claro',fonte:'serifada',tamanho:'grande',contraste:'alto',movimento:'reduzido'});
  assert.equal(useEcoGradStore.getState(),previous);assert.equal(useAparencia.getState().claro,true);assert.equal(useAparencia.getState().reduzir,true);
  assert.equal(useAparencia.getState().fonte,'serifada');assert.equal(useAparencia.getState().tamanho,'grande');assert.equal(useAparencia.getState().contraste,'alto');
  assert.equal(useAparencia.getState().erro,true); // No browser localStorage in this test; preferences still apply.
});
function luminance(rgb:number[]) { return rgb.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0); }
function contraste(a:number[],b:number[]) { const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05); }
test('both theme token palettes meet text 4.5:1 and control/focus 3:1 against their surfaces', () => {
  const css=readFileSync('src/index.css','utf8');
  for(const selector of [':root {', ':root[data-tema="claro"] {', ':root[data-contraste="alto"] {', ':root[data-contraste="alto"][data-tema="claro"] {']) {
    const block=css.slice(css.indexOf(selector)).split('}')[0];
    const tokens=Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(\d+ \d+ \d+);/g)].map(m=>[m[1],m[2].split(' ').map(Number)]));
    for(const surface of ['eco-bg','eco-panel']) {
      for(const name of ['slate-100','slate-200','slate-300','slate-400','slate-500','eco-accent','info','warning','error','success','tipo-documento','tipo-pessoa','tipo-tema']) assert.ok(contraste(tokens[name],tokens[surface])>=4.5,`${selector} ${name}/${surface}`);
      assert.ok(contraste(tokens['control-border'],tokens[surface])>=3,`${selector} control/${surface}`);
    }
  }
});

test('system reduced motion always takes priority; system theme follows OS without changing explicit themes', () => {
  const base=validarAparencia({tema:'sistema'});
  assert.deepEqual(resolverAparencia(base,true,true),{claro:true,reduzir:true});
  assert.deepEqual(resolverAparencia(base,false,false),{claro:false,reduzir:false});
  assert.deepEqual(resolverAparencia({...base,tema:'escuro'},true,true),{claro:false,reduzir:true});
  assert.deepEqual(resolverAparencia({...base,tema:'claro',movimento:'reduzido'},false,false),{claro:true,reduzir:true});
});
