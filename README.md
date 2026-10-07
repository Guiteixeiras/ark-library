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
- Leitor vertical ou por página: tela cheia, atalhos, tamanho real, qualidade original por padrão e opção econômica.
- Retomada direta pela página inicial, com avanço para o próximo capítulo quando o anterior foi concluído.
- Uma entrada por capítulo, com seleção automática de tradução e créditos da versão lida.
- Avisos ao abrir o ARK para obras em leitura e favoritos, com dispensa persistida por capítulo.
- Sugestões da IA local via Ollama: afinidade com a coleção e uma escolha fora dos gêneros mais frequentes.
- Camada de servidor para consultas ao MangaDex, com cache, tempo limite e tratamento de erros.
- Tema roxo com detalhes laranjas, modo claro/escuro, com preferência salva e uso do tema do sistema na primeira visita.
- Exportação e restauração da coleção em JSON, com validação e prévia antes da importação.

## Backup da coleção

Em **Minha coleção**, use **Exportar coleção** para baixar um arquivo com suas obras, favoritos, status e capítulos lidos. Para restaurar em outro navegador, use **Importar backup**, confira a prévia e escolha **Importar e combinar**. A importação aceita backups da ARK Library de até 10 MB; nenhum item atual é removido, e obras repetidas mantêm os dados com a atualização mais recente. Arquivos inválidos e falhas de armazenamento preservam a coleção atual.

Os idiomas disponíveis são Português (inclui pt-br e pt) e Inglês, com português por padrão e preferência persistida. Japonês fica para uma etapa futura. A coleção tem a opção Toda a coleção para mostrar todos os itens salvos sem filtro de idioma. Os detalhes de cada obra também têm seleção de idioma dos capítulos. Clique em um capítulo para ler dentro do ARK. O link da fonte continua disponível para créditos. A API permite navegar até os primeiros 10.000 resultados de uma busca; use os filtros para refinar resultados maiores.

Os dados da coleção ficam neste navegador, sem conta ou sincronização entre dispositivos. Limpar os dados do site remove a coleção. A execução local não tem autenticação; hospedar com acesso privado exige controle de acesso no serviço de hospedagem. `private: true` no package.json só impede publicação acidental do pacote no npm.

Guarde uma cópia do backup antes de limpar os dados do navegador.

## Leitura no ARK

Abra os detalhes de uma obra, escolha o idioma e clique em um capítulo. Use os controles do leitor para ajustar a largura, selecionar um capítulo ou avançar/voltar. A lista de capítulos tem paginação para acessar obras longas. O leitor oferece modos vertical e página por página. As imagens carregam gradualmente; uma página com falha tem opção de tentar novamente. Capítulos removidos ou indisponíveis mostram uma mensagem e não contornam a remoção.

A posição é salva por obra neste navegador. **Continue de onde parou**, na página inicial, abre diretamente o leitor; se o último capítulo foi concluído, abre o próximo disponível. **Retomar leitura** nos detalhes volta ao capítulo salvo, inclusive após recarregar a página. Versões de scans são reunidas pelo número do capítulo, e os créditos permanecem visíveis. Se a versão selecionada estiver indisponível, o leitor pode tentar outra tradução disponível do mesmo capítulo, sem contornar remoções. Ao chegar ao fim com todas as imagens carregadas, o capítulo é registrado como lido; também há um botão para marcar manualmente. Reler um capítulo antigo preserva o maior capítulo já registrado. A obra permanece no status Lendo até você marcá-la como Concluída. Posição, modo, qualidade, largura, tema, idioma e avisos dispensados são preferências locais e não fazem parte do backup da coleção.

**Original** usa os arquivos de origem do MangaDex, sem a compressão extra do modo econômico. A definição continua limitada ao arquivo enviado pelo grupo; capítulos antigos podem ter imagens de origem menores. **Tamanho real** permite examinar a imagem na resolução nativa, com rolagem horizontal quando necessário. F alterna tela cheia; M alterna o modo; ←/→ e Home/End navegam páginas no modo paginado. Os atalhos não interceptam campos de formulário.

Os avisos consultam capítulos disponíveis nas obras em leitura e nos favoritos, no idioma usado na última leitura ou na preferência atual. Eles indicam leitura ainda disponível, inclusive capítulos que já existiam antes de você adicionar a obra. A consulta ocorre ao abrir e ao mudar as obras acompanhadas; o botão Verificar novos capítulos permite repetir. Dispensar um aviso impede repetições do mesmo número, inclusive quando outro grupo publica uma tradução; um número posterior pode gerar novo aviso. Não há notificações do sistema nem verificação com o aplicativo fechado. O cache das consultas dura até dois minutos.

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
