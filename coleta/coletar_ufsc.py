"""Coleta semanal e incremental do Repositório Institucional da UFSC (DSpace).

Fonte principal: OAI-PMH do DSpace, com resumo, palavras-chave, orientação e coleção.
Quando a RedeUFSC barra o acesso (verificação anti-robô para quem está fora da rede ou sem
VPN), usa a API do Oasisbr/IBICT, que agrega o mesmo repositório mas não traz resumo nem a
coleção. Esses registros saem com `metadados_incompletos` e são substituídos quando uma coleta
pelo DSpace alcançar o mesmo período (o estado do DSpace só avança quando ele responde).

As bases não são reescritas: cada execução grava um lote em `coletas/` com inclusões e remoções
por handle, aplicado em ordem por `ecograd-web/scripts/sync-data.mjs`.

Uso:
  python coleta/coletar_ufsc.py [--fonte auto|dspace|oasisbr] [--desde AAAA-MM-DD]
  python coleta/coletar_ufsc.py --reclassificar-tccs   # uma vez: tipo próprio para os TCCs da base
"""
import argparse
import datetime as dt
import difflib
import gzip
import json
import os
import re
import sys
import time
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
PASTA_COLETAS = RAIZ / 'coletas'
ARQ_ESTADO = PASTA_COLETAS / 'estado.json'
ARQ_PPG, ARQ_TCC = RAIZ / 'base_consolidada_ufsc.json.gz', RAIZ / 'base_tcc_ufsc.json.gz'
ARQ_PROGRAMAS, ARQ_MAPA_TCC = RAIZ / 'programas_ufsc.json', RAIZ / 'mapa_colecoes_tcc.json'
PADRAO_LOTE = re.compile(r'^\d{4}-\d{2}-\d{2}T\d{6}Z\.json\.gz$')

OAI = 'https://repositorio.ufsc.br/oai/request'
OASISBR = 'https://oasisbr.ibict.br/vufind/api/v1/search'
AGENTE = {'User-Agent': 'EcoGrad-coleta/1.0 (+https://github.com/GSimas/Ecology-Graph)'}

TESE, DISSERTACAO = 'Tese (Doutorado)', 'Dissertação (Mestrado)'
TCC_GRADUACAO, TCC_ESPECIALIZACAO = 'TCC (Graduação)', 'TCC (Especialização)'


# --- Normalização: mesmas regras do pipeline_ufsc.py, para a base continuar homogênea
def sem_acentos(texto):
    return ''.join(c for c in unicodedata.normalize('NFD', texto or '') if unicodedata.category(c) != 'Mn')


def normalizar_nome(nome):
    return sem_acentos(nome).strip().title() if nome else ''


def normalizar_palavra_chave(pk):
    return sem_acentos(pk.lower().strip()) if pk else ''


def extrair_melhor_ano(datas):
    anos = [int(m) for d in datas for m in re.findall(r'\b(19\d{2}|20\d{2})\b', str(d))]
    return str(min(anos)) if anos else None


def handle_de(texto):
    """Handle do DSpace a partir do identificador OAI ou da URL (inclusive /xmlui/handle/)."""
    m = re.search(r'(?:handle/|:)(\d+/\d+)\b', texto or '')
    return m.group(1) if m else None


def classificar_nivel(tipos, colecao_tcc=None):
    """Nível pelo dc.type do registro; em coleções de TCC, graduação ou especialização.
    O título não entra: 'síntese' e 'hipótese' marcavam trabalhos como tese na regra antiga."""
    t = ' '.join(tipos)
    if colecao_tcc is not None or re.search(r'bachelor|\btcc|conclus[aã]o de curso', t, re.I):
        return TCC_ESPECIALIZACAO if re.search(r'especializ|tccesp', f'{colecao_tcc or ""} {t}', re.I) else TCC_GRADUACAO
    if re.search(r'doctoral|\btese\b|doutorado', t, re.I):
        return TESE
    if re.search(r'master|disserta|mestrado', t, re.I):
        return DISSERTACAO
    return None


def chave(texto):
    """Nome de coleção comparável: sem acento, caixa e prefixos como 'TCC' ou 'Programa de Pós-Graduação em'."""
    t = sem_acentos(texto).lower()
    t = re.sub(r'\btcc\b|programa de pos-graduacao em|programa de pos-graduacao|curso de especializacao em|'
               r'curso de graduacao em|curso de|especializacao em|especializacao|graduacao em|[-–:]', ' ', t)
    return re.sub(r'\s+', ' ', t).strip()


class Catalogo:
    """Coleções conhecidas (setSpec → nome) de pós-graduação e de TCC; registra as coleções novas."""

    def __init__(self, programas, mapa_tcc):
        self.programas, self.mapa_tcc = programas, mapa_tcc
        self.ppg = {spec: nome for nome, spec in programas.items()}
        self.tcc = {c['setSpec']: c['curso'] for c in mapa_tcc if c.get('setSpec') and c.get('curso')}
        self.novas, self._notas = [], {}

    def colecao(self, spec, nome_set, nivel):
        """(tipo, nome) da coleção, com tipo 'ppg' ou 'tcc'; None se ela não reúne teses, dissertações ou TCCs."""
        if spec in self.ppg:
            return 'ppg', self.ppg[spec]
        if spec in self.tcc:
            return 'tcc', self.tcc[spec]
        tipo = 'tcc' if nivel in (TCC_GRADUACAO, TCC_ESPECIALIZACAO) else 'ppg' if nivel in (TESE, DISSERTACAO) else None
        if not tipo or not nome_set or not spec.startswith('col_'):
            return None
        nome = nome_set.strip()
        if tipo == 'tcc':
            nome = nome if nome.upper().startswith('TCC') else f'TCC {nome}'
            nome = f'{nome} ({spec})' if nome in self.tcc.values() else nome
            self.mapa_tcc.append({'curso': nome, 'setSpec': spec, 'handle': spec[4:].replace('_', '/')})
            self.tcc[spec] = nome
        else:
            nome = f'{nome} ({spec})' if nome in self.programas else nome
            self.programas[nome] = spec
            self.ppg[spec] = nome
        self.novas.append((tipo, nome))
        return tipo, nome

    def colecao_pela_nota(self, nota, tipo):
        """Coleção citada na nota de defesa do Oasisbr, que não informa a coleção do DSpace."""
        if (nota, tipo) not in self._notas:
            chaves = {}
            for nome in (self.programas if tipo == 'ppg' else self.tcc.values()):
                chaves.setdefault(chave(nome), nome)
            trechos = re.findall(r'(?:curso de|programa de p[óo]s-gradua[çc][ãa]o)[^,.;]*', nota, re.I) + re.split(r'[,;.]', nota)
            melhor, nota_melhor = None, 0.0
            for trecho in trechos:
                for alvo in {chave(trecho), chave(re.sub(r'\([^)]*\)', '', trecho))} - {''}:
                    for achado in difflib.get_close_matches(alvo, list(chaves), n=1, cutoff=0.85):
                        razao = difflib.SequenceMatcher(None, alvo, achado).ratio()
                        if razao > nota_melhor:
                            melhor, nota_melhor = chaves[achado], razao
            self._notas[(nota, tipo)] = melhor
        return self._notas[(nota, tipo)]


# --- DSpace (OAI-PMH)
def motivo_bloqueio(status, corpo):
    """None quando a resposta é OAI-PMH; senão o motivo, em especial o bloqueio da RedeUFSC."""
    if status == 200 and '<OAI-PMH' in corpo[:5000]:
        return None
    if re.search(r'RedeUFSC|turnstile', corpo, re.I):
        return 'o DSpace exige a verificação anti-robô da RedeUFSC (acesso de fora da rede da UFSC ou sem VPN)'
    return f'resposta inesperada do DSpace (HTTP {status})'


def diagnosticar_dspace():
    import requests
    try:
        r = requests.get(OAI, params={'verb': 'Identify'}, headers=AGENTE, timeout=60)
    except requests.RequestException as e:
        return f'sem resposta do DSpace ({type(e).__name__})'
    return motivo_bloqueio(r.status_code, r.text)


def limpar_meta(meta):
    """O Sickle devolve None para elemento Dublin Core vazio (ex.: <dc:type/>); descarta esses valores."""
    return {k: [v for v in vs if v] for k, vs in (meta or {}).items()}


def registro_dspace(meta, colecao, nivel, handle):
    contrib = [normalizar_nome(c) for c in meta.get('contributor', []) if 'ufsc' not in c.lower() and 'universidade' not in c.lower()]
    descricoes = meta.get('description', [])
    return {
        'titulo': (meta.get('title') or [''])[0].strip(),
        'nivel_academico': nivel,
        'autores': [normalizar_nome(a) for a in meta.get('creator', []) if a.strip()],
        'orientador': contrib[0] if contrib else None,
        'co_orientadores': contrib[1:],
        'palavras_chave': sorted({p for p in map(normalizar_palavra_chave, meta.get('subject', [])) if p}),
        'ano': extrair_melhor_ano(meta.get('date', [])),
        'resumo': max(descricoes, key=len) if descricoes else '',
        'programa_origem': colecao,
        'url': next((i for i in meta.get('identifier', []) if str(i).startswith('http')), f'https://repositorio.ufsc.br/handle/{handle}'),
        'fonte': 'dspace',
    }


def registros_do_item(meta, specs, nomes_sets, catalogo, handle):
    """Um registro por coleção de teses, dissertações ou TCCs em que o item está, como na base atual."""
    tipos, saida = meta.get('type', []), []
    for spec in specs:
        colecao = catalogo.colecao(spec, nomes_sets.get(spec), classificar_nivel(tipos))
        if not colecao:
            continue
        tipo, nome = colecao
        nivel = classificar_nivel(tipos, colecao_tcc=nome) if tipo == 'tcc' else classificar_nivel(tipos)
        if tipo == 'ppg' and nivel not in (TESE, DISSERTACAO):
            continue
        saida.append((tipo, registro_dspace(meta, nome, nivel, handle)))
    return saida


def coletar_dspace(desde, catalogo):
    from sickle import Sickle
    from sickle.oaiexceptions import NoRecordsMatch
    # ponytail: o Sickle não tem prazo total por página; o timeout-minutes do job é o teto.
    oai = Sickle(OAI, max_retries=3, timeout=(15, 60), headers=AGENTE)
    nomes_sets = {s.setSpec: s.setName for s in oai.ListSets()}
    lote, removidos, vistos, ultimo = {'ppg': [], 'tcc': []}, set(), set(), None
    try:
        for i, item in enumerate(oai.ListRecords(metadataPrefix='oai_dc', **{'from': desde}), 1):
            if i % 500 == 0:
                print(f'  ...{i} itens lidos do DSpace', flush=True)
            ultimo = max(ultimo or '', item.header.datestamp[:10])
            handle = handle_de(item.header.identifier)
            if not handle:
                continue
            if item.header.deleted:
                removidos.add(handle)
                continue
            meta = limpar_meta(item.metadata)
            if not (meta.get('title') or [''])[0].strip():
                continue
            for tipo, registro in registros_do_item(meta, item.header.setSpecs, nomes_sets, catalogo, handle):
                if (handle, registro['programa_origem']) not in vistos:
                    vistos.add((handle, registro['programa_origem']))
                    lote[tipo].append(registro)
    except NoRecordsMatch:
        pass
    return lote, removidos, Counter(), ultimo


# --- Oasisbr/IBICT (reserva)
def primeiro(valor):
    return (valor[0] if valor else '') if isinstance(valor, list) else (valor or '')


def registro_oasisbr(bruto, catalogo):
    """(tipo, registro) de um item do Oasisbr, ou (None, motivo para ignorar)."""
    handle = handle_de(bruto.get('oai_identifier_str', ''))
    titulo = primeiro(bruto.get('title')).strip()
    if not handle or not titulo:
        return None, 'sem handle ou título'
    formatos = bruto.get('format') or []
    nota = ' '.join(bruto['description']) if isinstance(bruto.get('description'), list) else bruto.get('description') or ''
    tcc = 'bachelorThesis' in formatos
    colecao = catalogo.colecao_pela_nota(nota, 'tcc' if tcc else 'ppg')
    if not colecao:
        return None, 'coleção não identificada na nota'
    nivel = classificar_nivel(formatos + [nota], colecao_tcc=colecao if tcc else None)
    if not tcc and nivel not in (TESE, DISSERTACAO):
        return None, 'tipo fora do escopo'
    orientadores = bruto.get('dc.contributor.advisor1.fl_str_mv') or []
    return ('tcc' if tcc else 'ppg'), {
        'titulo': titulo,
        'nivel_academico': nivel,
        'autores': [normalizar_nome(a) for a in (bruto.get('dc.contributor.author.fl_str_mv') or bruto.get('author') or []) if a.strip()],
        'orientador': normalizar_nome(orientadores[0]) if orientadores else None,
        'co_orientadores': [normalizar_nome(c) for c in bruto.get('dc.contributor.advisor-co1.fl_str_mv') or []],
        'palavras_chave': sorted({p for p in map(normalizar_palavra_chave, bruto.get('topic') or []) if p}),
        'ano': extrair_melhor_ano(bruto.get('dc.date.issued.fl_str_mv') or bruto.get('publishDate') or []),
        'resumo': '',
        'programa_origem': colecao,
        'url': primeiro(bruto.get('url')) or f'https://repositorio.ufsc.br/handle/{handle}',
        'fonte': 'oasisbr',
        'metadados_incompletos': True,
    }


def baixar_texto(url, params, tentativas=3, prazo=90):
    """GET com prazo total por tentativa. O timeout do requests só vale entre leituras: um servidor que
    entrega bytes a conta-gotas prenderia a coleta por horas (aconteceu com o Oasisbr)."""
    import requests
    for tentativa in range(1, tentativas + 1):
        inicio = time.monotonic()
        try:
            with requests.get(url, params=params, headers=AGENTE, timeout=(15, 30), stream=True) as r:
                r.raise_for_status()
                partes = []
                for parte in r.iter_content(65536):
                    partes.append(parte)
                    if time.monotonic() - inicio > prazo:
                        raise TimeoutError(f'resposta não terminou em {prazo}s')
                return b''.join(partes).decode('utf-8', errors='replace')
        except (requests.RequestException, TimeoutError) as e:
            if tentativa == tentativas:
                raise RuntimeError(f'Falha ao consultar {url} após {tentativas} tentativas: {e}') from None
            print(f'  ...tentativa {tentativa} falhou ({e}); repetindo', flush=True)
            time.sleep(10 * tentativa)


def coletar_oasisbr(desde, catalogo, handles_conhecidos):
    """Itens depositados desde `desde`. A API não filtra por data de depósito: busca pelo ano de publicação
    (ano anterior em diante) e filtra o depósito aqui. Devolve também o depósito mais recente que o Oasisbr
    conhece. ponytail: depósitos tardios de anos mais antigos ficam de fora até o DSpace voltar a responder."""
    base = [('filter[]', 'institution:"UFSC"'), ('filter[]', '~format:"bachelorThesis"'), ('filter[]', '~format:"masterThesis"'),
            ('filter[]', '~format:"doctoralThesis"'), ('filter[]', f'publishDate:"[{int(desde[:4]) - 1} TO *]"'),
            ('field[]', 'rawData'), ('limit', '100')]
    lote, ignorados, vistos, pagina, ultimo = {'ppg': [], 'tcc': []}, Counter(), set(), 1, ''
    while True:
        texto = baixar_texto(OASISBR, base + [('page', str(pagina))])
        try:  # a API às vezes antecede o JSON com um aviso de sessão em texto
            dados = json.loads(texto[texto.index('{'):])
        except ValueError:
            raise RuntimeError('O Oasisbr não devolveu JSON (possível verificação anti-robô).') from None
        if dados.get('status') != 'OK':
            raise RuntimeError(f"Oasisbr: {dados.get('statusMessage', 'resposta inválida')}")
        itens = dados.get('records') or []
        for bruto in (i.get('rawData') or {} for i in itens):
            handle = handle_de(bruto.get('oai_identifier_str', ''))
            depositado = primeiro(bruto.get('dc.date.accessioned.fl_str_mv'))[:10]
            ultimo = max(ultimo, depositado)
            if depositado < desde:
                ignorados['depositados antes do período'] += 1
                continue
            if handle in handles_conhecidos or handle in vistos:
                ignorados['já na base' if handle in handles_conhecidos else 'repetido'] += 1
                continue
            tipo, registro = registro_oasisbr(bruto, catalogo)
            if tipo:
                vistos.add(handle)
                lote[tipo].append(registro)
            else:
                ignorados[registro] += 1
        print(f'  ...página {pagina} do Oasisbr ({dados.get("resultCount")} itens no recorte)', flush=True)
        # A API segue devolvendo páginas cheias depois do fim do recorte: o total decide a parada.
        if len(itens) < 100 or pagina * 100 >= int(dados.get('resultCount') or 0):
            return lote, set(), ignorados, ultimo
        pagina += 1
        time.sleep(1)


# --- Temas, lotes e armazenamento
def completar_temas(novos, base):
    """Macrotema e área dos registros novos a partir do trabalho mais parecido da mesma coleção.
    ponytail: vizinho mais próximo por TF-IDF mantém os rótulos estáveis entre coletas; recalcular ou
    renomear os temas da base inteira continua sendo papel do pipeline_ufsc.py (NMF + Gemini)."""
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import linear_kernel
    texto = lambda d: f"{d.get('titulo', '')} {' '.join(d.get('palavras_chave') or [])} {d.get('resumo', '')}"
    referencia, grupos = defaultdict(list), defaultdict(list)
    for d in base:
        if d.get('macrotema'):
            referencia[d.get('programa_origem')].append(d)
    for d in novos:
        grupos[d['programa_origem']].append(d)
    for colecao, grupo in grupos.items():
        ref = referencia.get(colecao)
        area = f"Graduação - {colecao.replace('TCC', '').strip()}" if grupo[0]['nivel_academico'].startswith('TCC') else 'Multidisciplinar / Transversal'
        if not ref:
            for d in grupo:
                d['macrotema'], d['ecossistema_afinidade'] = '', area
            continue
        vetor = TfidfVectorizer(max_features=20000, strip_accents='unicode').fit([texto(d) for d in ref + grupo])
        semelhanca = linear_kernel(vetor.transform([texto(d) for d in grupo]), vetor.transform([texto(d) for d in ref]))
        frequente = Counter(d['macrotema'] for d in ref).most_common(1)[0][0]
        for d, linha in zip(grupo, semelhanca):
            d['macrotema'] = ref[linha.argmax()]['macrotema'] if linha.max() > 0 else frequente
            d['ecossistema_afinidade'] = ref[0].get('ecossistema_afinidade') or area


def aplicar_coletas(bases, lotes):
    """Mesma regra de ecograd-web/scripts/collection-batches.mjs: um handle presente no lote
    (incluído, atualizado ou removido) substitui todos os registros anteriores com ele."""
    ppg, tcc = bases['ppg'], bases['tcc']
    for lote in lotes:
        trocados = (set(lote['removidos']) | {handle_de(r.get('url')) for r in lote['ppg'] + lote['tcc']}) - {None}
        ppg = [r for r in ppg if handle_de(r.get('url')) not in trocados] + lote['ppg']
        tcc = [r for r in tcc if handle_de(r.get('url')) not in trocados] + lote['tcc']
    return {'ppg': ppg, 'tcc': tcc}


def ler_json(caminho, padrao=None):
    return json.loads(caminho.read_text(encoding='utf-8')) if caminho.exists() else padrao


def gravar_json(caminho, dados, indent=4):
    caminho.write_text(json.dumps(dados, ensure_ascii=False, indent=indent) + '\n', encoding='utf-8')


def ler_gz(caminho):
    with gzip.open(caminho, 'rt', encoding='utf-8') as f:
        return json.load(f)


def gravar_gz(caminho, dados):
    # mtime=0: o mesmo conteúdo gera os mesmos bytes e o mesmo hash no manifesto do site.
    with gzip.GzipFile(caminho, 'wb', mtime=0) as f:
        f.write(json.dumps(dados, ensure_ascii=False).encode('utf-8'))


def lotes_existentes():
    return [ler_gz(p) for p in sorted(PASTA_COLETAS.glob('*.json.gz')) if PADRAO_LOTE.match(p.name)]


def resumir(fonte, desde, lote, removidos, ignorados, novas, ultimo=None):
    registros = lote['ppg'] + lote['tcc']
    linhas = [f'## Coleta do Repositório UFSC ({fonte}, depósitos desde {desde})', '',
              f'- Novos ou atualizados: {len(registros)}',
              *(f'  - {nivel}: {n}' for nivel, n in sorted(Counter(r['nivel_academico'] for r in registros).items())),
              f'- Removidos do repositório: {len(removidos)}',
              f'- Coleções novas: {len(novas)}', *(f'  - {tipo.upper()}: {nome}' for tipo, nome in novas),
              *([f'- Item mais recente no índice da fonte: {ultimo} (a próxima coleta parte daqui)'] if ultimo else []),
              *(f'- Ignorados ({motivo}): {n}' for motivo, n in ignorados.items())]
    if fonte == 'oasisbr':
        linhas.append('- Aviso: o DSpace estava inacessível. Registros do Oasisbr vêm sem resumo e com a coleção deduzida '
                      'da nota de defesa; serão substituídos quando o DSpace responder.')
    texto = '\n'.join(linhas)
    print(texto)
    if os.environ.get('GITHUB_STEP_SUMMARY'):
        with open(os.environ['GITHUB_STEP_SUMMARY'], 'a', encoding='utf-8') as f:
            f.write(texto + '\n')


def reclassificar_tccs():
    """Uma vez: troca 'Outros' (e as teses falsas por 'síntese'/'hipótese') pelo tipo de TCC da coleção."""
    tcc = ler_gz(ARQ_TCC)
    antes = Counter(d.get('nivel_academico') for d in tcc)
    for d in tcc:
        d['nivel_academico'] = classificar_nivel([], colecao_tcc=d.get('programa_origem') or '')
    gravar_gz(ARQ_TCC, tcc)
    print(f'{ARQ_TCC.name}: {dict(antes)} -> {dict(Counter(d["nivel_academico"] for d in tcc))}')
    return 0


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--fonte', choices=['auto', 'dspace', 'oasisbr'], default='auto')
    parser.add_argument('--desde', type=lambda s: dt.date.fromisoformat(s).isoformat(), help='AAAA-MM-DD; padrão: coletas/estado.json')
    parser.add_argument('--reclassificar-tccs', action='store_true')
    args = parser.parse_args(argv)
    if args.reclassificar_tccs:
        return reclassificar_tccs()

    agora = dt.datetime.now(dt.timezone.utc)
    estado = ler_json(ARQ_ESTADO, {})
    catalogo = Catalogo(ler_json(ARQ_PROGRAMAS), ler_json(ARQ_MAPA_TCC))
    bases = aplicar_coletas({'ppg': ler_gz(ARQ_PPG), 'tcc': ler_gz(ARQ_TCC)}, lotes_existentes())
    motivo = 'fonte Oasisbr escolhida manualmente' if args.fonte == 'oasisbr' else diagnosticar_dspace()

    if motivo is None:
        fonte, desde = 'dspace', args.desde or estado['dspace_desde']
        lote, removidos, ignorados, ultimo = coletar_dspace(desde, catalogo)
        # O índice OAI da UFSC é reconstruído com atraso e o datestamp é o da última alteração do item, não o da
        # indexação: avançar até hoje pularia para sempre o que ainda não estava no índice. Avança só até o que ele já tem.
        estado['dspace_desde'] = estado['oasisbr_desde'] = max(desde, ultimo or desde)
    elif args.fonte == 'dspace':
        print(f'::error::Coleta pelo DSpace impossível: {motivo}.', file=sys.stderr)
        return 1
    else:
        print(f'DSpace indisponível: {motivo}. Coletando pelo Oasisbr/IBICT.')
        fonte, desde = 'oasisbr', args.desde or estado['oasisbr_desde']
        conhecidos = {handle_de(r.get('url')) for r in bases['ppg'] + bases['tcc']}
        lote, removidos, ignorados, ultimo = coletar_oasisbr(desde, catalogo, conhecidos)
        # O Oasisbr agrega a UFSC com atraso: a janela só avança até o último depósito que ele já conhece,
        # senão o que ele indexar depois, com depósito anterior à data desta execução, seria pulado.
        estado['oasisbr_desde'] = max(desde, ultimo)

    completar_temas(lote['ppg'] + lote['tcc'], bases['ppg'] + bases['tcc'])
    PASTA_COLETAS.mkdir(exist_ok=True)
    if lote['ppg'] or lote['tcc'] or removidos:
        gravar_gz(PASTA_COLETAS / f"{agora.strftime('%Y-%m-%dT%H%M%SZ')}.json.gz", {
            'schema': 1, 'fonte': fonte, 'desde': desde, 'coletado_em': agora.isoformat(timespec='seconds'),
            'ppg': lote['ppg'], 'tcc': lote['tcc'], 'removidos': sorted(removidos)})
    if catalogo.novas:
        gravar_json(ARQ_PROGRAMAS, catalogo.programas)
        gravar_json(ARQ_MAPA_TCC, catalogo.mapa_tcc)
    gravar_json(ARQ_ESTADO, estado, indent=2)
    resumir(fonte, desde, lote, removidos, ignorados, catalogo.novas, ultimo)
    return 0


if __name__ == '__main__':
    sys.exit(main())
