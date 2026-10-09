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

## Nomes sugeridos pelo usuário

Pesquisa adicional em 9 de outubro de 2026. Idiomas abaixo vêm do índice de extensões consultado, não de uma medição de capítulos disponíveis. Os nomes de fontes não implicam APIs públicas documentadas ou integração funcionando no ARK.

| Nome | Tipo e idioma identificado | Resultado da pesquisa |
| --- | --- | --- |
| Pluma Comics | Fonte; pt-BR | Adaptador em `src/pt/plumacomics`. Usa `/api/obras` e `/api/viewer/bootstrap` do site. A consulta normal de catálogo respondeu HTTP 503; o site redirecionou para `/manutencao`. Candidato para retestar depois da manutenção; páginas não validadas. |
| Lycan Toons | Fonte; pt-BR | Adaptador em `src/pt/lycantoons`, com busca e páginas. O código depende de WebView para chamadas ao site; a consulta direta à página inicial recebeu HTTP 403 nesta máquina. Leitura não validada. |
| MangaFire | Fonte; pt, pt-BR, en | Adaptador em `src/all/mangafire`. Usa endpoints do site e mecanismos específicos de assinatura/desafio; maior custo de manutenção e compatibilidade. API pública documentada não confirmada. |
| MangaLivre | Nome compartilhado por fontes diferentes; pt-BR | O índice contém ToonLivre (`toonlivre.net`, pacote `pt.mangalivre`), Manga Livre Blog (`mangalivre.blog`), MangaLivre.org e Manga Livre.to. É necessário identificar o domínio pretendido; não tratar esses sites como o mesmo serviço ou atribuir-lhes o catálogo do MangaLivre original. |
| Comikey | Plataforma editorial; pt-BR, en | Adaptador em `src/all/comikey`, incluindo Comikey Brasil. Extrai dados do site e usa contexto do leitor; o próprio adaptador trata capítulos bloqueados. Verificar acesso autorizado a capítulos gratuitos ou adquiridos, sem assumir todo o catálogo disponível. |
| Zyk Scans | Nome ainda não identificado com segurança | Não houve correspondência no índice pesquisado ou nos caminhos de adapters das bibliotecas consultadas; a busca de repositórios pelos nomes `zykscans` e `zyk scans` também não retornou resultados. Isso não prova inexistência. Falta URL ou nome completo para identificar a fonte. |
| VIZ | Plataforma editorial; en no índice | Adaptador em `src/en/vizshonenjump` para VIZ Shonen Jump e VIZ Manga. A página oficial abriu; leitura, requisitos de conta, assinatura e região não foram validados. API pública de capítulos para o ARK não confirmada. |
| Mangamo | Plataforma editorial; en | Adaptador em `src/en/mangamo`, com autenticação e tratamento de assinatura/moedas. O site abriu; nenhuma conta foi usada e leitura não foi testada. API pública documentada para integração externa não confirmada. |
| Manga UP! | Plataforma da Square Enix; en no índice consultado | Adaptador em `src/all/mangaup` para `global.manga-up.com`, com contexto do leitor e token. A página oficial abriu; capítulos não testados. Se o nome se referir a outro site, identificar a URL antes de associá-lo à Square Enix. |
| Bato | Nome/domínios precisam ser definidos | O índice atual contém Bbato em `bato1.com`, en, e o parser antigo do Kotatsu contém BatoTo. A existência de um mirror ou parser não comprova continuidade do serviço original, catálogo em português ou funcionamento atual. |
| MangaFreak | Fonte; en no índice | Adaptador em `src/en/mangafreak`, para `ww3.mangafreak.me`. O código extrai catálogo/capítulos/páginas do HTML. API pública documentada não confirmada; candidato secundário para inglês. |
| WeebCentral | Fonte; en no índice | Adaptador em `src/en/weebcentral`, para `weebcentral.com`, com extração de HTML e lista de capítulos. Candidato secundário para inglês; nenhuma página de leitura testada. |
| Mihon / Tachiyomi | Aplicativos leitores Android | [Mihon](https://github.com/mihonapp/mihon) tem repositório ativo. O endereço de Tachiyomi redirecionou para sua organização GitHub e o antigo repositório consultado retornou 404. Eles são leitores e ecossistemas de extensões, não catálogos com uma API hospedada para o ARK. |
| Kotatsu | Leitor e biblioteca de parsers Kotlin | [Kotatsu](https://github.com/KotatsuApp/Kotatsu) e [kotatsu-parsers](https://github.com/KotatsuApp/kotatsu-parsers) retornaram `archived=true` na API GitHub. Servem como referência técnica; não são a escolha inicial para uma integração nova mantida. |
| Mangayomi | Aplicativo leitor multiplataforma | [O aplicativo](https://github.com/kodjodevf/mangayomi) está ativo, mas [o antigo repositório de extensões consultado](https://github.com/kodjodevf/mangayomi-extensions) está arquivado. Não oferece, por si só, uma API de catálogo hospedada para o ARK; conferir manutenção de cada adaptador separadamente. |
| VK | Rede social com API | [O schema oficial](https://github.com/VKCOM/vk-api-schema) documenta a API social. Grupos/postagens/imagens não fornecem a estrutura de obra, volume, capítulo e idioma que o leitor precisa. Exigiria uma integração específica com um publicador e acesso permitido; prioridade baixa para a biblioteca em português. |

Os adapters acima foram localizados no [código Keiyoushi](https://github.com/keiyoushi/extensions-source/tree/main/src) e comparados com o índice protobuf atual. Também foram pesquisadas as árvores do Kotatsu e do antigo repositório de extensões Mangayomi. A presença de código foi confirmada; compatibilidade com uma versão específica de Suwayomi e acesso às páginas precisam ser testados separadamente. Respostas HTTP 403/503 nesta máquina descrevem o teste, sem provar bloqueio permanente ou encerramento da fonte. Não foram tentados contornos de desafios nem usados tokens, contas ou assinaturas.

Para português, a ordem de investigação fica: retestar Pluma quando disponível; avaliar Comikey Brasil conforme o acesso oferecido; avaliar Lycan com os requisitos normais do serviço; esclarecer qual MangaLivre o usuário pretende. MangaFire fica como candidato de maior manutenção. Para inglês, WeebCentral e MangaFreak são candidatos, e as plataformas editoriais exigem verificação de acesso/integração. Suwayomi continua sendo uma opção de intermediário; APIs diretamente utilizáveis podem permitir adaptadores sem esse servidor extra quando documentação, funcionamento e condições forem confirmados.

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
