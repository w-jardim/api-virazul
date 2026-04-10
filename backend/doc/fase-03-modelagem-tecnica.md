# Fase 03 — Modelagem Técnica

## Objetivo

Definir o modelo relacional, tabelas, enums, campos obrigatórios e contratos de API para implementação inicial.

## Tabelas principais (resumo)

- `users`
  - id (PK), name, email (unique), password_hash, role, created_at, updated_at, deleted_at, version

- `services`
  - id (PK), provider_id (FK -> users.id), title, description, price_cents, duration_minutes, status, created_at, updated_at, deleted_at, version

- `reservations`
  - id (PK), service_id (FK), user_id (FK), start_at, end_at, status, reservation_expires_at, amount_cents, amount_paid_cents, amount_balance_cents, created_at, updated_at, deleted_at, version

- `payments`
  - id (PK), reservation_id (FK), user_id (FK), amount_cents, method, provider_ref, status, created_at

## Observações técnicas importantes

- Monetary fields: use integer cents (e.g., `price_cents`, `amount_cents`).
- Pagamentos parciais: `amount_paid_cents` e `amount_balance_cents` em `reservations`.
- Conversão: in-place — atualizar registro de `reservations` de `pending` para `confirmed` e gravar histórico de mudanças por audit logs (ou tabela de histórico) se necessário.
- Expiração: `reservation_expires_at` — job periódicos devem expirar reservas pendentes passadas desta data.
- Soft-delete: campo `deleted_at` em tabelas que precisam de remoção lógica.
- Version: campo `version` para controle otimista (inteiro incrementado a cada alteração relevante).

## Endpoints (exemplos)

- POST /api/v1/auth/login
  - body: { email, password }
  - response: { token, user }

- GET /api/v1/users/me (auth required)

- POST /api/v1/services
  - cria um serviço (provider auth)

- POST /api/v1/reservations
  - body: { service_id, start_at, end_at }
  - cria reserva com status `pending` e `reservation_expires_at`

- POST /api/v1/reservations/:id/payments
  - body: { amount_cents, method }
  - cria pagamento; atualiza `amount_paid_cents` e `amount_balance_cents`; ao zerar balance, atualiza status para `confirmed` (versão++).

## Validações

- Valide disponibilidades do `service` antes de criar a `reservation`.
- Valide que `amount_cents` > 0 nos pagamentos.
- Use `Joi` para validação de payloads no servidor.

## Indexes e Performance

- Index em `reservations (service_id, start_at)` para consultas de disponibilidade.
- Index em `users (email)`.
- Index em `reservations (reservation_expires_at, status)` para jobs de expiração.

## Pontos em Aberto / Observações

- Definir política de rollback/estorno para pagamentos.
- Logs/auditoria para alterações in-place nas reservas.
