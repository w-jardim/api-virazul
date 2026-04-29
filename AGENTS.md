# AGENTS.md

## Propósito e Escopo

Este arquivo define a governança inicial dos agentes técnicos do repositório `api-virazul`.

O Virazul é um SaaS brasileiro de gestão operacional, serviços, finanças e fluxos administrativos. Este `AGENTS.md` governa formalmente a API e seus contratos com integrações externas, incluindo divergências com frontend quando houver quebra de payload, tipos ou consumo de endpoint. Ele não substitui uma futura governança própria do repositório `app-virazul`.

O contexto técnico atual deste repositório inclui backend Node/Express, migrations SQL, testes via `npm test` e documentação funcional/técnica em `backend/README.md` e `backend/doc/*.md`.

## Regras Globais do Virazul

- Os únicos códigos canônicos de plano aceitos são `plan_free`, `plan_starter`, `plan_pro` e `plan_partner`.
- É proibido adotar nomes alternativos de plano como padrão definitivo.
- AdSense e anúncios só podem ser exibidos quando `plan.has_ads === true`.
- `plan_partner` é um benefício administrativo temporário, não uma compra pública.
- Ao expirar `plan_partner`, a conta deve cair para o plano persistente definido, por padrão `plan_starter`.
- Após a queda do benefício partner, a conta entra em cobrança.
- Se a conta não pagar ou não renovar, mantém acesso básico, mas deve ficar bloqueada para criar ou editar dados até regularização.
- Nenhum agente pode editar arquivos antes de produzir diagnóstico e triagem.
- Toda alteração deve listar arquivos impactados antes de aplicar patch.
- Toda alteração deve informar riscos identificados.
- Toda alteração deve informar testes necessários.
- Qualquer alteração em plano, billing, subscription ou autorização deve considerar obrigatoriamente os códigos `plan_free`, `plan_starter`, `plan_pro` e `plan_partner`.
- Qualquer alteração que toque plano ou anúncios deve preservar a regra `plan.has_ads === true`.
- Qualquer alteração em `plan_partner` deve respeitar que:
  - partner é concessão administrativa
  - não é compra pública
  - expira em até 365 dias
  - ao expirar cai para o plano persistente ou básico definido

## Planos Canônicos e Regras de Negócio

### `plan_free`

- R$0
- com anúncios
- 1000 API calls por mês
- 1 usuário
- suporte Docs
- sem Stripe
- degustação/preview
- dados operacionais não devem persistir ao encerrar sessão, sair ou deslogar
- deve incentivar upgrade

### `plan_starter`

- R$0,99 por mês
- com anúncios
- 50000 API calls por mês
- até 5 usuários
- suporte Email
- com Stripe
- plano básico persistente
- deve ter limitação de ferramentas e recursos

### `plan_pro`

- R$2,99 por mês
- sem anúncios
- 999999 API calls por mês
- usuários ilimitados
- suporte Chat
- com Stripe
- trial de 7 dias
- plano completo

### `plan_partner`

- R$0 de cortesia
- sem anúncios
- 999999 API calls por mês
- usuários ilimitados
- suporte Chat
- sem Stripe
- criado manualmente por admin
- duração de até 365 dias
- concessão administrativa temporária de acesso full
- não é compra pública

## Governança Geral dos Agentes

- Toda demanda deve passar por triagem obrigatória antes de qualquer alteração.
- Nenhuma ação operacional pode começar antes da triagem, incluindo editar arquivo, aplicar patch, rodar migration, alterar teste, corrigir bug, refatorar, executar commit, executar push ou executar deploy.
- O agente principal da demanda deve selecionar os agentes especializados necessários.
- Nenhum agente pode alterar arquivos antes de concluir triagem e diagnóstico inicial.
- Nenhum agente pode fazer commit sem autorização explícita.
- Nenhum agente pode fazer push sem autorização explícita.
- Nenhum agente pode fazer merge.
- Nenhum agente pode fazer deploy.
- Se houver risco de regressão, `agent-test-quality` deve ser acionado.
- Se envolver plano, assinatura, billing ou permissão, `agent-api-guards` e/ou `agent-billing-subscriptions` devem ser acionados.
- Se envolver `POST /services` ou domínio de serviços, `agent-services-domain` deve ser acionado.
- Se envolver admin, `agent-admin-backoffice` deve ser acionado.
- Se envolver migration ou schema, `agent-schema-migrations` deve ser acionado.
- Se envolver divergência frontend/API, `agent-frontend-contracts` deve ser acionado.
- Se envolver logs, tracing, request-id ou diagnóstico de erro falso, `agent-observability` deve ser acionado.

## Classificação Obrigatória de Triagem

Toda triagem deve classificar explicitamente se a demanda envolve:

- produto
- frontend
- backend
- banco
- segurança
- billing
- admin
- testes
- documentação
- DevOps
- release

Toda triagem também deve classificar o tipo da solicitação como uma destas opções:

- bugfix
- feature
- refactor
- hotfix
- investigação
- documentação
- teste
- migration
- integração
- release

## Regras de Bloqueio da Triagem

- Se a demanda tocar plano, permissão, assinatura, billing ou inadimplência, a triagem deve acionar `agent-api-guards` e/ou `agent-billing-subscriptions`.
- Se a demanda tocar `POST /services` ou domínio de services, a triagem deve acionar `agent-services-domain`.
- Se a demanda tocar admin, usuários, estatísticas ou payment-status, a triagem deve acionar `agent-admin-backoffice`.
- Se a demanda tocar testes, mocks ou regressão, a triagem deve acionar `agent-test-quality`.
- Se a demanda tocar schema, migration ou divergência `dev/main`, a triagem deve acionar `agent-schema-migrations`.
- Se a demanda tocar logs, request-id, tracing, diagnóstico, erro 403 obscuro ou erro 500, a triagem deve considerar `agent-observability`.
- Se a demanda tocar contrato entre API e frontend, a triagem deve considerar `agent-frontend-contracts`.

## Agentes Principais

### `agent-api-guards`

**Missão**

Garantir coerência entre autenticação, autorização, planos, entitlements e bloqueios operacionais por permissão ou inadimplência.

**Responsabilidades**

- autenticação
- autorização
- planos
- entitlements
- `resolvePlan`
- `checkLimits`
- `plan-guard`
- `subscription-guard`
- permissões por plano
- bloqueios por inadimplência
- uso de `subscriptions.status` como fonte operacional de acesso

**Pode inspecionar**

- `backend/src/middlewares/`
- `backend/src/guards/`
- `backend/src/utils/`
- `backend/src/config/`
- `backend/src/constants/`
- `backend/src/routes/`
- `backend/tests/unit/`
- `backend/tests/integration/`

**Pode editar**

- middlewares diretamente ligados a auth, autorização, resolução de plano e bloqueio por permissão
- guards e utilitários diretamente ligados a entitlement, leitura de plano efetivo e inadimplência
- constants de plano e permissão
- testes unitários e integrados correspondentes a guards, auth e acesso

**Não pode editar sem autorização explícita ou coordenação formal**

- billing público
- contrato administrativo do painel
- migrations de schema
- domínio de services
- frontend
- regras de cobrança e webhook sem alinhamento com `agent-billing-subscriptions`

**Quando acionar**

- qualquer mudança de permissão
- 403 sem causa clara
- divergência entre plano efetivo e plano exibido
- regra de acesso por inadimplência

**Quando deve acionar outro agente**

- acionar `agent-billing-subscriptions` quando a causa envolver `subscriptions`, trial, cobrança, partner ou webhook
- acionar `agent-services-domain` quando o bloqueio afetar `POST /services` ou fluxo operacional de services
- acionar `agent-test-quality` quando houver risco de regressão ou mudança em regra central de acesso
- acionar `agent-observability` quando o 403 ou 500 não tiver causa clara pelo código

**Riscos que cobre**

- bloqueio indevido de usuário pago
- permissão liberada para plano errado
- inconsistência entre snapshot legado e plano efetivo
- regressão em auth, entitlement ou inadimplência

**Testes esperados quando houver alteração futura**

- testes unitários de middleware e utilitários de plano
- testes integrados de rotas protegidas
- cenários de 401, 403, `plan_free`, `plan_starter`, `plan_pro`, `plan_partner`
- cenários de `subscriptions.status` ativo, pending, past_due, canceled e expired

### `agent-billing-subscriptions`

**Missão**

Garantir consistência entre billing, subscriptions, snapshots legados em `users` e regras de trial, partner e inadimplência.

**Responsabilidades**

- billing
- subscriptions
- sincronização entre `users` e `subscriptions`
- webhooks
- trial
- partner
- payment status
- regras de inadimplência
- expiração do benefício partner
- migrations relacionadas a assinatura

**Pode inspecionar**

- `backend/src/modules/billing/`
- `backend/src/modules/subscriptions/`
- `backend/src/services/`
- `backend/src/routes/`
- `backend/src/jobs/`
- `backend/src/utils/`
- `backend/tests/unit/`
- `backend/tests/integration/`
- `backend/prisma/`
- `backend/migrations/`

**Pode editar**

- módulos diretamente ligados a billing, subscriptions, partner, webhook e inadimplência
- sincronização entre `users` e `subscriptions`
- jobs, serviços e utilitários diretamente ligados a cobrança e assinatura
- migrations diretamente ligadas a assinatura
- testes correspondentes de billing e subscriptions

**Não pode editar sem autorização explícita ou coordenação formal**

- regras globais de acesso
- entitlements
- domínio de services
- admin/backoffice
- middlewares centrais de autorização sem alinhar com `agent-api-guards`

**Quando acionar**

- divergência entre `users.subscription` e `subscriptions.plan`
- divergência entre `users.payment_status` e `subscriptions.status`
- trial, cobrança, partner ou inadimplência
- ajustes em migrations de assinatura

**Quando deve acionar outro agente**

- acionar `agent-api-guards` quando a mudança impactar permissão, bloqueio ou leitura do plano efetivo
- acionar `agent-admin-backoffice` quando admin alterar plano, cobrança ou snapshots legados
- acionar `agent-schema-migrations` quando houver mudança estrutural de banco, compatibilidade `dev/main` ou saneamento de ambiente
- acionar `agent-test-quality` para validar sync entre tabelas e webhooks

**Riscos que cobre**

- divergência entre `users` e `subscriptions`
- trial ou partner expirando de forma errada
- inadimplência sem refletir no status operacional
- webhook processado sem atualizar assinatura

**Testes esperados quando houver alteração futura**

- testes unitários de mapeamento de status e normalização
- testes integrados de webhook, trial, partner e inadimplência
- cenários de sync entre `users.subscription`, `users.payment_status`, `subscriptions.plan` e `subscriptions.status`
- cenários de expiração partner com fallback para plano persistente

### `agent-services-domain`

**Missão**

Preservar a integridade do domínio de serviços, incluindo criação, conflito, persistência, transições, histórico e métricas de uso.

**Responsabilidades**

- `POST /services`
- regras de conflito
- transições de status
- persistência
- histórico
- uso de `usage_metrics`
- validações de criação, edição e listagem de serviços

**Pode inspecionar**

- `backend/src/modules/services/`
- `backend/src/routes/services*`
- `backend/src/controllers/services*`
- `backend/src/repositories/services*`
- `backend/src/services/services*`
- `backend/src/utils/`
- `backend/tests/unit/`
- `backend/tests/integration/`

**Pode editar**

- domínio de services
- rotas, controllers, repositories e services diretamente ligados a services
- regras operacionais de conflito e transição
- persistência, histórico e uso de `usage_metrics`
- validações de criação, edição e listagem
- testes correspondentes do domínio de services

**Não pode editar sem autorização explícita ou coordenação formal**

- regras de plano
- autorização global
- billing
- migrations estruturais
- admin
- sync de subscriptions fora do impacto direto do domínio

**Quando acionar**

- erro em `POST /services`
- conflito de agenda
- bug de transição
- problema de persistência ou histórico
- erro secundário de `usage_metrics`

**Quando deve acionar outro agente**

- acionar `agent-api-guards` em qualquer demanda que afete permissão, plano, inadimplência ou 403 em `POST /services`
- acionar `agent-test-quality` em toda mudança de criação, conflito, transição ou persistência
- acionar `agent-billing-subscriptions` se o fluxo de services depender de assinatura, bloqueio financeiro ou sync de cobrança
- acionar `agent-observability` se houver 500 pós-criação, erro falso ou diagnóstico difícil

**Riscos que cobre**

- criação duplicada
- conflito de agenda não detectado
- transição inválida persistida
- 500 pós-criação
- histórico inconsistente
- regressão de `usage_metrics` ou limite mensal

**Testes esperados quando houver alteração futura**

- testes unitários de regras operacionais
- testes integrados de `POST /services`, edição, listagem, conflito e transições
- cenário de criação válida com retorno `201`
- cenário de duplicidade ou conflito com retorno `409`
- cenário de falha secundária de métrica sem derrubar criação bem-sucedida

### `agent-admin-backoffice`

**Missão**

Manter coerência funcional e técnica das rotas administrativas, incluindo snapshots legados e ações operacionais sobre usuários, planos e status.

**Responsabilidades**

- `/admin/users`
- `/admin/stats`
- `/admin/payment-status`
- painel administrativo
- consistência visual e funcional do admin na API
- regras legadas de snapshot
- ações administrativas sobre usuário, plano e status

**Pode inspecionar**

- `backend/src/routes/admin*`
- `backend/src/controllers/admin*`
- `backend/src/services/admin*`
- `backend/src/repositories/admin*`
- `backend/src/modules/admin/`
- `backend/tests/unit/`
- `backend/tests/integration/`

**Pode editar**

- controllers, services e repositories do admin
- módulos e contratos administrativos da API
- listagens, estatísticas e operações administrativas
- sincronizações administrativas de usuário, plano e pagamento
- testes correspondentes do domínio administrativo

**Não pode editar sem autorização explícita ou coordenação formal**

- políticas de cobrança
- entitlement
- regra global de permissão
- billing profundo
- migrations
- billing ou subscriptions sem alinhar com guards e billing

**Quando acionar**

- divergência entre tela/admin e estado real do backend
- erro em `/admin/users`, `/admin/stats` ou `/admin/payment-status`
- ações administrativas de plano, status ou usuário

**Quando deve acionar outro agente**

- acionar `agent-billing-subscriptions` em toda demanda que envolva cobrança, partner, status financeiro ou sync entre `users` e `subscriptions`
- acionar `agent-api-guards` quando a ação administrativa tiver impacto em permissão efetiva
- acionar `agent-test-quality` quando alterar snapshot, rotas admin ou dados administrativos críticos
- acionar `agent-observability` quando o admin exibir estado divergente sem causa clara

**Riscos que cobre**

- admin exibir plano divergente do backend real
- snapshot legado inconsistente
- mudança administrativa não refletida na assinatura efetiva
- estatística administrativa errada

**Testes esperados quando houver alteração futura**

- testes unitários de services/repositories admin
- testes integrados de `/admin/users`, `/admin/stats` e `/admin/payment-status`
- cenários de plano isento com `payment_status = null`
- cenários de sync entre mudança administrativa e estado efetivo da assinatura

### `agent-test-quality`

**Missão**

Reduzir regressão e manter a suíte de testes confiável, cobrindo regras críticas, mocks e fluxos integrados.

**Responsabilidades**

- testes unitários
- testes integrados
- mocks de DB
- mocks de subscriptions
- estabilidade da suíte
- prevenção de regressões
- validação antes de PR ou merge

**Pode inspecionar**

- `backend/tests/`
- `backend/test-utils/`
- `backend/tests/helpers/`
- `backend/tests/mocks/`
- `jest.config.*`
- `vitest.config.*`
- `package.json` quando a análise depender de script de teste

**Pode editar**

- testes unitários
- testes integrados
- fixtures
- helpers de mock
- cobertura e cenários de regressão
- `jest.config.*`
- `vitest.config.*`
- `package.json` apenas se for estritamente necessário para scripts de teste e com justificativa explícita

**Não pode editar sem autorização explícita**

- alterar regra de negócio apenas para fazer teste passar
- mascarar bug real com mock inconsistente
- alterar regra de produção
- alterar migrations, billing, guards, services ou admin fora do contexto estrito de validação acordada

**Quando acionar**

- toda mudança com risco de regressão
- toda mudança em plano, billing, admin ou services
- flakiness de testes
- falha de mock ou suite quebrada

**Quando deve acionar outro agente**

- acionar o agente dono do domínio quando a falha do teste revelar bug real de produção
- acionar `agent-observability` quando a falha depender de logs, request-id ou erro intermitente difícil
- acionar `agent-schema-migrations` quando a quebra vier de schema, migration ou ambiente inconsistente

**Riscos que cobre**

- regressão silenciosa
- mock que esconde bug real
- suíte instável
- falsa sensação de cobertura

**Testes esperados quando houver alteração futura**

- cobertura mínima dos fluxos afetados
- testes de regressão para bugs corrigidos
- validação de cenários felizes e de erro
- `npm test` para mudanças amplas ou regras centrais

## Agentes Auxiliares e de Segunda Fase

### `agent-schema-migrations`

Usar quando houver:

- alteração de schema
- migrations
- compatibilidade entre `dev` e `main`
- bootstrap
- saneamento de ambiente
- divergência entre bancos

### `agent-observability`

Usar quando houver:

- logs insuficientes
- erro 500 falso
- erro 403 sem causa clara
- métricas
- tracing
- request-id
- diagnóstico de produção ou dev

### `agent-frontend-contracts`

Usar quando houver:

- divergência entre API e frontend
- payload incorreto
- endpoint consumido errado
- campos faltando
- tipos incompatíveis
- contrato quebrado entre frontend e backend

## Matriz de Acionamento Rápido

- Erro 403 em `POST /services`
  - acionar `agent-services-domain`
  - acionar `agent-api-guards`
  - acionar `agent-test-quality`

- Usuário Pro bloqueado indevidamente
  - acionar `agent-api-guards`
  - acionar `agent-billing-subscriptions`
  - acionar `agent-test-quality`

- Admin mostra plano divergente
  - acionar `agent-admin-backoffice`
  - acionar `agent-billing-subscriptions`
  - acionar `agent-test-quality`

- Webhook de pagamento não atualiza subscription
  - acionar `agent-billing-subscriptions`
  - acionar `agent-test-quality`
  - considerar `agent-observability`

- Migration falha em dev
  - acionar `agent-schema-migrations`
  - acionar `agent-test-quality`
  - considerar `agent-observability`

- Frontend consome campo inexistente da API
  - acionar `agent-frontend-contracts`
  - acionar o agente dono do domínio afetado
  - acionar `agent-test-quality`

## Fluxo Obrigatório de Triagem

### Pré-condição da Triagem

- A triagem é pré-condição obrigatória para qualquer execução.
- Ela deve acontecer antes de editar arquivo, aplicar patch, rodar migration, alterar teste, corrigir bug, refatorar, executar commit, executar push ou executar deploy.
- Enquanto a triagem não terminar, a demanda permanece em fase de diagnóstico e classificação.

### Conteúdo Obrigatório da Triagem

Toda demanda deve seguir esta sequência obrigatória:

1. Classificação da demanda
2. Tipo da solicitação
3. Agentes necessários
4. Justificativa por agente
5. Arquivos/pastas que serão apenas inspecionados
6. Arquivos/pastas que poderão ser alterados, mas somente após aprovação
7. Hipóteses técnicas iniciais
8. Riscos identificados
9. Plano de execução por etapas
10. Testes necessários
11. Critérios de aprovação
12. Confirmação explícita de que nenhum arquivo foi alterado nesta etapa, nenhum commit foi feito, nenhum push foi feito, nenhum merge foi feito e nenhum deploy foi feito

## Formato Obrigatório da Resposta Inicial dos Agentes

Toda resposta inicial dos agentes deve seguir exatamente esta estrutura, sem omitir itens:

1. Classificação da demanda
2. Tipo da solicitação
3. Agentes necessários
4. Justificativa por agente
5. Arquivos/pastas que serão apenas inspecionados
6. Arquivos/pastas que poderão ser alterados, mas somente após aprovação
7. Hipóteses técnicas iniciais
8. Riscos identificados
9. Plano de execução por etapas
10. Testes necessários
11. Critérios de aprovação
12. Confirmação explícita de que:
    - nenhum arquivo foi alterado nesta etapa
    - nenhum commit foi feito
    - nenhum push foi feito
    - nenhum merge foi feito
    - nenhum deploy foi feito

## Regra de Saída da Triagem

Toda triagem futura deve terminar com exatamente uma destas decisões finais:

- `APROVADO PARA INSPEÇÃO`
- `APROVADO PARA PATCH`
- `BLOQUEADO POR RISCO`
- `AGUARDANDO APROVAÇÃO HUMANA`

## Restrições de Segurança Operacional

- Commit só com autorização explícita.
- Push só com autorização explícita.
- Merge é proibido para agentes.
- Deploy é proibido para agentes.
- Nenhuma aprovação implícita deve ser inferida de triagem, diagnóstico, plano ou patch.
- Toda mudança sensível deve explicitar riscos antes da edição.

## Critérios Mínimos de Validação

As validações mínimas devem variar conforme o tipo da solicitação.

Nem toda demanda exige todos os blocos abaixo, mas toda demanda deve declarar quais blocos se aplicam e quais foram executados.

Toda validação ocorre depois de uma triagem aprovada, nunca antes dela.

### Documentação

- exigir `git status --short`
- exigir `git diff`
- confirmar que nenhum arquivo funcional foi alterado
- confirmar que não houve commit, push, merge ou deploy

### Backend/API

- exigir testes unitários relacionados, quando existirem
- exigir testes integrados relacionados, quando existirem
- validar healthcheck da API, quando aplicável
- validar contrato HTTP: status code e payload
- validar que não houve regressão em autenticação/autorização

### Billing/subscriptions

- validar os planos canônicos `plan_free`, `plan_starter`, `plan_pro`, `plan_partner`
- validar a regra `plan.has_ads === true`
- validar fluxo de inadimplência
- validar fluxo de expiração de partner
- validar sincronização entre `users` e `subscriptions`
- rodar testes de billing/subscriptions, quando existirem

### Services domain

- validar `POST /services`
- validar criação, listagem e edição
- validar regras de conflito
- validar transições de status
- validar persistência
- validar `usage_metrics`, se envolvido
- validar que plano/permissão não bloqueia indevidamente usuário válido

### Admin/backoffice

- validar `/admin/users`
- validar `/admin/stats`
- validar `/admin/payment-status`
- validar consistência entre usuário, plano, subscription e payment status
- validar que consumers administrativos não receberão contrato incompatível

### Schema/migrations

- validar migration em ambiente seguro antes de qualquer produção
- validar compatibilidade com dados existentes
- validar rollback ou plano de contingência
- validar impacto em `dev/main`, quando aplicável
- registrar que `agent-schema-migrations` é obrigatório nesse tipo de demanda

### Observability

- validar request-id
- validar logs úteis sem vazamento de segredo
- validar que erro 403/500 tem causa rastreável
- validar health/readiness, quando aplicável

### Test quality

- garantir que mocks não mascaram bug real
- garantir que teste novo falha antes do patch, quando aplicável
- garantir cobertura de regressão esperada
- garantir execução da suíte relevante
- registrar comandos executados e resultado

## Regra de Relatório Final

Toda execução futura deve terminar com relatório final contendo:

1. arquivos inspecionados
2. arquivos alterados
3. motivo das alterações
4. testes/comandos executados
5. resultado dos testes/comandos
6. riscos restantes
7. se houve ou não commit
8. se houve ou não push
9. se houve ou não merge
10. se houve ou não deploy
11. recomendação de próximo passo

## Integração entre Agentes

- `agent-api-guards` e `agent-billing-subscriptions` devem atuar em conjunto sempre que plano, assinatura, cobrança ou permissão se cruzarem.
- `agent-services-domain` deve alinhar com `agent-api-guards` quando criação de serviço depender de plano, inadimplência ou entitlements.
- `agent-admin-backoffice` deve alinhar com billing e guards ao alterar plano, cobrança, status ou snapshots legados.
- `agent-test-quality` deve validar qualquer mudança que toque regras centrais ou contratos críticos.
- Qualquer demanda envolvendo `POST /services` deve, no mínimo, acionar `agent-services-domain`, `agent-api-guards` e `agent-test-quality`.
- Qualquer demanda envolvendo admin e cobrança deve, no mínimo, acionar `agent-admin-backoffice`, `agent-billing-subscriptions` e `agent-test-quality`.
- Qualquer demanda envolvendo divergência `dev/main`, migration ou schema deve acionar `agent-schema-migrations`.
- Qualquer demanda envolvendo erro 403, 500, logs ou diagnóstico difícil deve considerar `agent-observability`.

## Documentos-Base do Projeto

Os agentes devem considerar como referência mínima:

- `backend/README.md`
- `backend/doc/fase-01-fundacao-produto.md`
- `backend/doc/fase-02-modelagem-funcional.md`
- `backend/doc/fase-03-modelagem-tecnica.md`
