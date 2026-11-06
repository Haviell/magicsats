# Integração Coinbase (Business – Checkouts API)

Status: **preparada, pagamentos reais desligados.**

## Funções (server-side, nunca no navegador)
| Nome | Tipo | Uso |
|---|---|---|
| `createCoinbaseCheckout` | server function (login obrigatório) | cria depósito interno + checkout; retorna `depositId`, `checkoutUrl`, `status`, `expiresAt`. Idempotente por `idempotencyKey`. |
| `getCoinbaseCheckout` | server function (login obrigatório) | lê status do próprio depósito. |
| `simulateDepositEvent` | server function (só modo mock) | simula `pending` / `confirmed` / `expired`. |
| `coinbase-webhook` | rota pública `POST /api/public/coinbase-webhook` | recebe eventos da Coinbase. |

URL do webhook: `https://magicsats.lovable.app/api/public/coinbase-webhook`

## Segurança do webhook
- Lê o corpo bruto e o cabeçalho `X-Hook0-Signature` (`t=..,h=..,v1=..`).
- HMAC-SHA256 com `COINBASE_WEBHOOK_SECRET` sobre `t.h.valoresDosHeaders.corpo`, comparação em tempo constante, janela de 5 min.
- Assinatura inválida → 400. Secret ausente → 503.
- Evento duplicado (mesmo id) é ignorado (`payment_provider_events` único por provedor+id).
- Saldo só é creditado em evento confirmado, uma única vez (`credit_confirmed_deposit`, só o servidor pode chamar).

## Dados
`wallets` (saldo em satoshis inteiros), `deposits`, `payment_provider_events`, `ledger_entries`, `withdrawals`. Cada usuário só lê os próprios registros; ninguém escreve pelo navegador.

Estados de depósito: created, waiting_payment, processing, confirmed, completed, expired, failed, partial, overpaid.

## Secrets (somente servidor)
`COINBASE_API_KEY`, `COINBASE_API_SECRET`, `COINBASE_PROJECT_ID`, `COINBASE_WEBHOOK_SECRET` (vem da resposta ao criar a assinatura de webhook), `COINBASE_ENVIRONMENT`.
Flags: `ENABLE_MOCK_PAYMENTS` (padrão desligado), `ENABLE_REAL_COINBASE=false`, `ENABLE_REAL_WITHDRAWALS=false`.

## Testar em mock
1. Definir `ENABLE_MOCK_PAYMENTS=true`.
2. Chamar `createCoinbaseCheckout`, depois `simulateDepositEvent` com `confirmed`.
3. Conferir `deposits.status = completed` e saldo em `wallets`.

## Sandbox / produção
A chamada real (`createRealCoinbaseCheckout`) está bloqueada de propósito. Para ativar: confirmar o formato atual de `POST https://business.coinbase.com/api/v1/checkouts` e a autenticação da conta, implementar a chamada, configurar os secrets, cadastrar o webhook e só então `ENABLE_REAL_COINBASE=true` — com confirmação explícita.
Nomes exatos dos eventos devem ser conferidos no painel; o mapeamento atual é por palavra-chave (success/expired/failed/pending).

## Saques
Não implementados. Payouts dependem do produto/região da conta Coinbase; `ENABLE_REAL_WITHDRAWALS` permanece false.

## Testes
`src/test/coinbase-webhook.test.ts`: assinatura válida/alterada/ausente/expirada, mapeamento de eventos e checagem de que nenhum componente do navegador referencia secrets da Coinbase.
