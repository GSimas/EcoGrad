"""Referência Python: extrai métricas do backend original para comparação com o TS."""
import json
import math
import sys
import os

# Roda a partir da raiz do repositório Python (um nível acima de ecograd-web/)
RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
sys.path.insert(0, RAIZ)
os.chdir(RAIZ)

import networkx as nx
import networkx.algorithms.community as nx_comm
import pandas as pd
from collections import Counter

import backend as B

dados = json.load(open('base_ppgegc.json', encoding='utf-8'))
dados = B._normalizar_documentos(dados)

N_SUB = 150
sub = dados[:N_SUB]

# ---------- 1. Grafo global (subconjunto, cálculo exato) ----------
G = nx.Graph()
for d in sub:
    doc = d.get('titulo')
    if not doc:
        continue
    G.add_node(doc, tipo='Documento')
    for a in d.get('autores', []):
        G.add_node(a, tipo='Autor'); G.add_edge(doc, a)
    ori = d.get('orientador')
    if ori:
        G.add_node(ori, tipo='Orientador'); G.add_edge(doc, ori)
    for pk in d.get('palavras_chave', []):
        G.add_node(pk, tipo='Palavra-chave'); G.add_edge(doc, pk)
    mt = d.get('macrotema')
    if mt:
        G.add_node(mt, tipo='Macrotema'); G.add_edge(doc, mt)
    for art in B._extrair_termos_foresight(d, 'Artefatos (Ontologia IA)'):
        if art not in G:
            G.add_node(art, tipo='Artefato (Ontologia IA)')
        G.add_edge(doc, art)

deg = nx.degree_centrality(G)
bet = nx.betweenness_centrality(G)
clo = nx.closeness_centrality(G)
clu = nx.clustering(G)

# ---------- 2. Métricas complexas (grafo sem macrotema) ----------
G2 = nx.Graph()
for d in sub:
    doc = d.get('titulo')
    if not doc:
        continue
    G2.add_node(doc)
    for a in d.get('autores', []): G2.add_edge(doc, a)
    ori = d.get('orientador')
    if ori: G2.add_edge(doc, ori)
    for pk in d.get('palavras_chave', []): G2.add_edge(doc, pk)

hist = nx.degree_histogram(G2)
import numpy as np
pk_arr = np.array(hist, dtype=float); pk_arr = pk_arr / pk_arr.sum(); pk_arr = pk_arr[pk_arr > 0]

complexas = {
    'densidade': nx.density(G2),
    'eficiencia': nx.global_efficiency(G2),
    'entropia': float(-np.sum(pk_arr * np.log2(pk_arr))),
    'clustering': nx.average_clustering(G2),
    'pagerank_avg': float(np.mean(list(nx.pagerank(G2).values()))),
    'eigen_avg': float(np.mean(list(nx.eigenvector_centrality(G2, max_iter=1000, weight=None).values()))),
    'constraint_avg': float(np.mean(list(nx.constraint(G2).values()))),
    'n_nos': G2.number_of_nodes(),
    'grau_medio': float(np.mean([d for _, d in G2.degree()])),
    'grau_std': float(np.std([d for _, d in G2.degree()])),
}

# ---------- 3. Maturidade (grafo estrutural, base completa) ----------
G3 = nx.Graph()
for d in dados:
    doc = d.get('titulo')
    if not doc: continue
    G3.add_node(doc)
    for a in d.get('autores', []): G3.add_edge(doc, a)
    ori = d.get('orientador')
    if ori: G3.add_edge(doc, ori)
    for pk in d.get('palavras_chave', []): G3.add_edge(doc, pk)
    mt = d.get('macrotema')
    if mt: G3.add_edge(doc, mt)
G3.remove_edges_from(nx.selfloop_edges(G3))

assort = nx.degree_assortativity_coefficient(G3)
rc = nx.rich_club_coefficient(G3, normalized=False)
k_max = max(rc.keys()) if rc else 1
k_target = int(k_max * 0.8)
chaves_validas = [k for k in rc.keys() if k >= k_target]
rich_club_val = rc[chaves_validas[0]] if chaves_validas else list(rc.values())[-1]

from scipy import stats
graus3 = [d for _, d in G3.degree() if d > 0]
cont3 = Counter(graus3)
k3 = np.array(list(cont3.keys())); Pk3 = np.array(list(cont3.values())) / len(graus3)
mask = k3 > 1
slope, *_ = stats.linregress(np.log10(k3[mask]), np.log10(Pk3[mask]))
gamma_lin = abs(slope)

gamma_mle = B._estimar_gamma_lei_potencia(graus3)

# ---------- 3.5 Rede de coocorrência (densa) — cobre rich-club e clustering ponderado ----------
# O grafo estrutural tem rich-club 0, o que mascarava erros; a rede de
# coocorrência de palavras-chave é densa e produz valores não triviais.
import itertools as _it
G_co = nx.Graph()
for d in sub:
    termos = sorted({str(p).strip().title() for p in d.get('palavras_chave', []) if str(p).strip()})
    for a, b in _it.combinations(termos, 2):
        if G_co.has_edge(a, b): G_co[a][b]['weight'] += 1
        else: G_co.add_edge(a, b, weight=1)

if G_co.number_of_nodes() > 2:
    rc_co = nx.rich_club_coefficient(G_co, normalized=False)
    graus_co = [d for _, d in G_co.degree()]
    coocorrencia = {
        'n_nos': G_co.number_of_nodes(),
        'n_arestas': G_co.number_of_edges(),
        'rich_club': {str(k): v for k, v in sorted(rc_co.items())},
        'clustering_ponderado': nx.average_clustering(G_co, weight='weight'),
        'clustering_simples': nx.average_clustering(G_co),
        'assortatividade': nx.degree_assortativity_coefficient(G_co),
        'gamma_mle': B._estimar_gamma_lei_potencia(graus_co),
    }
else:
    coocorrencia = {}

# ---------- 4. Radar de Foresight (base completa, sem bootstrap) ----------
# SNA global usa betweenness aproximado; para comparar o radar de forma
# determinística usamos um sna_global com betweenness EXATO do grafo completo.
Gf = nx.Graph()
for d in dados:
    doc = d.get('titulo')
    if not doc: continue
    Gf.add_node(doc, tipo='Documento')
    for a in d.get('autores', []): Gf.add_node(a, tipo='Autor'); Gf.add_edge(doc, a)
    ori = d.get('orientador')
    if ori: Gf.add_node(ori, tipo='Orientador'); Gf.add_edge(doc, ori)
    for pk in d.get('palavras_chave', []): Gf.add_node(pk, tipo='Palavra-chave'); Gf.add_edge(doc, pk)
    mt = d.get('macrotema')
    if mt: Gf.add_node(mt, tipo='Macrotema'); Gf.add_edge(doc, mt)

bet_f = nx.betweenness_centrality(Gf)
sna_fake = {n: {'Betweenness': v} for n, v in bet_f.items()}

df_radar = B.preparar_radar_foresight.__wrapped__(dados, sna_global=sna_fake, janela_recente=3, tipo='Palavra-chave')
radar = df_radar.sort_values('Termo').to_dict('records') if not df_radar.empty else []

# ---------- 5. Backtest histórico ----------
# Reimplementa o backtest com betweenness EXATO (k=None) para tornar a
# comparação com o TypeScript determinística.
import backend as _B
_orig_bc = nx.betweenness_centrality
def _bc_exato(G, k=None, **kw):
    kw.pop('seed', None)
    return _orig_bc(G, k=None, **kw)
nx.betweenness_centrality = _bc_exato
df_bt = B.validar_foresight_historico.__wrapped__(dados, 2018, 3, 4, 0.65, 'Palavra-chave')
nx.betweenness_centrality = _orig_bc
bt_counts = Counter(df_bt['Previsão Passada (T1)']) if not df_bt.empty else {}
bt_veredito = Counter(df_bt['Veredito do Modelo']) if not df_bt.empty else {}

# ---------- 6. Memética ----------
df_base = pd.DataFrame(dados)
df_base['Ano'] = pd.to_numeric(df_base['ano'], errors='coerce')
df_base = df_base.dropna(subset=['Ano'])
df_base['Ano'] = df_base['Ano'].astype(int)
fec, longev, mortos, vivos, df_mortos, df_vivos = B.calcular_metricas_memeticas(df_base, 'Palavras-chave')

# ---------- 7. QL de um orientador ----------
ori_alvo = Counter([d['orientador'] for d in dados if d.get('orientador')]).most_common(1)[0][0]
docs_ori = [d for d in dados if d.get('orientador') == ori_alvo]

total_docs_global = len(dados)
total_docs_perfil = len(docs_ori)
linhas_ql = []
for tipo in ['Macrotema', 'Palavra-chave']:
    c = Counter()
    for d in dados:
        for e in B._extrair_entidades_por_tipo(d, tipo):
            c[e] += 1
    agregados = {}
    for d in docs_ori:
        nivel = B._normalizar_nivel(d.get('nivel_academico'))
        for e in B._extrair_entidades_por_tipo(d, tipo):
            agregados.setdefault(e, {'Teses': 0, 'Dissertações': 0, 'Outros': 0})
            agregados[e][nivel if nivel in ('Teses', 'Dissertações') else 'Outros'] += 1
    for e, conts in agregados.items():
        tl = conts['Teses'] + conts['Dissertações'] + conts['Outros']
        tg = c.get(e, 0)
        ql = 0.0 if tg == 0 else (tl / total_docs_perfil) / (tg / total_docs_global)
        linhas_ql.append({'Entidade': e, 'Tipo': tipo, 'Total': tl, 'QL': round(ql, 2)})
linhas_ql.sort(key=lambda x: (x['Tipo'], -x['QL'], -x['Total'], x['Entidade']))

# ---------- 8. Similares (Jaccard) ----------
sim = B.calcular_similares_rede.__wrapped__(ori_alvo, 'Orientador', dados)
sim_saida = {k: [{'Item': i['Item'], 'Sim': i['Similaridade (%)'], 'Tracos': i['Qtd. Traços']} for i in v]
             for k, v in sim.items()}

# ---------- 9. Louvain (modularidade, comparável entre implementações) ----------
comms = nx_comm.louvain_communities(G3, seed=42)
modularidade = nx_comm.modularity(G3, comms)

saida = {
    'n_docs': len(dados),
    'sub': {
        'n_nos': G.number_of_nodes(),
        'n_arestas': G.number_of_edges(),
        'deg': {k: deg[k] for k in sorted(deg)[:400]},
        'bet': {k: bet[k] for k in sorted(bet)[:400]},
        'clo': {k: clo[k] for k in sorted(clo)[:400]},
        'clu': {k: clu[k] for k in sorted(clu)[:400]},
    },
    'complexas': complexas,
    'coocorrencia': coocorrencia,
    'maturidade': {
        'assortatividade': assort,
        'rich_club': rich_club_val,
        'gamma_linregress': gamma_lin,
        'gamma_mle': gamma_mle,
        'n_nos_G3': G3.number_of_nodes(),
        'modularidade_louvain': modularidade,
        'n_comunidades': len(comms),
    },
    'radar': radar,
    'backtest': {'n': len(df_bt), 'quadrantes': dict(bt_counts), 'vereditos': dict(bt_veredito)},
    'memetica': {
        'n_memes': len(fec),
        'mortos': mortos,
        'vivos': vivos,
        'top_fecundidade': fec.sort_values('fecundidade', ascending=False).head(20).to_dict('records'),
        'n_longevidade': len(longev),
        'meia_vida_mediana': float(longev['tempo_vida_anos'].median()) if len(longev) else 0.0,
    },
    'ql': {'orientador': ori_alvo, 'n_docs': len(docs_ori), 'linhas': linhas_ql},
    'similares': sim_saida,
}

print(json.dumps(saida, ensure_ascii=False, default=float))
