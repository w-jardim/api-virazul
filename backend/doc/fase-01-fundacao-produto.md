# Fase 01 — Fundação do Produto

## Visão Geral

Objetivo: definir a proposição de valor, público-alvo, objetivos do produto e regras de negócio essenciais para a primeira versão (MVP).

## Proposta de Valor

- Fornecer um serviço simples e confiável para reserva e gestão de serviços, com foco em conversão rápida e controle financeiro transparente.

## Público-alvo

- Usuários finais que desejam contratar serviços por sessão ou tempo (clientes finais).
- Operadores/fornecedores que gerenciam disponibilidade e preços.

## Objetivos do MVP

- Permitir cadastro/login de usuários.
- Permitir criação e gerenciamento de serviços e disponibilidade.
- Permitir reservas com pagamento parcial/total e o ciclo de confirmação/conversão.

## Regras de Negócio Principais

- R1: Reservas podem ser criadas como 'pending' e reservadas por um período (`reservation_expires_at`).
- R2: Uma reserva pode receber pagamentos parciais; structurally store `amount_paid` e `amount_balance`.
- R3: Conversão da reserva em serviço confirmado ocorre **in-place** (mesmo registro é atualizado), com histórico de alterações.
- R4: Registros devem suportar soft-delete (`deleted_at`) e controle de versão otimista (`version`).

## Fluxo Operacional (resumido)

1. Usuário consulta disponibilidade e inicia reserva (estado `pending`, `reservation_expires_at` definido).
2. Usuário efetua pagamento (parcial ou total). Campos financeiros atualizados: `amount_paid` incrementado, `amount_balance` recalculado.
3. Quando pagamentos cobrem o valor devido, reserva é convertida para `confirmed` (in-place).
4. Em caso de expiração sem pagamento, reserva é cancelada/expirada e disponibiliza vagas.

## Classificação Financeira

- Todos os valores monetários devem ser armazenados em centavos (inteiro) para evitar problemas de ponto flutuante.

## Glossário

- Reserva: pedido temporário de um serviço, com bloqueio de disponibilidade por tempo limitado.
- Conversão: ato de transformar uma reserva em um serviço confirmado (mesmo registro atualizado).

---

Arquivo criado como base para o MVP; ver Fase 02 e Fase 03 para modelagem funcional e técnica.
