# ARK Library

Uma biblioteca pessoal de mangás, manhwas e manhuas. Catálogo real do MangaDex, coleção local e acompanhamento de leitura, com interface em português.

## Executar

Requer Node.js 24 e npm.

```sh
npm ci
npm run dev
```

Neste ambiente de nuvem, use `npm ci --cache /workspace/.cache/ark-library/npm --no-audit --no-fund` para manter o cache em uma pasta gravável. O script de instalação salvo na configuração já inclui esse comando e o build.

O servidor de desenvolvimento usa a porta 5173. Para gerar e executar a versão de produção:

```sh
npm run build
npm start
```

`npm start` aceita `PORT`. Os scripts ativam o suporte nativo do Node ao proxy do ambiente; fora da nuvem, também funcionam sem proxy configurado.

## O que funciona

- Catálogo e busca de obras com capítulos em português brasileiro.
- Filtros de tipo, gênero, idioma e status de publicação; ordenação e paginação do catálogo e da coleção.
- Coleção, favoritos, status e último capítulo lido, persistidos no navegador.
- Sinopse e capítulos paginados com créditos aos grupos.
- Leitor vertical dentro do ARK: largura ajustável, navegação entre capítulos, retomada de posição e progresso ao concluir.
- Camada de servidor para consultas ao MangaDex, com cache, tempo limite e tratamento de erros.
- Tema roxo com detalhes laranjas, modo claro/escuro, com preferência salva e uso do tema do sistema na primeira visita.
- Exportação e restauração da coleção em JSON, com validação e prévia antes da importação.

## Backup da coleção

Em **Minha coleção**, use **Exportar coleção** para baixar um arquivo com suas obras, favoritos, status e capítulos lidos. Para restaurar em outro navegador, use **Importar backup**, confira a prévia e escolha **Importar e combinar**. A importação aceita backups da ARK Library de até 10 MB; nenhum item atual é removido, e obras repetidas mantêm os dados com a atualização mais recente. Arquivos inválidos e falhas de armazenamento preservam a coleção atual.

Os filtros do catálogo começam em português e permitem inglês, espanhol ou todos os idiomas. Os detalhes de cada obra também têm seleção de idioma dos capítulos. Clique em um capítulo para ler dentro do ARK. O link da fonte continua disponível para créditos. A API permite navegar até os primeiros 10.000 resultados de uma busca; use os filtros para refinar resultados maiores.

Os dados da coleção ficam neste navegador, sem conta ou sincronização entre dispositivos. Limpar os dados do site remove a coleção. A execução local não tem autenticação; hospedar com acesso privado exige controle de acesso no serviço de hospedagem. `private: true` no package.json só impede publicação acidental do pacote no npm.

Guarde uma cópia do backup antes de limpar os dados do navegador.

## Leitura no ARK

Abra os detalhes de uma obra, escolha o idioma e clique em um capítulo. Use os controles do leitor para ajustar a largura, selecionar uma tradução ou avançar/voltar. A lista de capítulos tem paginação para acessar obras longas. A leitura é vertical e as imagens carregam gradualmente; uma página com falha tem opção de tentar novamente. Capítulos removidos ou indisponíveis mostram uma mensagem e não contornam a remoção.

A posição é salva por obra neste navegador. Feche o leitor e use **Retomar leitura** nos detalhes, inclusive após recarregar a página. Ao chegar ao fim com todas as imagens carregadas, o capítulo é registrado como lido; também há um botão para marcar manualmente. Reler um capítulo antigo preserva o maior capítulo já registrado. A obra permanece no status Lendo até você marcá-la como Concluída. Posição, largura e tema são preferências locais e não fazem parte do backup da coleção.

## Integrações futuras

A conexão com Nexus e o assistente ARK são planejados, não estão implementados nesta versão. A API Connection do Nexus permite login e importação/sincronização da biblioteca; a documentação fornecida não oferece imagens de capítulos. O registro OAuth depende de um app Nexus e da definição da URL de retorno. Não inclua segredos ou tokens nos arquivos do projeto ou no código do navegador.

## Rede e validação

O aplicativo precisa acessar `api.mangadex.org`, `uploads.mangadex.org` e os servidores dinâmicos de `*.mangadex.network`, incluindo `api.mangadex.network` para os relatórios de entrega exigidos pelo MangaDex@Home. O servidor do ARK verifica os destinos retornados pela API, renova a atribuição do servidor em falhas e entrega as páginas ao navegador sem enviar autenticação aos servidores de imagens. As páginas não são armazenadas permanentemente no servidor. A futura integração com Nexus usa `nexustoons.com`.

`npm run build` verifica TypeScript e gera o bundle. Com o servidor iniciado, `GET /api/catalog?query=One%20Piece` deve retornar `items` com obras reais. `GET /api/health` indica que o servidor está ativo, mas não substitui a consulta ao catálogo. Para validar a coleção, adicione uma obra, altere status/capítulo e recarregue a página.

`npm test` executa os testes de exportação/importação, validação de arquivos e combinação de progresso. As verificações funcionais no navegador cobrem tema persistido, download e restauração do backup, filtros, páginas e recuperação de falhas de armazenamento.

## Créditos e condições

Dados e capas por [MangaDex](https://mangadex.org). As imagens de leitura são fornecidas pelo MangaDex@Home, e os grupos responsáveis são indicados na lista e no leitor. Respeite a [política de uso da API](https://api.mangadex.org/docs/), incluindo créditos, pedidos de remoção e restrições a anúncios e serviços pagos. API e disponibilidade de traduções podem mudar.
