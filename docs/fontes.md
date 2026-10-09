# Expansão das fontes do ARK

A prioridade do projeto é ampliar a leitura em português (pt-BR e pt), seguida de inglês. A quantidade de obras e capítulos realmente acessíveis importa mais que a quantidade de integrações. MangaDex continua sendo a única fonte de capítulos integrada e testada no ARK.

## Opções pesquisadas em 9 de outubro de 2026

| Opção | O que oferece | Situação para o ARK |
| --- | --- | --- |
| [MangaDex](https://api.mangadex.org/docs/) | Catálogo, capítulos hospedados e imagens, em português e inglês | Integrado |
| [Suwayomi](https://github.com/Suwayomi/Suwayomi-Server) | API de um servidor próprio que reúne fontes instaladas por extensões | Candidato para uma segunda integração de leitura; precisa de servidor e testes reais |
| [MANGA Plus](https://mangaplus.shueisha.co.jp/) | Catálogo oficial da Shueisha; o índice de extensões consultado inclui pt-BR e en | Existe adaptador comunitário; não foi confirmada uma API pública documentada para leitores externos |
| [Comikey](https://br.comikey.com/) | Catálogo de uma plataforma editorial; o índice inclui Comikey Brasil em pt-BR | Existe adaptador comunitário; acesso e disponibilidade de capítulos precisam ser verificados |
| [NamiComi](https://namicomi.com/) | Plataforma de publicação; o índice inclui pt-BR, pt e en | Existe adaptador comunitário; cobertura e acesso precisam ser verificados |
| [AniList](https://github.com/AniList/docs) e [Kitsu](https://kitsu.docs.apiary.io/) | Dados de obras, gêneros e catálogo | Podem complementar descoberta e associação de títulos; não fornecem as páginas necessárias ao leitor |
| [Nexus Connection](https://nexustoons.com/static/connection-api-docs.txt) | OAuth e sincronização de favoritos, listas e histórico | A documentação fornecida não descreve entrega de imagens de capítulos |

Suwayomi é um intermediário, não um catálogo de conteúdo próprio. Sua API permite listar fontes com idioma e buscar obras em cada uma. Uma extensão no índice não comprova que uma fonte funciona hoje, que seus capítulos são gratuitos ou que há autorização para incorporá-los em outro aplicativo.

Foram consultados o [README do Suwayomi](https://github.com/Suwayomi/Suwayomi-Server/blob/master/README.md), as consultas/mutações GraphQL de fontes no código do projeto e o [repositório de extensões Keiyoushi](https://github.com/keiyoushi/extensions). O índice atual indicado pelo projeto é `index.pb`; o índice JSON consultado contém avisos para aplicativos desatualizados e não deve ser usado para contar fontes. O protocolo foi conferido no [schema publicado](https://github.com/keiyoushi/extensions-source/blob/main/.github/scripts/index.proto). Nenhuma extensão foi instalada, nenhum capítulo dessas novas fontes foi testado e nenhum serviço extra foi criado.

## Organização pretendida

- Uma página por obra, com associações entre os identificadores de cada fonte. Título parecido sozinho não confirma que duas entradas são a mesma obra: edições, volumes e continuações precisam ser diferenciados.
- Português como idioma inicial, incluindo pt-BR e pt. Inglês fica disponível por escolha do leitor; trocar de fonte não deve mudar silenciosamente o idioma.
- Capítulos equivalentes agrupados por obra, volume, número e idioma. A interface mostra uma versão principal e informa sua origem e créditos, mantendo alternativas acessíveis sem repetir todas as traduções na lista.
- Preferência de fonte por obra e preservação do progresso ao mudar de versão, quando a associação entre capítulos for confirmada.
- Cobertura real de capítulos, imagens e atualização como critérios de escolha. Catálogo com sinopse e capa não deve aparecer como promessa de leitura disponível.

## Próxima validação

1. Definir um servidor Suwayomi acessível ao backend do ARK. O Render não alcança um servidor no PC por localhost. Não instalar um serviço adicional no plano atual presumindo que seus recursos ou armazenamento sejam suficientes.
2. Selecionar uma fonte em português e outra em inglês e confirmar os requisitos de acesso e as regras de integração. Manter autenticação ou restrições exigidas pela fonte.
3. Testar busca, detalhes, lista de capítulos, páginas reais, créditos e falhas com poucas obras representativas. Uma resposta de catálogo ou uma simulação não comprova leitura.
4. Com a fonte validada, acrescentar o adaptador ao backend e os vínculos entre obras, preservando os identificadores e backups atuais do MangaDex.
5. Expandir gradualmente para fontes com cobertura complementar. A contagem de APIs deve distinguir catálogo de leitura; não apresentar conexões planejadas como disponíveis.

As melhorias de capítulos lidos/não lidos, preferências por obra, controles móveis, página inicial pessoal, instalação como aplicativo e IA permanecem no plano de evolução. A pesquisa de fontes acrescenta uma prioridade e não substitui essas melhorias.
