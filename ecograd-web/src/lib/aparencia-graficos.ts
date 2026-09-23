/** Adapt drawing styles only. Values, labels, series order, categories and callbacks stay intact. */
export function adaptarGrafico<T>(opcao: T, claro: boolean, reduzir: boolean): T {
  const cores: Record<string, string> = claro ? {
    '#CBD2CE': '#2A3732', '#DEE2DC': '#16241F', '#4D5954': '#6E7B75',
    '#16241F': '#D4D3CB', '#0D1C17': '#F8F7F2', '#2C3834': '#7A827C',
    // O limão some sobre o papel: no claro a marca fala em verde-petróleo.
    '#B8FF4A': '#236E5E',
  } : {};
  const visitar = (v: unknown, chave = ''): unknown => {
    if (typeof v === 'string' && ['color', 'backgroundColor', 'borderColor'].includes(chave)) return cores[v.toUpperCase()] ?? v;
    if (reduzir && chave === 'animation') return false;
    if (Array.isArray(v)) return v.map(x => visitar(x, chave));
    if (v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype) return Object.fromEntries(Object.entries(v).map(([k,x]) => [k,visitar(x,k)]));
    return v;
  };
  const resultado = visitar(opcao) as Record<string, unknown>;
  if (resultado && Array.isArray(resultado.series)) resultado.series = resultado.series.map((item: Record<string, unknown>) => {
    if (item.type === 'wordCloud') return { ...item, textStyle: { ...(item.textStyle as object), color: claro ? '#2A3732' : '#CBD2CE' } };
    if (['scatter', 'bar'].includes(String(item.type))) return { ...item, itemStyle: { borderColor: claro ? '#2A3732' : '#CBD2CE', borderWidth: 1.5, ...(item.itemStyle as object) } };
    return item;
  });
  return resultado as T;
}
