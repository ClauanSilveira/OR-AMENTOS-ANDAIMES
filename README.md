# Orçamentos de Andaimes (CBSI)

App web (sem instalação, funciona offline) para montar orçamentos de andaimes a partir da planilha "Caminho Seguro" e gerar o PDF para enviar.

**Como usar:** abra `index.html` no navegador (ou publique a pasta no GitHub Pages / qualquer hospedagem estática e "Instale" no celular).

- **Orçamento:** preencha os dados, adicione *pontos de andaime* e, em cada ponto, uma ou mais *estruturas* (andaime, balanço, escoramento, isolamento/tubo de vida, pisos, linha de vida). Informe dimensões, % executado por regime (ADM / noturno / fim de semana) e dias de disponibilização — o app escolhe sozinho os itens do contrato (2.x, 3.x, 4.x, 5.x, 7.x, 8.x), busca o preço e calcula tudo.
- **Verbas fixas:** qualquer item da tabela (canteiro, ônibus, utilitário…) × qtd × meses × % de rateio.
- **Tabela de preços:** editável (preços atuais do QQP).
- **Salvos:** vários orçamentos, duplicar, exportar/importar backup. Dados ficam no navegador do aparelho.
- **Gerar PDF:** botão laranja; o arquivo é baixado pronto para envio.

O botão "Carregar exemplo da planilha" recria o orçamento original (total R$ 76.613,18, idêntico à planilha).
