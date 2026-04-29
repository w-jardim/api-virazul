# Ambiente de Desenvolvimento - VPS Virazul

## 1. Objetivo

Este documento registra o mapa real do ambiente de desenvolvimento do Virazul na VPS e a relacao dele com o desenvolvimento local.

O objetivo e evitar confusao entre:

- codigo local
- testes locais mockados
- backend local
- frontend local
- API dev real da VPS
- frontend dev real da VPS
- MySQL dev real da VPS
- MySQL local
- Nginx/proxy dev
- containers nao-dev existentes na mesma VPS

Este documento nao contem segredos, senhas, tokens, chaves privadas ou client IDs reais.

## 2. Visao Geral do Ambiente Dev da VPS

O ambiente dev do Virazul na VPS roda via Docker Compose em:

```txt
/opt/apps/projects/virazul-dev/api-virazul/docker-compose.yml
```

O compose dev da VPS possui 3 servicos principais:

```txt
virazul-app-dev
virazul-api-dev
viraazul-mysql-dev
```

Mapa resumido:

```txt
app.dev.virazul.com
  /       -> virazul-app-dev:5173
  /api/   -> virazul-api-dev:3000 via host 127.0.0.1:3001

api.dev.virazul.com
  /       -> virazul-api-dev:3000 via host 127.0.0.1:3001

virazul-api-dev
  -> usa MySQL dev: mysql:3306 dentro da rede Docker

viraazul-mysql-dev
  -> exposto na VPS em 3308
```

## 3. Ambientes Virazul Existentes na VPS

### Ambiente dev atual

Este e o alvo da investigacao e desenvolvimento atual:

```txt
virazul-app-dev
virazul-api-dev
viraazul-mysql-dev
```

### Ambiente nao-dev existente

Tambem existem containers Virazul nao-dev:

```txt
virazul-frontend
virazul-backend
virazul-mysql
```

Esses containers nao sao o alvo da investigacao dev atual.

Nao confundir portas, bancos e dominios entre dev e nao-dev.

## 4. API Dev da VPS

Container:

```txt
virazul-api-dev
```

Dominio:

```txt
https://api.dev.virazul.com/api/v1
```

Portas:

```txt
porta host VPS: 3001
porta container: 3000
```

Banco usado:

```txt
viraazul-mysql-dev / virazul_dev
```

Env file usado pela API dev:

```txt
/opt/apps/projects/virazul-dev/api-virazul/backend/.env
```

Variaveis nao sensiveis confirmadas:

```env
NODE_ENV=development
PORT=3000
DB_HOST=mysql
DB_PORT=3306
DB_NAME=virazul_dev
DB_USER=root
CORS_ORIGIN=http://localhost:5173,http://127.0.0.1:5173,https://app.dev.virazul.com
TZ=America/Sao_Paulo
SUBSCRIPTION_ENFORCE=false
```

Nao documentar valores reais de:

```txt
DB_PASSWORD
JWT_SECRET
GOOGLE_CLIENT_ID
```

Ponto critico:

```env
SUBSCRIPTION_ENFORCE=false
```

Isso significa que, no ambiente dev real da VPS, o `subscription-guard` nao deve bloquear cedo por `subscriptions.status`.

Bloqueios de criacao podem vir de:

```txt
resolvePlan
checkAccountStatus
checkLimits
services.service.create
```

## 5. Frontend Dev da VPS

Container:

```txt
virazul-app-dev
```

Dominio:

```txt
https://app.dev.virazul.com
```

Porta:

```txt
5173
```

Arquivo `.env` do frontend dev da VPS:

```txt
/opt/apps/projects/virazul-dev/app-virazul/.env
```

Configuracao confirmada:

```env
VITE_API_BASE_URL=/api/v1
VITE_GOOGLE_CLIENT_ID=
```

Motivo:

```txt
O frontend usa VITE_API_BASE_URL.
O frontend nao usa VITE_API_URL.
```

Arquivo onde isso foi confirmado:

```txt
src/lib/api/axios.ts
```

## 6. MySQL Dev da VPS

Container:

```txt
viraazul-mysql-dev
```

Imagem:

```txt
mysql:8.0
```

Banco:

```txt
virazul_dev
```

Portas:

```txt
porta host VPS: 3308
porta container: 3306
```

Dentro da rede Docker, a API dev acessa o banco por:

```env
DB_HOST=mysql
DB_PORT=3306
DB_NAME=virazul_dev
```

Do host da VPS, o banco dev esta exposto em:

```txt
127.0.0.1:3308
```

## 7. Nginx e TLS do Ambiente Dev

Bloco dev real confirmado:

```txt
app.dev.virazul.com
  /      -> http://127.0.0.1:5173
  /api/  -> http://127.0.0.1:3001/api/

api.dev.virazul.com
  /      -> http://127.0.0.1:3001
```

Interpretacao:

```txt
https://app.dev.virazul.com
  -> frontend Vite dev server

https://app.dev.virazul.com/api/v1/health
  -> API dev via proxy /api/

https://api.dev.virazul.com/api/v1/health
  -> API dev direta via dominio dedicado
```

Arquivo Nginx identificado:

```txt
/etc/nginx/sites-enabled/virazul-dev
```

Certificado TLS:

```txt
/etc/letsencrypt/live/app.dev.virazul.com/fullchain.pem
```

SAN confirmado:

```txt
DNS:api.dev.virazul.com
DNS:app.dev.virazul.com
```

Conclusao:

```txt
O certificado cobre tanto app.dev.virazul.com quanto api.dev.virazul.com.
Nao ha problema TLS conhecido entre esses dois dominios dev.
```

## 8. Healthchecks Confirmados

Todos os endpoints abaixo retornaram `200 OK`:

```txt
http://127.0.0.1:3001/api/v1/health
https://api.dev.virazul.com/api/v1/health
https://app.dev.virazul.com/api/v1/health
https://app.dev.virazul.com
```

Resposta da API:

```json
{
  "data": {
    "status": "ok",
    "timestamp": "...",
    "environment": "development"
  },
  "meta": null,
  "errors": null
}
```

Conclusao:

```txt
API dev esta saudavel via acesso direto no host.
API dev esta saudavel via api.dev.virazul.com.
API dev esta saudavel via app.dev.virazul.com/api.
Frontend dev esta respondendo em app.dev.virazul.com.
```

## 9. Modos Oficiais de Trabalho Local

Para reduzir ambiguidade, o desenvolvimento local deve ser tratado em 3 modos oficiais.

### Modo 1: `frontend-local + api-vps`

Este e o modo padrao recomendado.

Fluxo:

```txt
frontend local -> https://api.dev.virazul.com/api/v1
```

Uso recomendado:

- ajustes de UI
- navegacao
- autenticacao
- validacao funcional contra backend real

Nao usar para:

- provar comportamento isolado do backend local
- testes destrutivos sem controle
- depuracao de middlewares locais como se fossem equivalentes ao ambiente da VPS

Origem da verdade nesse modo:

```txt
backend: API dev da VPS
banco: MySQL dev da VPS
frontend: maquina local
```

### Modo 2: `backend-local + mysql-local`

Este e o modo de desenvolvimento de backend.

Fluxo:

```txt
backend local -> MySQL local
frontend local -> backend local
```

Uso recomendado:

- desenvolvimento de rotas
- middlewares
- guards
- billing
- depuracao local com logs completos

Diretriz:

```txt
O banco local deve ser tratado como ambiente isolado e descartavel.
Ele nao substitui o banco dev da VPS.
```

Origem da verdade nesse modo:

```txt
backend: maquina local
banco: MySQL local
frontend: maquina local
```

### Modo 3: `teste-mockado` e `teste-local-com-db`

Este e o modo da suite automatizada.

Submodos:

```txt
teste-mockado
teste-local-com-db
```

Uso recomendado:

- testes unitarios
- integracao local controlada
- regressao

Origem da verdade nesse modo:

```txt
mockado: harness local
com DB: banco de teste local
```

## 10. Matriz de Origem da Verdade

| Modo | Frontend | Backend | Banco | Finalidade principal |
| --- | --- | --- | --- | --- |
| `frontend-local + api-vps` | local | VPS dev | VPS dev | UI e validacao funcional real |
| `backend-local + mysql-local` | local | local | local | desenvolvimento de API |
| `teste-mockado` | nao se aplica | local | mock | regras isoladas |
| `teste-local-com-db` | nao se aplica | local | DB de teste local | integracao automatizada |

## 11. Convencao Operacional Obrigatoria

Toda investigacao, bug report ou teste deve declarar explicitamente qual modo foi usado:

```txt
frontend-local + api-vps
backend-local + mysql-local
teste-mockado
teste-local-com-db
```

Antes de investigar erro `403` em `POST /services`, registrar:

```txt
qual endpoint foi usado
qual usuario/token foi usado
qual plano/subscription do usuario
qual ambiente foi usado
SUBSCRIPTION_ENFORCE do ambiente
```

## 12. Regras Para Variaveis de Ambiente Locais

### Backend local manual

`backend/.env.example` representa ambiente local manual.

Esse arquivo deve refletir:

```txt
backend local rodando fora do Docker
conectando em MySQL local exposto no host
```

### Backend de teste

`backend/.env.test` representa ambiente de teste automatizado local.

Ele nao deve ser usado como base para o ambiente manual de desenvolvimento.

### Frontend local

`VITE_API_BASE_URL` e a unica variavel canonica para definir base da API.

Nao usar como referencia operacional:

```txt
VITE_API_URL
```

Defaults esperados:

```txt
modo padrao: https://api.dev.virazul.com/api/v1
modo backend local: http://localhost:3000/api/v1
```

## 13. Riscos de Confusao Conhecidos

Hoje existe risco de confusao entre:

```txt
backend/.env.example -> porta 3306
backend/.env.test -> porta 3307
docker-compose.yml local -> porta 3308
frontend local -> API da VPS
frontend da VPS -> proxy relativo /api/v1
```

Tambem existe risco de confundir:

```txt
teste local mockado
comportamento real da API da VPS
```

E ainda:

```txt
SUBSCRIPTION_ENFORCE=false na VPS dev
comportamento esperado de producao
```

## 14. Comandos Uteis de Inspecao

### Listar containers

```bash
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"
```

### Listar compose ativos

```bash
docker compose ls
```

### Ver compose dev

```bash
cd /opt/apps/projects/virazul-dev/api-virazul
cat docker-compose.yml
```

### Ver env da API dev mascarado

```bash
cd /opt/apps/projects/virazul-dev/api-virazul

if [ -f backend/.env ]; then
  sed -E 's/(PASSWORD|SECRET|TOKEN|KEY|CLIENT_ID|CLIENT_SECRET|MERCADO_PAGO_ACCESS_TOKEN|STRIPE_SECRET_KEY)=.*/\1=***MASKED***/I' backend/.env
else
  echo "backend/.env ausente"
fi
```

### Ver env do frontend dev mascarado

```bash
cd /opt/apps/projects/virazul-dev/app-virazul

sed -E \
  -e 's#(VITE_API[^=]*=).*#\1***MASKED***#I' \
  -e 's#(API_URL=).*#\1***MASKED***#I' \
  -e 's#(TOKEN|SECRET|KEY|CLIENT_ID|CLIENT_SECRET|PASSWORD)=.*#\1=***MASKED***#I' \
  .env
```

### Ver bloco Nginx dev

```bash
nginx -T 2>/dev/null | sed -n '540,625p'
```

### Ver SAN do certificado TLS dev

```bash
openssl x509 -in /etc/letsencrypt/live/app.dev.virazul.com/fullchain.pem -noout -text | grep -A2 "Subject Alternative Name"
```

### Healthchecks

```bash
curl -i http://127.0.0.1:3001/api/v1/health
curl -i https://api.dev.virazul.com/api/v1/health
curl -i https://app.dev.virazul.com/api/v1/health
curl -I https://app.dev.virazul.com
```

### Ver status do compose dev

```bash
cd /opt/apps/projects/virazul-dev/api-virazul
docker compose ps
```

### Reiniciar somente o app dev

```bash
cd /opt/apps/projects/virazul-dev/api-virazul
docker compose restart app
```

Usar somente quando necessario, por exemplo apos alteracao no `.env` do frontend dev.

## 15. Regras Para Testes Locais vs VPS

Regra principal:

```txt
Teste local mockado nao e a mesma coisa que API dev real na VPS.
```

Separar sempre as estrategias:

```txt
1. Teste unitario local puro com mock
2. Teste de middleware local com mocks controlados
3. Teste de integracao local com DB local/teste
4. Teste HTTP real contra https://api.dev.virazul.com/api/v1
5. Teste via frontend local apontando para https://api.dev.virazul.com/api/v1
```

### Teste local mockado

Usar para validar funcoes, middlewares e regras isoladas.

Exemplos:

```txt
resolvePlan
checkLimits
entitlementResolver
plan-access
```

### Teste de integracao local

So deve ser usado se o ambiente local estiver claramente configurado.

Verificar antes:

```txt
NODE_ENV
.env.test
DB_HOST
DB_PORT
DB_NAME
mocks de pool.query
mocks de subscriptions.repository
```

### Teste HTTP real contra VPS

Usar para validar o comportamento real do ambiente dev.

Endpoints base:

```txt
https://api.dev.virazul.com/api/v1
https://app.dev.virazul.com/api/v1
```

## 16. Alerta Sobre `SUBSCRIPTION_ENFORCE=false`

Na API dev da VPS:

```env
SUBSCRIPTION_ENFORCE=false
```

Consequencia:

```txt
subscription-guard nao deve bloquear cedo por subscriptions.status nesse ambiente.
```

Portanto, no ambiente dev real, um `403` em `POST /services` pode vir mais provavelmente de:

```txt
resolvePlan
checkAccountStatus
checkLimits
services.service.create
```

Testes que esperam bloqueio por `subscription-guard` devem controlar explicitamente esse env.

Exemplo:

```txt
Se o objetivo do teste for validar SUBSCRIPTION_BLOCKED,
o teste deve ligar SUBSCRIPTION_ENFORCE explicitamente.
```

Nao assumir que o comportamento da VPS dev com `SUBSCRIPTION_ENFORCE=false` sera igual ao comportamento de producao.

## 17. Proximos Passos Recomendados

1. Nao continuar testes complexos antes de decidir claramente a estrategia:

```txt
frontend-local + api-vps
backend-local + mysql-local
teste-mockado
teste-local-com-db
```

2. Para o caso `POST /services`, recomecar com testes menores:

```txt
1. unitario de resolvePlan
2. unitario de checkLimits
3. integracao de POST /services somente depois
```

3. Quando validar API real, usar curl/Postman contra:

```txt
https://api.dev.virazul.com/api/v1
https://app.dev.virazul.com/api/v1
```

4. Padronizar o frontend local com:

```env
VITE_API_BASE_URL=https://api.dev.virazul.com/api/v1
```

5. Nao confundir containers dev com containers nao-dev:

```txt
dev:
  virazul-app-dev
  virazul-api-dev
  viraazul-mysql-dev

nao-dev:
  virazul-frontend
  virazul-backend
  virazul-mysql
```

6. Nao usar resultado de teste local mockado como prova direta do comportamento da VPS dev.

7. Nao usar comportamento da VPS dev com `SUBSCRIPTION_ENFORCE=false` como prova direta do comportamento de producao.

## 18. Resumo Final

O ambiente dev correto do Virazul na VPS e:

```txt
Frontend:
  https://app.dev.virazul.com
  container: virazul-app-dev
  porta host: 5173

API:
  https://api.dev.virazul.com/api/v1
  container: virazul-api-dev
  porta host: 3001
  porta container: 3000

Banco:
  container: viraazul-mysql-dev
  database: virazul_dev
  porta host: 3308
  porta container: 3306
```

O desenvolvimento local deve declarar explicitamente se esta usando:

```txt
frontend-local + api-vps
backend-local + mysql-local
teste-mockado
teste-local-com-db
```

O frontend local deve usar como base canonica:

```env
VITE_API_BASE_URL
```

E nao:

```env
VITE_API_URL
```
