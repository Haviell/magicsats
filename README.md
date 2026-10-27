# MagicSats

Aplicação de rifas de Bitcoin construída com TanStack Start, Supabase e Vite.

## Desenvolvimento

Requer Bun e uma instância Supabase configurada.

```sh
bun install
bun run dev
```

Copie `.env.example` para `.env` e preencha as variáveis. A chave `SUPABASE_SERVICE_ROLE_KEY`, a chave do Resend e a URL de migração são exclusivamente do servidor; nunca use o prefixo `VITE_` nelas.

## Banco de dados

As migrações estão em `drizzle/migrations`. Configure `LOVABLE_DB_MIGRATION_URL` com uma conexão administrativa segura e aplique-as na ordem:

```sh
bunx drizzle-kit migrate
```

A migração `0002_secure_round_access_and_email_preferences` restringe a leitura de rodadas futuras, valida o acesso antecipado e a reserva do número vencedor no banco, e cria tokens de cancelamento de emails promocionais de uso único.

O acesso antecipado depende do registro da vitória da rodada atual em `raffle_winners`. O estado da rodada e a apuração do vencedor precisam ser atualizados por um processo administrativo confiável; o navegador não pode declarar uma rodada encerrada nem criar um vencedor.

## Autenticação e emails

O cadastro usa email, nickname e senha. O email de confirmação e a recuperação de senha usam o Resend quando `RESEND_API_KEY` está configurada; sem ela, o fluxo usa os emails nativos do Supabase Auth. Emails promocionais exigem consentimento explícito, são enviados individualmente e incluem um link de cancelamento com token aleatório armazenado somente como hash.

Configure no Resend um domínio verificado e `RESEND_FROM_EMAIL`. Não registre tokens, senhas ou conteúdo de emails nos logs.

## Carteira

Os saldos exibidos são apenas os valores registrados no perfil. Depósitos, saques e transferências estão desabilitados até existir uma integração real de pagamentos, conciliação e atualização transacional de saldo. Não envie Bitcoin para endereços exibidos por versões anteriores do aplicativo.

## Verificação

```sh
bun run lint
bun run test
bun run build
```
