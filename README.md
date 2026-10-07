# ARK Library

Uma biblioteca pessoal de mangás, manhwas e manhuas. Catálogo real do MangaDex, coleção local e acompanhamento de leitura, com interface em português.

## Publicar para uso pessoal

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/Guiteixeiras/ark-library)

O botão prepara um serviço Free na sua conta do Render, com HTTPS, Node 24 e senha de acesso gerada pela plataforma. Abra o painel do serviço após o deploy para obter `ARK_ACCESS_PASSWORD`; o usuário é `ark`. Consulte o [passo a passo de hospedagem](docs/hospedagem.md), incluindo transferência do backup, limites do plano e atualizações manuais. O Ollama local permanece opcional.

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
- Descoberta abre em destaques populares: até 100 obras mais acompanhadas por idioma, com avaliação bayesiana mínima 7 e pelo menos mil seguidores no MangaDex. Notas e seguidores aparecem nos cartões; busca por título e Catálogo completo permitem explorar além da seleção.
- Estante de capítulos recém-publicados, com data, selo Novo e leitura direta no ARK, em português ou inglês.
- Filtros de tipo, gênero, idioma e status de publicação; ordenação e paginação do catálogo e da coleção.
- Coleção, favoritos, status e último capítulo lido, persistidos no navegador.
- Listas personalizadas (uma obra pode entrar em várias), filtros por lista e histórico de até 500 capítulos abertos/concluídos.
- Sinopse e capítulos paginados com créditos aos grupos.
- Leitor vertical ou por página: tela cheia, atalhos, tamanho real, qualidade original por padrão e opção econômica.
- Retomada direta pela página inicial, com avanço para o próximo capítulo quando o anterior foi concluído.
- Uma entrada por capítulo, com seleção automática de tradução e créditos da versão lida.
- Avisos ao abrir o ARK para obras em leitura e favoritos, com dispensa persistida por capítulo.
- Sugestões da IA local via Ollama: afinidade com a coleção e uma escolha fora dos gêneros mais frequentes.
- Camada de servidor para consultas ao MangaDex, com cache, tempo limite e tratamento de erros.
- Tema roxo com detalhes laranjas, modo claro/escuro, com preferência salva e uso do tema do sistema na primeira visita.
- Exportação e restauração da coleção em JSON, com validação e prévia antes da importação.

## Listas, histórico e backup

Crie, renomeie ou exclua listas em **Minha coleção**; excluir uma lista preserva as obras. Nos detalhes de uma obra, marque suas listas; se necessário, a obra entra automaticamente na coleção. **Histórico** registra um capítulo somente após carregar uma imagem, indica se foi concluído e permite reabrir diretamente. Reler atualiza a data da entrada, sem duplicá-la. Limpar o histórico preserva coleção e progresso.


Em **Minha coleção**, use **Exportar coleção** para baixar obras, favoritos, status e capítulos lidos, além de listas, histórico, posições e preferências. Para restaurar, use **Importar backup**, confira a prévia e escolha **Importar e combinar**. O limite é 10 MB; nenhum item atual é removido, e obras repetidas mantêm os dados mais recentes. Listas são combinadas por identidade ou nome; histórico por capítulo. Posições locais de obras atualizadas mais recentemente são preservadas. Tema, idioma e controles do leitor são restaurados conforme a prévia. Arquivos inválidos são rejeitados antes de gravar; falhas de armazenamento revertem as gravações já feitas.

O formato principal permanece v1, com a extensão opcional `workspace.version=1`. Backups antigos restauram apenas a coleção e preservam as preferências atuais. Versões anteriores do ARK ainda reconhecem a coleção nos novos arquivos, mas não restauram a extensão.

Os idiomas disponíveis são Português (inclui pt-br e pt) e Inglês, com português por padrão e preferência persistida. Japonês fica para uma etapa futura. A coleção tem a opção Toda a coleção para mostrar todos os itens salvos sem filtro de idioma. Os detalhes de cada obra também têm seleção de idioma dos capítulos. Clique em um capítulo para ler dentro do ARK. O link da fonte continua disponível para créditos. A API permite navegar até os primeiros 10.000 resultados de uma busca; use os filtros para refinar resultados maiores.

Os dados da coleção ficam neste navegador, sem conta ou sincronização entre dispositivos. Limpar os dados do site remove a coleção. O desenvolvimento local funciona sem senha; a execução de produção (`NODE_ENV=production`) exige `ARK_ACCESS_PASSWORD` por padrão. O Render configura a proteção automaticamente. Acesso privado não sincroniza coleções entre navegadores. `private: true` no package.json só impede publicação acidental do pacote no npm.

Guarde uma cópia do backup antes de limpar os dados do navegador.

## Leitura no ARK

Abra os detalhes de uma obra, escolha o idioma e clique em um capítulo. Use os controles do leitor para ajustar a largura, selecionar um capítulo ou avançar/voltar. A lista de capítulos tem paginação para acessar obras longas. O leitor oferece modos vertical e página por página. As imagens carregam gradualmente; uma página com falha tem opção de tentar novamente. Capítulos removidos ou indisponíveis mostram uma mensagem e não contornam a remoção.

A posição é salva por obra neste navegador. **Continue de onde parou**, na página inicial, abre diretamente o leitor; se o último capítulo foi concluído, abre o próximo disponível. **Retomar leitura** nos detalhes volta ao capítulo salvo, inclusive após recarregar a página. Versões de scans são reunidas pelo número do capítulo, e os créditos permanecem visíveis. Se a versão selecionada estiver indisponível, o leitor pode tentar outra tradução disponível do mesmo capítulo, sem contornar remoções. Ao chegar ao fim com todas as imagens carregadas, o capítulo é registrado como lido; também há um botão para marcar manualmente. Reler um capítulo antigo preserva o maior capítulo já registrado. A obra permanece no status Lendo até você marcá-la como Concluída. Posição, modo, qualidade, largura, tema, idioma e avisos dispensados são preferências locais incluídas nos novos backups.

**Original** usa os arquivos de origem do MangaDex, sem a compressão extra do modo econômico. A definição continua limitada ao arquivo enviado pelo grupo; capítulos antigos podem ter imagens de origem menores. **Tamanho real** permite examinar a imagem na resolução nativa, com rolagem horizontal quando necessário. F alterna tela cheia; M alterna o modo; ←/→ e Home/End navegam páginas no modo paginado. Os atalhos não interceptam campos de formulário.

Os avisos consultam capítulos disponíveis nas obras em leitura e nos favoritos, no idioma usado na última leitura ou na preferência atual. Eles indicam leitura ainda disponível, inclusive capítulos que já existiam antes de você adicionar a obra. A consulta ocorre ao abrir e ao mudar as obras acompanhadas; o botão Verificar novos capítulos permite repetir. Dispensar um aviso impede repetições do mesmo número, inclusive quando outro grupo publica uma tradução; um número posterior pode gerar novo aviso. Não há notificações do sistema nem verificação com o aplicativo fechado. O cache das consultas dura até dois minutos.

## Capítulos recentes e destaques

**Capítulos novos** reúne traduções que ficaram disponíveis para leitura nos últimos sete dias, entre os destaques do idioma escolhido. A data usa `readableAt`, nunca a data de edição ou uma data futura de embargo. Capítulos sem páginas, externos ou removidos são descartados; traduções repetidas são agrupadas por obra, número e idioma. **Novo** significa que o capítulo recente ainda não foi aberto/lido neste navegador. A primeira imagem carregada registra a abertura no histórico, retirando o selo; capítulos até o progresso já salvo também não recebem o selo. A data é do envio da tradução ao MangaDex, não da publicação original da história.

Para limitar consultas à API pública, a estante examina até 500 envios recentes e exibe até 40 capítulos. Quando a janela foi truncada, a interface informa que pode haver outros capítulos na semana. **Salvos na coleção** filtra os destaques já salvos; os avisos de leitura pendente continuam acompanhando favoritos e obras em leitura fora dessa seleção. O botão Atualizar repete a consulta, respeitando o cache de dois minutos; não há consultas com o ARK fechado.

Os destaques vêm dos 100 títulos mais acompanhados com traduções disponíveis no idioma, filtrados por nota bayesiana ≥7 e ≥1.000 seguidores. Popularidade e avaliação ajudam a selecionar obras conhecidas, mas não garantem gosto pessoal. **Melhor avaliados** ordena essa seleção; gêneros, tipo e publicação refinam o mesmo conjunto. Uma busca por título consulta o catálogo inteiro; **Catálogo completo** também permite exploração livre.

## Sua IA local (Ollama)

O ARK usa o mesmo fluxo da sua aplicação Streamlit: servidor do ARK → API HTTP do Ollama → modelo instalado no PC. Não exige uma API de IA hospedada nem uma chave para o Ollama local. Inicie o Ollama como de costume e execute o ARK no mesmo computador com os comandos acima. Os modelos instalados aparecem automaticamente em **Sugestões do ARK**, com preferência por um modelo Llama.

A IA recebe títulos, gêneros, favoritos e status da coleção. Para coleções grandes, recebe também um resumo dos gêneros de todos os itens e até 40 obras como contexto. Os candidatos vêm do catálogo real do MangaDex, excluindo obras já salvas: até três sugestões próximas dos seus gostos e uma de outro conjunto de gêneros. A resposta é validada contra esses candidatos; obras inventadas, IDs repetidos e respostas inválidas são rejeitados. Textos de motivos são sugestões da IA e podem conter erros.

O endereço padrão é `http://127.0.0.1:11434`. Opcionalmente, copie `.env.example` para `.env` e configure `ARK_OLLAMA_URL` ou `ARK_OLLAMA_MODEL`. Os scripts de desenvolvimento e produção leem esse arquivo; `.env` é ignorado pelo Git. `OLLAMA_HOST` também é aceito como endereço. O modelo deve estar instalado; o ARK não baixa modelos automaticamente.

Na nuvem, `localhost` aponta para a máquina da nuvem, e não para seu PC. Sem um Ollama acessível ao servidor do ARK, a interface mostra **Ollama desconectado** e as demais funções continuam disponíveis. Para uso pessoal, execute ambos no seu PC. A integração e o protocolo foram testados com respostas controladas; a inferência real depende de executar com o seu Ollama.

## Integrações futuras

Conta/perfil, sincronização entre dispositivos e conexão Nexus ficam para uma etapa futura. A API Connection do Nexus permite login e importação/sincronização da biblioteca; a documentação fornecida não oferece imagens de capítulos. O registro OAuth depende de um app Nexus e da definição da URL de retorno. Não inclua segredos ou tokens nos arquivos do projeto ou no código do navegador.

## Rede e validação

O aplicativo precisa acessar `api.mangadex.org`, `uploads.mangadex.org` e os servidores dinâmicos de `*.mangadex.network`, incluindo `api.mangadex.network` para os relatórios de entrega exigidos pelo MangaDex@Home. O servidor do ARK verifica os destinos retornados pela API, renova a atribuição do servidor em falhas e entrega as páginas ao navegador sem enviar autenticação aos servidores de imagens. As páginas não são armazenadas permanentemente no servidor. A futura integração com Nexus usa `nexustoons.com`.

`npm run build` verifica TypeScript e gera o bundle. Com o servidor iniciado, `GET /api/catalog?query=One%20Piece` deve retornar `items` com obras reais. `GET /api/health` indica que o servidor está ativo, mas não substitui a consulta ao catálogo. Para validar a coleção, adicione uma obra, altere status/capítulo e recarregue a página.

`npm test` executa os testes de exportação/importação, validação de arquivos e combinação de progresso. As verificações funcionais no navegador cobrem tema, backup, filtros, retomada direta, conclusão e avanço de capítulos, preferências de idioma e leitor, tela cheia, qualidade original/econômica, avisos e recuperação de falhas. Os testes de Ollama validam o protocolo e os candidatos com respostas controladas; não substituem um teste de inferência com o modelo instalado no seu PC.

## Créditos e condições

Dados e capas por [MangaDex](https://mangadex.org). As imagens de leitura são fornecidas pelo MangaDex@Home, e os grupos responsáveis são indicados na lista e no leitor. Respeite a [política de uso da API](https://api.mangadex.org/docs/), incluindo créditos, pedidos de remoção e restrições a anúncios e serviços pagos. API e disponibilidade de traduções podem mudar.
