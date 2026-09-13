from pathlib import Path
import tomllib,json,fnmatch,subprocess
c=tomllib.loads(Path('netlify.toml').read_text());b=c['build']; assert b['base']=='ecograd-web' and b['publish']=='dist' and b['command']=='npm run build'
assert c['functions']['directory']==b['functions']=='netlify/functions'
assert b['environment']['NODE_VERSION']=='24'
assert c['redirects'][0]=={'from':'/api/*','to':'/.netlify/functions/:splat','status':200}
assert c['redirects'][1]=={'from':'/*','to':'/index.html','status':200}
p=json.loads(Path('ecograd-web/package.json').read_text());lock=json.loads(Path('ecograd-web/package-lock.json').read_text())['packages'][''];assert p['engines']==lock['engines']=={'node':'>=24 <25'}
assert p['dependencies']==lock['dependencies'] and p['devDependencies']==lock['devDependencies']
assert Path('ecograd-web/.nvmrc').read_text().strip()=='24'
headers={}
for url in ['/index.html','/data/manifest.json','/data/colecoes-cobertura.json','/data/base_consolidada_ufsc.json.gz','/data/base_tcc_ufsc.json.gz','/data/colecao-abc.json.gz','/assets/index-abc.js']:
 values={}
 for h in c['headers']:
  if fnmatch.fnmatchcase(url,h['for']):
   for k,v in h['values'].items():
    assert k not in values or values[k]==v, (url,k,'headers conflitantes')
    values[k]=v
 headers[url]=values
 cache=values['Cache-Control'];assert ('immutable' in cache)==(url.startswith('/assets/') or url.startswith('/data/colecao-'))
 assert values['X-Content-Type-Options']=='nosniff'
siteIds=[]
for f in [Path('.netlify/state.json'),Path('ecograd-web/.netlify/state.json')]:
 if f.exists():
  v=json.loads(f.read_text()).get('siteId')
  if v:siteIds.append(v)
out={'nodeLocal':subprocess.check_output(['node','-v'],text=True).strip(),'nodeBuild':'24','engineLockfileCoerentes':True,'rotasOrdenadas':True,'headersEsperados':headers,'siteIdLocalEncontrado':bool(siteIds),'runtimeRemoto':'não verificado; requer site e configuração AWS_LAMBDA_JS_RUNTIME no provedor','variaveisServidorNecessarias':['GEMINI_API_KEY','NEO4J_URI','NEO4J_USERNAME','NEO4J_PASSWORD'],'segredosLidos':False}
Path('docs/evidencias/bloco17/config.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n');print('Configuração estática válida; destino remoto não identificado.' if not siteIds else 'Configuração estática válida; site vinculado.')
