import {spawnSync} from 'node:child_process';
import {readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const cwd=fileURLToPath(new URL('..',import.meta.url));
const tests=fileURLToPath(new URL('../node_modules/.cache/capes-tests/tests/',import.meta.url));
for(const file of [...readdirSync(tests).filter(n=>n.endsWith('.test.js')).map(n=>tests+n),...['collection-metadata.test.mjs','collection-shards.test.mjs','collection-batches.test.mjs','orientacoes-index.test.mjs','busca-index.test.mjs','panorama-acervo.test.mjs'].map(n=>fileURLToPath(new URL('../tests/'+n,import.meta.url)))]){
 const result=spawnSync(process.execPath,[file],{cwd,encoding:'utf8'});
 console.log(result.status===0?result.stdout.trim():result.stdout+result.stderr);
 if(result.status!==0)process.exit(result.status??1);
}
