# Hospedar sua ARK Library no Render

O repositório já contém `render.yaml`, que cria um **Web Service gratuito** com Node.js 24, interface e API no mesmo endereço HTTPS, acesso privado e senha gerada pelo Render. Não é necessário instalar Node no seu PC para essa publicação.

[Publicar no Render](https://render.com/deploy?repo=https://github.com/Guiteixeiras/ark-library)

## Primeiro deploy

1. Abra o link acima e entre/crie sua conta no Render. Conecte o GitHub quando solicitado e permita o acesso a `Guiteixeiras/ark-library`.
2. Confira a configuração apresentada: serviço `ark-library`, branch `main`, plano **Free**, sem banco de dados ou disco persistente. Se o painel oferecer outro plano, selecione Free antes de confirmar.
3. Crie o Blueprint. O Render instala as dependências, executa os testes, compila e inicia o servidor. Aguarde o serviço ficar **Live**.
4. Abra o serviço no painel e procure **Environment**. Copie o valor gerado de `ARK_ACCESS_PASSWORD`. O usuário de acesso é **ark** (`ARK_ACCESS_USER`). Guarde a senha em seu gerenciador de senhas; ela não está no código do repositório.
5. Abra a URL HTTPS do serviço. O navegador solicitará usuário e senha. Digite `ark` e a senha gerada para entrar.
6. Confira a busca, uma capa e um capítulo disponível. Adicione uma obra, salve progresso e recarregue para conferir a persistência. Acesse também pelo celular.

O link de publicação abre a configuração na sua conta; não é a URL da aplicação. Salvar/publicar o ambiente do Codex também não hospeda o site. Somente após o Render finalizar haverá uma URL do ARK disponível na internet.

## O que o Render configura

| Configuração | Valor |
| --- | --- |
| Runtime | Node.js 24.19.0 |
| Build | `npm ci --include=dev --no-audit --no-fund && npm test && npm run build` |
| Start | `npm start` |
| Health check | `/api/health` |
| `NODE_ENV` | `production` |
| `ARK_REQUIRE_ACCESS` | `true` |
| `ARK_ACCESS_USER` | `ark` |
| `ARK_ACCESS_PASSWORD` | Gerada pelo Render, privada |
| Porta | `PORT` fornecida pelo Render; servidor escuta em `0.0.0.0` |

`npm ci --include=dev` instala TypeScript e Vite durante a compilação mesmo com `NODE_ENV=production`. O servidor de produção exige uma senha de 16 a 1024 caracteres por padrão; se faltar, ele encerra antes de aceitar requisições. A proteção cobre a interface, arquivos, catálogo, imagens e recomendações. `/api/health` é público, retorna somente a identificação do serviço e permite que o Render verifique sua execução. A senha de acesso não é enviada ao MangaDex nem ao Ollama. Use o endereço HTTPS fornecido pela hospedagem.

## Coleção e mudança de endereço

Coleção, listas e progresso ficam no navegador. Exportar o backup antes de trocar de endereço e importar no site publicado leva esses dados para a nova origem. Uma nova hospedagem começa com a biblioteca vazia no navegador; ela não apaga a biblioteca do endereço anterior. Celular e PC têm coleções separadas até adicionarmos sincronização; use o backup para transferir.

## Ollama

O Ollama do PC não fica disponível automaticamente ao serviço no Render. Deixe `ARK_OLLAMA_URL` e `ARK_OLLAMA_MODEL` sem configurar nessa primeira publicação. A interface informa que o Ollama está desconectado e biblioteca/leitor continuam funcionando. Para usar seu modelo local, execute ARK e Ollama no mesmo PC. Nenhuma chave de IA é necessária para hospedar o leitor.

## Plano gratuito e atualizações

Segundo a [documentação do Render](https://render.com/docs/free), serviços Free entram em repouso após 15 minutos sem tráfego; o primeiro acesso seguinte pode levar algum tempo para iniciar. O plano também tem limites de uso e tráfego, relevantes porque o servidor entrega imagens. Confira os limites atuais no painel; esta configuração não cria recursos pagos.

Deploys automáticos ficam desativados. Depois de uma atualização no GitHub, abra o serviço no Render e use **Manual Deploy → Deploy latest commit**. Se necessário, o painel permite escolher um commit para rollback. Para trocar a senha, altere `ARK_ACCESS_PASSWORD` em Environment e aplique o redeploy; o navegador pode pedir as novas credenciais.

## Se algo falhar

- **Build falhou:** confira os logs, Node 24 e o build completo acima. A compilação precisa das dependências de desenvolvimento.
- **Serviço não inicia:** confira o log de configuração de acesso e a presença de `ARK_ACCESS_PASSWORD`, sem publicar a senha nos logs ou em mensagens.
- **Navegador pede acesso novamente:** confira usuário `ark` e a senha atual em Environment.
- **Catálogo ou páginas falharam:** confira a resposta e os logs da consulta ao MangaDex. O servidor precisa alcançar `api.mangadex.org`, `uploads.mangadex.org` e `*.mangadex.network`; indisponibilidade ou limites da fonte podem ser temporários.

Configuração e fluxo foram testados no ambiente de desenvolvimento com execução de produção e autenticação. O deploy real e a disponibilidade a partir do Render precisam ser verificados depois de publicar na sua conta.

Referências: [Blueprints](https://render.com/docs/blueprint-spec), [Deploy to Render](https://render.com/docs/deploy-to-render), [Node.js](https://render.com/docs/deploy-node-express-app).
