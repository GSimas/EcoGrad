"""Revalidar evidências reais arquivadas. Não chama IA nem aplica decisões."""
from pathlib import Path
import json,hashlib
base=Path('docs/evidencias/ia-semantica'); output=[]
def record(file,original,result,scope):
 resumo=original['resumo']; onto=result.get('ontologia'); ev=result.get('evidencias',[])
 assert result['id']==original['id']
 if onto is None:
  output.append({'arquivo':str(base/file),'id':result['id'],'estado':'falha preservada','erro':result.get('erro')});return
 assert hashlib.sha256(resumo.encode()).hexdigest()==result['resumoSha256']
 expected={(c,t) for c,terms in onto.items() for t in terms}
 assert expected=={(e['categoria'],e['termo']) for e in ev}
 assert all(10<=len(e['trecho'].strip())<=1000 and e['trecho'] in resumo for e in ev)
 output.append({'arquivo':str(base/file),'arquivoSha256':hashlib.sha256((base/file).read_bytes()).hexdigest(),'id':result['id'],'titulo':original['titulo'],'resumoSha256':result['resumoSha256'],'ontologiaOriginal':onto,'evidenciasOriginais':ev,'validacaoTextual':'ID, hash e todos os trechos conferidos','avaliacaoPreliminar':scope,'aceiteCurador':'pendente','aplicado':False})
j=json.loads((base/'ia-real.json').read_text())
for e in j['execucoes']:
 if e['endpoint']!='gemini-ontology':continue
 original=e['entrada']['itens'][0]; result=json.loads(e['resposta'])['resultados'][0]
 scope='Análise econômica é sustentada em sentido amplo pelo objetivo de examinar custos e viabilidade; não especifica um procedimento detalhado. Curador deve avaliar granularidade e nomenclatura.' if 'madeira' in original['titulo'] else 'Abstenção coerente com o resumo informativo; não prova ausência de métodos no texto completo.'
 record('ia-real.json',original,result,scope)
j=json.loads((base/'metodo-final.json').read_text());record('metodo-final.json',j['entrada']['itens'][0],j['resposta']['resultados'][0],'Análise de variância e teste Tukey são explicitamente declarados como procedimentos utilizados. O desenho de blocos completos casualizados também está no resumo, mas foi omitido: extração não exaustiva. Não acrescentar automaticamente.')
j=json.loads((base/'revisao-ui.json').read_text());r=j['itens'][0];record('revisao-ui.json',{'id':r['id'],'titulo':r['titulo'],'resumo':r['fonte']['resumo']},{**r,'resumoSha256':r['fonte']['resumoSha256']},'Análise de custos tem apoio direto no objetivo declarado. É uma formulação ampla, sem procedimento específico explicitado. Conservar a proposta distinta da outra rodada; não normalizar silenciosamente.')
Path('docs/evidencias/bloco16/revisao-extracoes-reais.json').write_text(json.dumps({'escopo':'Revisão textual pelo agente de respostas reais arquivadas do bloco 14; não é nova execução Gemini nem aceite de especialista. Nenhum resultado aplicado.','casos':output},ensure_ascii=False,indent=2)+'\n')
print(f'{len(output)} registros auditados; originais preservados; nenhuma aplicação.')
