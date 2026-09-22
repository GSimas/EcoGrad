"""Regras da coleta semanal, sem rede. Rode com: python coleta/test_coleta.py"""
import unittest

import coletar_ufsc as c


def url(h):
    return f'https://repositorio.ufsc.br/handle/123/{h}'


class RegrasDeColeta(unittest.TestCase):
    def test_nivel_vem_do_tipo_e_da_colecao_nunca_do_titulo(self):
        self.assertEqual(c.classificar_nivel(['info:eu-repo/semantics/doctoralThesis']), c.TESE)
        self.assertEqual(c.classificar_nivel(['Dissertação (Mestrado profissional)']), c.DISSERTACAO)
        self.assertEqual(c.classificar_nivel(['TCCgrad']), c.TCC_GRADUACAO)
        self.assertEqual(c.classificar_nivel(['TCCesp']), c.TCC_ESPECIALIZACAO)
        self.assertEqual(c.classificar_nivel([], colecao_tcc='TCC Especialização - Odontologia'), c.TCC_ESPECIALIZACAO)
        self.assertEqual(c.classificar_nivel(['Tese (Doutorado)'], colecao_tcc='TCC Administração'), c.TCC_GRADUACAO)
        self.assertIsNone(c.classificar_nivel(['Artigo']))
        self.assertIsNone(c.classificar_nivel(['Síntese de hipóteses']))

    def test_campos_vazios_do_oai_nao_derrubam_a_coleta(self):
        meta = c.limpar_meta({'type': [None, 'Tese (Doutorado)'], 'title': [None], 'creator': ['ana']})
        self.assertEqual(meta, {'type': ['Tese (Doutorado)'], 'title': [], 'creator': ['ana']})
        self.assertEqual(c.classificar_nivel(meta['type']), c.TESE)
        self.assertEqual(c.limpar_meta(None), {})

    def test_colecao_deposito_de_teses_usa_o_programa_da_nota_de_defesa(self):
        catalogo = c.Catalogo({'Programa de Pós-Graduação em Arquitetura e Urbanismo': 'col_1_10'}, [])
        nomes = {'col_1_99': 'Teses e dissertações não defendidas na UFSC'}
        nota = 'Tese (doutorado) - Universidade Federal de Santa Catarina, Centro Tecnológico, Programa de Pós-Graduação em Arquitetura e Urbanismo, Florianópolis, 2025.'
        meta = {'title': ['Erechim'], 'type': ['Tese (Doutorado)'], 'description': ['Resumo longo sobre urbanismo.', nota]}
        itens = c.registros_do_item(meta, ['col_1_99'], nomes, catalogo, '1/5')
        self.assertEqual([(t, r['programa_origem']) for t, r in itens], [('ppg', 'Programa de Pós-Graduação em Arquitetura e Urbanismo')])
        sem_programa = dict(meta, description=['Dissertação (mestrado) - Universidade Federal de Santa Catarina, Centro Tecnológico.'])
        self.assertEqual(c.registros_do_item(sem_programa, ['col_1_99'], nomes, catalogo, '1/6'), [])
        self.assertEqual(catalogo.novas, [])

    def test_handle_de_identificador_oai_e_urls(self):
        self.assertEqual(c.handle_de('oai:repositorio.ufsc.br:123456789/272918'), '123456789/272918')
        self.assertEqual(c.handle_de('https://repositorio.ufsc.br/xmlui/handle/123456789/130473'), '123456789/130473')
        self.assertIsNone(c.handle_de(''))

    def test_bloqueio_da_redeufsc_nao_passa_por_resposta_oai(self):
        self.assertIsNone(c.motivo_bloqueio(200, '<?xml version="1.0"?><OAI-PMH xmlns="http://www.openarchives.org/OAI/2.0/">'))
        self.assertIn('RedeUFSC', c.motivo_bloqueio(200, '<h3>Sistema de Prevenção de Ataques da RedeUFSC</h3><div class="cf-turnstile">'))
        self.assertIn('HTTP 503', c.motivo_bloqueio(503, 'indisponível'))

    def test_item_vira_um_registro_por_colecao_elegivel_e_aprende_colecoes_novas(self):
        catalogo = c.Catalogo({'Programa de Pós-Graduação em Ecologia': 'col_1_10'}, [{'curso': 'TCC Biologia', 'setSpec': 'col_1_20', 'handle': '1/20'}])
        meta = {'title': ['Um estudo'], 'creator': ['ana souza'], 'contributor': ['Universidade Federal de Santa Catarina', 'joão silva', 'maria'],
                'subject': ['Ecologia', ' '], 'date': ['2026-03-01', '2025'], 'type': ['Dissertação (Mestrado)'],
                'description': ['curto', 'resumo mais longo'], 'identifier': ['https://repositorio.ufsc.br/handle/1/99']}
        itens = c.registros_do_item(meta, ['com_1_1', 'col_1_10', 'col_1_30'], {'col_1_30': 'Programa de Pós-Graduação em Oceanografia'}, catalogo, '1/99')
        self.assertEqual([(t, r['programa_origem']) for t, r in itens], [('ppg', 'Programa de Pós-Graduação em Ecologia'), ('ppg', 'Programa de Pós-Graduação em Oceanografia')])
        r = itens[0][1]
        self.assertEqual((r['orientador'], r['co_orientadores'], r['ano'], r['resumo'], r['palavras_chave'], r['nivel_academico']),
                         ('Joao Silva', ['Maria'], '2025', 'resumo mais longo', ['ecologia'], c.DISSERTACAO))
        tcc = c.registros_do_item({**meta, 'type': ['TCCgrad']}, ['col_1_40', 'col_1_10'], {'col_1_40': 'Engenharia Civil'}, catalogo, '1/98')
        self.assertEqual([(t, r['programa_origem'], r['nivel_academico']) for t, r in tcc], [('tcc', 'TCC Engenharia Civil', c.TCC_GRADUACAO)])
        self.assertEqual(catalogo.mapa_tcc[-1], {'curso': 'TCC Engenharia Civil', 'setSpec': 'col_1_40', 'handle': '1/40'})
        self.assertEqual(catalogo.programas['Programa de Pós-Graduação em Oceanografia'], 'col_1_30')

    def test_oasisbr_deduz_a_colecao_pela_nota_e_marca_incompleto(self):
        catalogo = c.Catalogo({'Programa de Pós-Graduação em Farmacologia': 'col_1_1'}, [
            {'curso': 'TCC Especialização - Inteligência e Inovação Aplicadas ao Enfrentamento do Crime Organizado', 'setSpec': 'col_1_2'},
            {'curso': 'TCC Administração', 'setSpec': 'col_1_3'}])
        nota_ppg = ('Dissertação (mestrado) - Universidade Federal de Santa Catarina, Centro de Ciências Biológicas, '
                    'Programa de Pós-Graduação em Farmacologia (Mestrado Profissional), Florianópolis, 2025.')
        self.assertEqual(catalogo.colecao_pela_nota(nota_ppg, 'ppg'), 'Programa de Pós-Graduação em Farmacologia')
        self.assertEqual(catalogo.colecao_pela_nota('TCC (graduação) - Universidade Federal de Santa Catarina, Centro Socioeconômico, Curso de Administração.', 'tcc'), 'TCC Administração')
        self.assertIsNone(catalogo.colecao_pela_nota('Universidade Federal de Santa Catarina, Florianópolis', 'tcc'))
        bruto = {'oai_identifier_str': 'oai:repositorio.ufsc.br:123456789/272918', 'title': 'Resultados operacionais',
                 'format': ['bachelorThesis'], 'dc.contributor.author.fl_str_mv': ['Lima, Katheryny', 'Rocha, Ticiana'],
                 'topic': ['Crime organizado'], 'dc.date.issued.fl_str_mv': ['2026-03-24'],
                 'description': 'Trabalho de Conclusão de Curso submetido ao curso de Especialização em Inteligência e Inovação Aplicadas no Enfrentamento ao Crime Organizado, do Centro Tecnológico.',
                 'url': ['https://repositorio.ufsc.br/handle/123456789/272918']}
        tipo, r = c.registro_oasisbr(bruto, catalogo)
        self.assertEqual((tipo, r['nivel_academico'], r['orientador'], r['ano'], r['resumo'], r['metadados_incompletos']),
                         ('tcc', c.TCC_ESPECIALIZACAO, None, '2026', '', True))
        self.assertEqual(r['programa_origem'], 'TCC Especialização - Inteligência e Inovação Aplicadas ao Enfrentamento do Crime Organizado')

    def test_lotes_substituem_por_handle_como_no_site(self):
        bases = {'ppg': [{'url': url(1), 'programa_origem': 'A'}, {'url': url(1), 'programa_origem': 'B'}, {'url': url(2)}, {'titulo': 'sem url'}],
                 'tcc': [{'url': url(3)}]}
        lotes = [{'ppg': [{'url': url(1), 'titulo': 'novo'}], 'tcc': [], 'removidos': ['123/3']},
                 {'ppg': [], 'tcc': [{'url': url(4)}], 'removidos': []}]
        saida = c.aplicar_coletas(bases, lotes)
        self.assertEqual(saida['ppg'], [{'url': url(2)}, {'titulo': 'sem url'}, {'url': url(1), 'titulo': 'novo'}])
        self.assertEqual(saida['tcc'], [{'url': url(4)}])


ORE_PAGINA = """<?xml version="1.0" encoding="UTF-8"?>
<OAI-PMH xmlns="http://www.openarchives.org/OAI/2.0/"
         xmlns:atom="http://www.w3.org/2005/Atom"
         xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
         xmlns:dcterms="http://purl.org/dc/terms/">
 <ListRecords>
  <record>
   <header><identifier>oai:repositorio.ufsc.br:123456789/272516</identifier></header>
   <metadata>
    <atom:entry>
     <atom:link rel="alternate" href="https://repositorio.ufsc.br/handle/123456789/272516"/>
     <atom:link rel="http://www.openarchives.org/ore/terms/aggregates"
           href="https://repositorio.ufsc.br/bitstream/123456789/272516/1/TCC%20Lucas%20Sodr%c3%a9.pdf"
           title="TCC Lucas Sodré.pdf" type="application/pdf" length="1466314"/>
     <atom:link rel="http://www.openarchives.org/ore/terms/aggregates"
           href="https://repositorio.ufsc.br/bitstream/123456789/272516/2/license.txt"
           title="license.txt" type="text/plain; charset=utf-8" length="1383"/>
     <atom:link rel="http://www.openarchives.org/ore/terms/aggregates"
           href="https://repositorio.ufsc.br/bitstream/123456789/272516/3/miniatura.pdf"
           title="miniatura.pdf" type="application/pdf" length="900"/>
     <triples xmlns="http://www.openarchives.org/ore/atom/">
      <rdf:Description rdf:about="https://repositorio.ufsc.br/bitstream/123456789/272516/1/TCC%20Lucas%20Sodr%c3%a9.pdf">
       <dcterms:description>ORIGINAL</dcterms:description>
      </rdf:Description>
      <rdf:Description rdf:about="https://repositorio.ufsc.br/bitstream/123456789/272516/3/miniatura.pdf">
       <dcterms:description>THUMBNAIL</dcterms:description>
      </rdf:Description>
     </triples>
    </atom:entry>
   </metadata>
  </record>
  <record>
   <header><identifier>oai:repositorio.ufsc.br:123456789/221154</identifier></header>
   <metadata>
    <atom:entry>
     <atom:link rel="http://www.openarchives.org/ore/terms/aggregates"
           href="https://repositorio.ufsc.br/bitstream/123456789/221154/1/PRANCHA%201.jpg"
           title="PRANCHA 1.jpg" type="image/jpeg" length="8873336"/>
    </atom:entry>
   </metadata>
  </record>
  <resumptionToken completeListSize="207" cursor="0">ore/2026-09-10T00:00:00Z///100</resumptionToken>
 </ListRecords>
</OAI-PMH>"""

ORE_VAZIO = """<?xml version="1.0" encoding="UTF-8"?>
<OAI-PMH xmlns="http://www.openarchives.org/OAI/2.0/">
 <error code="noRecordsMatch">No matches for the query</error>
</OAI-PMH>"""


class PdfsDoRepositorio(unittest.TestCase):
    def test_pagina_ore_traz_so_pdf_do_bundle_original(self):
        mapa, token = c.arquivos_da_pagina(ORE_PAGINA)
        # license.txt cai pelo mime; a miniatura em PDF cai pelo bundle; o item só de imagem não entra.
        self.assertEqual(mapa, {'123456789/272516': [{'n': 'TCC Lucas Sodré.pdf', 's': 1, 'b': 1466314}]})
        self.assertEqual(token, 'ore/2026-09-10T00:00:00Z///100')

    def test_periodo_sem_itens_nao_e_erro(self):
        self.assertEqual(c.arquivos_da_pagina(ORE_VAZIO), ({}, ''))

    def test_bundle_desconhecido_vale_pelo_mime(self):
        # Sem o bloco <triples>, o mime é a única evidência — e um PDF a mais é melhor que nenhum.
        sem_triples = ORE_PAGINA[:ORE_PAGINA.index('<triples')] + '</atom:entry></metadata></record></ListRecords></OAI-PMH>'
        mapa, _ = c.arquivos_da_pagina(sem_triples)
        self.assertEqual([a['n'] for a in mapa['123456789/272516']], ['TCC Lucas Sodré.pdf', 'miniatura.pdf'])

    def test_url_do_pdf_e_a_forma_que_o_dspace_serve_inline(self):
        self.assertEqual(c.url_arquivo('123456789/272516', {'n': 'TCC Lucas Sodré.pdf', 's': 1}),
                         'https://repositorio.ufsc.br/bitstream/handle/123456789/272516/'
                         'TCC%20Lucas%20Sodr%C3%A9.pdf?sequence=1')

    def test_rest_traz_so_pdf_do_original_e_ja_da_a_sequencia(self):
        item = {'bitstreams': [
            {'name': 'TCC.pdf', 'bundleName': 'ORIGINAL', 'mimeType': 'application/pdf', 'sizeBytes': 1298530, 'sequenceId': 1},
            {'name': 'license.txt', 'bundleName': 'LICENSE', 'mimeType': 'text/plain; charset=utf-8', 'sizeBytes': 1383, 'sequenceId': 2},
            {'name': 'mini.pdf', 'bundleName': 'THUMBNAIL', 'mimeType': 'application/pdf', 'sizeBytes': 900, 'sequenceId': 3},
            {'name': 'sem-sequencia.pdf', 'bundleName': 'ORIGINAL', 'mimeType': 'application/pdf', 'sizeBytes': 10, 'sequenceId': None},
        ]}
        self.assertEqual(c.arquivos_do_item_rest(item), [{'n': 'TCC.pdf', 's': 1, 'b': 1298530}])
        self.assertEqual(c.arquivos_do_item_rest({}), [])

    def test_rest_e_ore_produzem_o_mesmo_formato(self):
        # As duas fontes alimentam o mesmo campo: divergir no formato quebraria a leitura.
        ore, _ = c.arquivos_da_pagina(ORE_PAGINA)
        rest = c.arquivos_do_item_rest({'bitstreams': [
            {'name': 'TCC Lucas Sodré.pdf', 'bundleName': 'ORIGINAL', 'mimeType': 'application/pdf',
             'sizeBytes': 1466314, 'sequenceId': 1}]})
        self.assertEqual(rest, ore['123456789/272516'])

    def test_checkpoint_do_rest_nao_e_confundido_com_lote(self):
        self.assertIsNone(c.PADRAO_LOTE.match(c.CACHE_REST.name))

    def test_registro_so_ganha_o_campo_quando_ha_pdf(self):
        catalogo = c.Catalogo({'Programa de Pós-Graduação em Ecologia': 'col_1_10'}, [])
        meta = {'title': ['Um estudo'], 'type': ['Dissertação (Mestrado)']}
        pdfs = [{'n': 'tese.pdf', 's': 1, 'b': 10}]
        com = c.registros_do_item(meta, ['col_1_10'], {}, catalogo, '1/99', pdfs)
        self.assertEqual(com[0][1]['arquivos'], pdfs)
        sem = c.registros_do_item(meta, ['col_1_10'], {}, catalogo, '1/99')
        self.assertNotIn('arquivos', sem[0][1])


if __name__ == '__main__':
    unittest.main()
