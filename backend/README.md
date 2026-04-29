# RAS Backend

Backend scaffold for RAS project. Run inside the `backend/` folder.

## Scripts

- `npm run migrate` - run SQL migrations
- `npm run seed` - run DB seed
- `npm run dev` - start server
- `npm test` - run tests

## Regras de Plano e Billing

- `plan_free`: degustacao com anuncios e sem persistencia operacional
- `plan_starter`: plano persistente basico, com limitacoes funcionais e anuncios
- `plan_pro`: plano persistente completo, sem anuncios
- `partner`: condicao administrativa temporaria, concedida apenas por admin, sem virar plano publico

## Modos Locais Oficiais

Para evitar confusao entre ambiente local e ambiente dev da VPS, o backend deve ser usado em modos explicitos.

### 1. `frontend-local + api-vps`

Uso recomendado para desenvolvimento de interface.

Caracteristicas:

- frontend local
- backend real na VPS
- banco real da VPS

Endpoint base esperado no frontend:

```txt
https://api.dev.virazul.com/api/v1
```

### 2. `backend-local + mysql-local`

Uso recomendado para desenvolvimento de API.

Caracteristicas:

- backend local via `npm run dev`
- banco local
- sem dependencia da API hospedada na VPS

Neste repositorio:

- `backend/.env.example` representa ambiente local manual
- `docker-compose.yml` representa a stack local de MySQL e API

### 3. `teste-mockado` e `teste-local-com-db`

Uso recomendado para a suite automatizada.

Caracteristicas:

- `backend/.env.test` representa ambiente de teste automatizado
- testes mockados nao provam comportamento da API real da VPS
- testes com DB local nao devem tocar o banco `virazul_dev` da VPS

## Portas e Referencias

Convencao atual:

```txt
API local: 3000
API dev da VPS via host: 3001
MySQL local do compose: 3308 -> 3306
DB de teste local: 3307
```

Atencao:

```txt
backend/.env.example e ambiente local manual
backend/.env.test e ambiente de teste
docker-compose.yml local nao representa a stack hospedada na VPS
```

## Regra de Diagnostico

Qualquer investigacao de backend deve registrar explicitamente qual modo foi usado:

```txt
frontend-local + api-vps
backend-local + mysql-local
teste-mockado
teste-local-com-db
```
