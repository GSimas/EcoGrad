// Inspect the actual build entry, not the development server or a synthetic browser timing.
import {readFile,readdir,stat} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const dist=fileURLToPath(new URL('../dist/',import.meta.url));const html=await readFile(resolve(dist,'index.html'),'utf8');
const entry=[...html.matchAll(/(?:src|href)="(\/assets\/[^\"]+\.js)"/g)].map(m=>m[1]);
const initial=[];for(const name of entry){const b=await readFile(resolve(dist,'.'+name));initial.push({arquivo:name,bytes:b.length,gzip:gzipSync(b).length});}
const all=await readdir(resolve(dist,'assets'));const deferred=all.filter(n=>n.endsWith('.js')&&!entry.some(e=>e.endsWith('/'+n))&&!n.includes('.worker-'));
const bases=[],colecoes=[];for(const name of await readdir(resolve(dist,'data')))if(name.endsWith('.gz'))(name.startsWith('colecao-')?colecoes:bases).push({arquivo:name,bytes:(await stat(resolve(dist,'data',name))).size});
if(entry.some(n=>/echarts|forcegraph/i.test(n)))throw new Error('Regressão: biblioteca de visualização carregada antes de ser usada.');
console.log(JSON.stringify({escopo:'JS inicial referenciado pelo HTML de produção; gzip calculado, não tempo de carregamento nem tráfego medido',initial,totais:initial.reduce((a,x)=>({bytes:a.bytes+x.bytes,gzip:a.gzip+x.gzip}),{bytes:0,gzip:0}),adiados:deferred,bases,colecoes:{arquivos:colecoes.length,bytes:colecoes.reduce((n,c)=>n+c.bytes,0),nota:'Entrega sob demanda; a seleção não baixa todas as coleções nem as bases completas.'}},null,2));
