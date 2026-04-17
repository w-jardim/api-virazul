# Fase 02 — Modelagem Funcional

## Objetivo

Descrever entidades de negócio, atributos essenciais, relacionamentos e estados, suficientes para implementar a API e o banco de dados.

## Entidades Principais

- Usuário (`User`)
  - id, name, email, role, created_at, updated_at

- Serviço (`Service`)
  - id, provider_id, title, description, price_cents, duration_minutes, status, created_at, updated_at

- Reserva (`Reservation`)
  - id, service_id, user_id, start_at, end_at, status (pending/confirmed/cancelled/expired), reservation_expires_at, amount_cents, amount_paid_cents, amount_balance_cents, version, created_at, updated_at

- Pagamento (`Payment`)
  - id, reservation_id, user_id, amount_cents, method, status, created_at

## Relacionamentos

- `User 1..* Service` (um fornecedor pode ter vários serviços).
- `User 1..* Reservation` (um usuário pode ter muitas reservas).
- `Service 1..* Reservation`.
- `Reservation 1..* Payment` (pagamentos parciais suportados).

## Estados e Regras

- Reserva `pending`: criada e aguardando confirmação. Possui `reservation_expires_at`.
- Reserva `confirmed`: valor total pago ou confirmado pelo operador; mantém histórico de alterações.
- Reserva `expired`: quando `reservation_expires_at` passou sem pagamento suficiente.

Regras importantes:
- Pagamentos incrementam `amount_paid_cents`; `amount_balance_cents = amount_cents - amount_paid_cents`.
- A conversão de `pending` para `confirmed` é feita no mesmo registro (in-place). Deve-se incrementar `version` em cada modificação para controle otimista.

## Cenários de Uso (exemplos)

- Criação de reserva com bloqueio de 15 minutos.
- Pagamento parcial (ex.: entrada 30%), seguido de pagamento complementar antes da expiração.
- Reserva expirada libera disponibilidade e sinaliza notificação ao usuário.

## Alertas e Monitoramento

- Jobs periódicos para expirar reservas pendentes.
- Notificações ao usuário quando falta pouco tempo para `reservation_expires_at`.

## Pontos em Aberto

- Política de estorno/refund (práticas e prazos).
- Regras detalhadas de cancelamento pelo provedor.
