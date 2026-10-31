# Radar de Curtas

Site público com os prazos de festivais de curta-metragem. Os dados ficam no arquivo `site/dados/festivais.csv` deste repositório, atualizado toda semana por uma tarefa agendada do Claude. O site é publicado pelo Netlify a cada envio ao GitHub. Quem entra com Google pode salvar festivais e receber lembretes por e-mail antes do prazo.

```
site/                    front-end estático (HTML, CSS e JS, sem build)
site/dados/festivais.csv base de festivais (uma linha por festival)
netlify/functions/       festivals (/api/festivals), config (/api/config),
                         reminders (agendada, todo dia às 8h de Brasília), unsubscribe (/api/unsubscribe)
netlify/lib/             leitura da base, lógica dos lembretes, acesso ao Supabase
supabase/schema.sql      tabelas e regras de acesso (RLS)
tests/                   testes e preview local
```

## A base de festivais

`site/dados/festivais.csv` é público: vai ao ar junto com o site. Ponha nele só o que pode ser público. Para corrigir um festival à mão, abra o arquivo no GitHub, clique no lápis (Edit), altere e salve (Commit changes); o site atualiza em um ou dois minutos.

| Coluna | Como preencher |
|---|---|
| ID | Identificador fixo (ex.: `tampere`). **Não altere depois de publicado**: os festivais salvos pelos usuários apontam para ele. Se ficar vazio, é gerado a partir do nome. |
| Nome | Nome exibido. |
| País | Usado no filtro de país e em Brasil/Mundo. Se ficar vazio, sai do Local ("Cidade, País"; "Cidade / UF" = Brasil). |
| Local | Cidade exibida abaixo do nome. |
| Deadline | Data (15/11/2026 ou 2026-11-15). Vazio = "a confirmar". |
| Status da data | Confirmada · Estimada · A confirmar |
| Data do evento | Texto livre. |
| Duração máxima (min) | Número. Vazio = sem limite informado. |
| Gêneros aceitos | Separados por vírgula: Ficção, Documentário, Animação, Experimental, Videoclipe, Fantástico. |
| Valor inscrição · Prêmio / Benefício | Texto livre. "Verificar" e "—" não aparecem no site. |
| Link | Página de inscrição (https://…). |
| Última verificação | Data. A mais recente aparece no topo do site. |
| Publicar | "Não" esconde a linha sem apagar. |
| Qualificação | Prêmios para os quais o festival é qualificador: Oscar, BAFTA, EFA (European Film Awards), Goya. Separados por vírgula. Vira selo verde e filtro. |
| Exigência de estreia | Ex.: Mundial · Internacional · Inédito no RS · Não exige. "Não exige" alimenta o filtro "Só os que não exigem estreia". |
| Restrições | Quem pode inscrever, quando há limite: "Só filmes brasileiros", "Só filmes de escolas de cinema", "Diretores sem longa-metragem". Aparece em vermelho. |
| Temas | Recorte temático, separado por vírgula (Meio ambiente, Direitos humanos, LGBTQIA+…). Vira filtro quando houver algum preenchido. |
| Observações | Texto público que aparece na ficha do festival. |
| Regulamento | Link direto para o regulamento (https://…). Vira botão na ficha. |

Os nomes das colunas podem estar em qualquer ordem e não importa se têm acento ou maiúscula.

---

## Configuração (uma vez, ~40 min)

### 1. Supabase: banco e login com Google
1. Crie um projeto em https://supabase.com (plano Free).
2. **SQL Editor** → cole todo o `supabase/schema.sql` → **Run**.
3. Em **Project Settings → API**, copie a *Project URL* (`SUPABASE_URL`), a *anon public key* (`SUPABASE_ANON_KEY`) e a *service_role key* (`SUPABASE_SERVICE_ROLE_KEY`, que é secreta).
4. No **Google Cloud Console** (https://console.cloud.google.com):
   - **APIs e serviços → Tela de consentimento OAuth**: tipo *Externo*, nome "Radar de Curtas", e-mail de suporte. Escopos: só `email`, `profile` e `openid`. Depois, **Publicar app**.
   - **Credenciais → Criar credenciais → ID do cliente OAuth** → *Aplicativo da Web*.
     - Origens JavaScript autorizadas: `https://SEU-SITE.netlify.app`
     - URIs de redirecionamento autorizados: `https://SEU-PROJETO.supabase.co/auth/v1/callback`
   - Copie o *Client ID* e o *Client secret*.
5. No Supabase, vá em **Authentication → Sign In / Providers → Google**, ative e cole o Client ID e o Client secret.
6. Ainda no Supabase, em **Authentication → URL Configuration**:
   - *Site URL*: `https://SEU-SITE.netlify.app`
   - *Redirect URLs*: `https://SEU-SITE.netlify.app/**`

### 1b. Supabase: acompanhamento dos salvos (opcional)
Rode `supabase/migracao-2-acompanhamento.sql` no SQL Editor, do mesmo jeito que o `schema.sql`. Ela libera, na ficha de cada festival salvo, o seletor de situação: Quero inscrever · Inscrito · Selecionado · Não selecionado. Festivais marcados como Inscrito, Selecionado ou Não selecionado deixam de gerar lembrete de prazo. Sem essa migração, o site funciona normalmente, só sem o seletor.

### 2. Resend: e-mails
1. Crie uma conta em https://resend.com → **API Keys** → crie uma chave com permissão *Sending access* (`RESEND_API_KEY`).
2. **Limite importante:** sem domínio próprio verificado, o Resend só envia de `onboarding@resend.dev` **para o e-mail da sua própria conta Resend**. Não é possível verificar um subdomínio `*.netlify.app`. Os lembretes para outras pessoas só começam a funcionar quando houver um domínio próprio. Depois de verificar o domínio em **Domains**, troque `RESEND_FROM` por, por exemplo, `Radar de Curtas <lembretes@seudominio.com.br>`.

### 3. Netlify: publicar a partir do GitHub
1. No projeto do Netlify: **Project configuration → Build & deploy → Continuous deployment → Link repository** → GitHub → `aeathayde-coder/radar-de-curtas`.
2. Deixe *Build command* vazio e *Publish directory* como `site` (o `netlify.toml` já define isso).
3. A partir daí, cada envio ao GitHub publica o site sozinho, inclusive as funções (lembretes por e-mail).
4. Para os lembretes, cadastre em **Environment variables** as variáveis do `.env.example`.

Para trocar o nome do subdomínio: **Project configuration → General → Change project name**. Se mudar, atualize as URLs no Google e no Supabase.

### 4. Conferir
- A tabela deve carregar com os festivais de `site/dados/festivais.csv`.
- Entre com Google, salve um festival e abra o perfil.
- Lembretes: em **Logs → Functions → reminders → Run now** dá para disparar manualmente. O lembrete só sai se algum festival salvo estiver a exatamente 30, 14, 7, 3 ou 1 dia do prazo (conforme o perfil).

---

## Como funciona no dia a dia
- **Atualização dos dados:** a tarefa semanal (terças) revisa os prazos e grava em `site/dados/festivais.csv`; o Netlify publica sozinho.
- **Lembretes:** saem todo dia às 8h (horário de Brasília), um e-mail por pessoa reunindo os prazos do dia. Se um prazo estimado virar confirmado com outra data, o lembrete volta a valer para a nova data. Datas estimadas aparecem marcadas no e-mail.
- **Descadastro:** todo e-mail tem link de cancelamento e cabeçalho *one-click*. A pessoa também pode desligar os lembretes no perfil.

## Recursos inspirados nas plataformas internacionais
Pesquisa feita em out/2026 em FilmFreeway, Festhome, Short Film Depot e FestAgent. O que entrou no Radar, em português:
- **Ficha do festival** (clique na linha): todos os dados, links de inscrição e regulamento, salvar e agenda.
- **Selo e filtro de qualificação** (Oscar, BAFTA, EFA, Goya), como os filtros de "qualifiers" do Festhome.
- **Exigência de estreia** e filtro "não exige estreia", como o campo "premiere requirements" do FestAgent.
- **Restrições de elegibilidade** em destaque ("só brasileiros", "só filmes de escola"), como os avisos de elegibilidade do Festhome.
- **Filtro de inscrição gratuita**, como "has / does NOT have submission fees".
- **Temas**, como o filtro por tema do Festhome.
- **Acompanhamento dos salvos** (Quero inscrever → Inscrito → Selecionado / Não selecionado), como o controle de inscrições do FilmFreeway e do Short Film Depot.
- **Exportar para a agenda**: Google Agenda (por festival) e arquivo .ics (por festival ou todos os salvos, com alarme 7 dias antes).

Ficaram de fora, por exigirem moderação ou volume que o Radar ainda não tem: avaliações de festivais por cineastas, inscrição/pagamento pelo site e envio de filmes.

## Desenvolvimento local
```
npm test                                  # testes de dados e lembretes
node tests/preview-server.mjs             # preview em http://localhost:8888
netlify dev                               # site real com as variáveis do .env
```
