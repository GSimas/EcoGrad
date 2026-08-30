import json, sys

import os
# Diretório com py_ref.json e ts_ref.json (gerados por `npm run verify:parity`).
S = os.environ.get('PARITY_DIR', os.path.join(os.path.dirname(__file__), '..', '.parity'))
py = json.load(open(f'{S}/py_ref.json'))
ts = json.load(open(f'{S}/ts_ref.json'))

falhas = []

def cmp_num(nome, a, b, tol=1e-9, rel=True):
    if a is None or b is None:
        falhas.append(f'{nome}: None ({a} vs {b})'); return
    diff = abs(a - b)
    escala = max(abs(a), abs(b), 1e-12)
    ok = (diff / escala <= tol) if rel else (diff <= tol)
    status = 'OK ' if ok else 'XX '
    if not ok: falhas.append(f'{nome}: py={a!r} ts={b!r} (diff={diff:.3g})')
    print(f'  {status}{nome:38s} py={a:<22.12g} ts={b:<22.12g}')

def cmp_dict(nome, dpy, dts, tol=1e-9):
    chaves = sorted(set(dpy) & set(dts))
    faltando = set(dpy) ^ set(dts)
    maxdiff = 0.0; pior = None
    for k in chaves:
        d = abs(dpy[k] - dts[k])
        e = max(abs(dpy[k]), abs(dts[k]), 1e-12)
        r = d / e
        if r > maxdiff: maxdiff, pior = r, k
    ok = maxdiff <= tol and not faltando
    status = 'OK ' if ok else 'XX '
    print(f'  {status}{nome:38s} n={len(chaves):<6d} maxRelDiff={maxdiff:.3g}' + (f'  pior={pior!r}' if maxdiff>tol else ''))
    if not ok:
        falhas.append(f'{nome}: maxRelDiff={maxdiff:.3g} chavesFaltando={len(faltando)}')

print('\n=== 1. TOPOLOGIA DO SUBCONJUNTO (150 docs, cálculo exato) ===')
cmp_num('n_nos', py['sub']['n_nos'], ts['sub']['n_nos'], 0, False)
cmp_num('n_arestas', py['sub']['n_arestas'], ts['sub']['n_arestas'], 0, False)
for m in ['deg','bet','clo','clu']:
    sub_ts = {k: ts['sub'][m][k] for k in py['sub'][m] if k in ts['sub'][m]}
    cmp_dict(f'{m} (amostra de 400 nós)', py['sub'][m], sub_ts, 1e-9)

print('\n=== 2. METRICAS COMPLEXAS (150 docs) ===')
for k in ['densidade','eficiencia','entropia','clustering','pagerank_avg','eigen_avg','constraint_avg','grau_medio','grau_std']:
    cmp_num(k, py['complexas'][k], ts['complexas'][k], 1e-6)
cmp_num('n_nos', py['complexas']['n_nos'], ts['complexas']['n_nos'], 0, False)

print('\n=== 2.5 REDE DE COOCORRENCIA (densa: rich-club e clustering ponderado) ===')
pc, tc = py.get('coocorrencia') or {}, ts.get('coocorrencia') or {}
if not pc or not tc:
    print('  -- sem rede de coocorrencia nesta base')
else:
    cmp_num('n_nos', pc['n_nos'], tc['n_nos'], 0, False)
    cmp_num('n_arestas', pc['n_arestas'], tc['n_arestas'], 0, False)
    cmp_num('clustering_ponderado', pc['clustering_ponderado'], tc['clustering_ponderado'], 1e-9)
    cmp_num('clustering_simples', pc['clustering_simples'], tc['clustering_simples'], 1e-9)
    cmp_num('assortatividade', pc['assortatividade'], tc['assortatividade'], 1e-9)
    cmp_num('gamma_mle', pc['gamma_mle'], tc['gamma_mle'], 1e-9)
    cmp_dict('rich_club (por grau k)', pc['rich_club'], tc['rich_club'], 1e-9)
    fora = [k for k, v in tc['rich_club'].items() if v < 0 or v > 1]
    print(f'  {"OK " if not fora else "XX "}rich-club dentro de [0,1]              {len(tc["rich_club"])} valores')
    if fora: falhas.append(f'rich-club fora de [0,1] em k={fora[:5]}')

print('\n=== 3. MATURIDADE TOPOLOGICA (base completa) ===')
for k in ['assortatividade','rich_club','gamma_linregress','gamma_mle','n_nos_G3']:
    cmp_num(k, py['maturidade'][k], ts['maturidade'][k], 1e-9)
print(f'  -- Louvain (estocástico, comparado por modularidade):')
print(f'     py: mod={py["maturidade"]["modularidade_louvain"]:.4f} comunidades={py["maturidade"]["n_comunidades"]}')
print(f'     ts: mod={ts["maturidade"]["modularidade_louvain"]:.4f} comunidades={ts["maturidade"]["n_comunidades"]}')

print('\n=== 4. RADAR DE FORESIGHT (base completa, bet. exato) ===')
pr = {r['Termo']: r for r in py['radar']}
tr = {r['Termo']: r for r in ts['radar']}
print(f'  {"OK " if set(pr)==set(tr) else "XX "}conjunto de termos                    py={len(pr)} ts={len(tr)}')
if set(pr) != set(tr): falhas.append(f'radar termos divergem: py-ts={set(pr)-set(tr)} ts-py={set(tr)-set(pr)}')
for campo in ['Total','Aparições Recentes','Tração (%)','Momentum (Burst)','Novidade (Estrutural * IDF)']:
    cmp_dict(f'radar.{campo}', {k: pr[k][campo] for k in pr if k in tr}, {k: tr[k][campo] for k in pr if k in tr}, 1e-9)

print('\n=== 5. BACKTEST HISTORICO (2018/3/4/0.65) ===')
cmp_num('n linhas', py['backtest']['n'], ts['backtest']['n'], 0, False)
for q in sorted(set(py['backtest']['quadrantes']) | set(ts['backtest']['quadrantes'])):
    a = py['backtest']['quadrantes'].get(q,0); b = ts['backtest']['quadrantes'].get(q,0)
    print(f'  {"OK " if a==b else "XX "}quadrante {q:22s} py={a:<5d} ts={b}')
    if a!=b: falhas.append(f'backtest quadrante {q}: {a} vs {b}')
for v in sorted(set(py['backtest']['vereditos']) | set(ts['backtest']['vereditos'])):
    a = py['backtest']['vereditos'].get(v,0); b = ts['backtest']['vereditos'].get(v,0)
    print(f'  {"OK " if a==b else "XX "}veredito {v:38s} py={a:<5d} ts={b}')
    if a!=b: falhas.append(f'backtest veredito {v}: {a} vs {b}')

print('\n=== 6. MEMETICA ===')
for k in ['n_memes','mortos','vivos','n_longevidade']:
    cmp_num(k, py['memetica'][k], ts['memetica'][k], 0, False)
cmp_num('meia_vida_mediana', py['memetica']['meia_vida_mediana'], ts['memetica']['meia_vida_mediana'], 1e-12)
pf = {r['meme']: r['fecundidade'] for r in py['memetica']['top_fecundidade']}
tf = {r['meme']: r['fecundidade'] for r in ts['memetica']['top_fecundidade']}
# O `sort_values` do pandas usa quicksort (instável): entre memes com contagem
# idêntica a ordem é arbitrária. Comparamos então o multiconjunto de contagens e
# exigimos que qualquer nome divergente esteja empatado no valor de corte.
vals_iguais = sorted(pf.values(), reverse=True) == sorted(tf.values(), reverse=True)
corte = min(pf.values())
divergentes = (set(pf) ^ set(tf))
so_empates = all(pf.get(m, tf.get(m)) == corte for m in divergentes)
igual = vals_iguais and so_empates
print(f'  {"OK " if igual else "XX "}top-20 fecundidade                   {list(pf.items())[:3]}')
if divergentes and igual:
    print(f'      (empate no valor de corte {corte}: {sorted(divergentes)} — ordenação arbitrária no pandas)')
if not igual:
    falhas.append(f'top fecundidade diverge: só-py={set(pf)-set(tf)} só-ts={set(tf)-set(pf)}')

print('\n=== 7. QUOCIENTE LOCACIONAL ===')
print(f'  orientador alvo: py={py["ql"]["orientador"]!r} ts={ts["ql"]["orientador"]!r}')
cmp_num('n_docs do perfil', py['ql']['n_docs'], ts['ql']['n_docs'], 0, False)
# O Python inclui uma linha de Entidade vazia (macrotema ausente); o TS a omite.
pl = {(r['Entidade'], r['Tipo']): r for r in py['ql']['linhas'] if r['Entidade'] != ''}
tl = {(r['Entidade'], r['Tipo']): r for r in ts['ql']['linhas'] if r['Entidade'] != ''}
comuns = set(pl) & set(tl)
print(f'  linhas comparáveis: {len(comuns)} (py={len(pl)} ts={len(tl)})')
ruim = [k for k in comuns if abs(pl[k]['QL']-tl[k]['QL'])>1e-9 or pl[k]['Total']!=tl[k]['Total']]
print(f'  {"OK " if not ruim else "XX "}QL e Total idênticos nas linhas comuns')
if ruim: falhas.append(f'QL diverge em {ruim[:5]}')

print('\n=== 8. SIMILARES (Jaccard) ===')
for grupo in sorted(set(py['similares']) | set(ts['similares'])):
    a = py['similares'].get(grupo, []); b = ts['similares'].get(grupo, [])
    igual = [(x['Item'], round(x['Sim'],6), x['Tracos']) for x in a] == [(x['Item'], round(x['Sim'],6), x['Tracos']) for x in b]
    print(f'  {"OK " if igual else "XX "}{grupo}: {[x["Item"][:28] for x in a[:3]]}')
    if not igual:
        falhas.append(f'similares {grupo}: py={a} ts={b}')

print('\n' + '='*70)
if falhas:
    print(f'❌ {len(falhas)} DIVERGÊNCIA(S):')
    for f in falhas: print('   -', f)
    sys.exit(1)
print('✅ PARIDADE TOTAL: todas as métricas comparadas coincidem com o backend Python.')
