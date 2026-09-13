import json,subprocess,tempfile,hashlib,statistics,gzip
from pathlib import Path
m=json.loads(Path('ecograd-web/public/data/manifest.json').read_text())
selected=[next(e for e in m['collections'][kind] if e['nome']==name) for kind,name in [('ppg','Programa de Pós-Graduação em Ecologia'),('tcc','TCC Administração Pública EAD')]]
runs=[]
for i in range(3):
 files=[]
 for e in selected:
  with tempfile.NamedTemporaryFile() as f:
   p=subprocess.run(['curl','--fail','--silent','--show-error','--limit-rate','125000','--max-time','30','--output',f.name,'--write-out','%{json}','http://localhost:8888'+e['path']],capture_output=True,text=True,check=True)
   r=json.loads(p.stdout); data=Path(f.name).read_bytes(); assert len(data)==e['bytes']; assert hashlib.sha256(gzip.decompress(data)).hexdigest()==e['sha256']
   files.append({'colecao':e['nome'],'bytes':len(data),'sha256':e['sha256'],'tempoSegundos':r['time_total'],'http':r['http_code']})
 runs.append({'repeticao':i+1,'arquivos':files,'totalSegundos':sum(f['tempoSegundos'] for f in files)})
out={'escopo':'Transferência HTTP local via curl com limit-rate 125000 bytes/s; sem navegador, latência adicional, upload condicionado ou dispositivo físico. Curl pode ter rajadas em arquivos pequenos. Não mede carregamento da aplicação, frio/quente, LCP, INP ou CLS.','baseVersion':m['version'],'bytesDocumentos':sum(e['bytes'] for e in selected),'execucoes':runs,'medianaSegundos':statistics.median(r['totalSegundos'] for r in runs),'piorSegundos':max(r['totalSegundos'] for r in runs)}
Path('docs/evidencias/bloco16/transferencia-limitada.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n');print(json.dumps(out,ensure_ascii=False))
