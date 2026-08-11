# Testes negativos de segurança

Provam que as invariantes forenses são impostas pelo PostgreSQL, e não pela
interface. Cada asserção espera **falha** da operação; um bypass bem-sucedido é
reportado como `SECURITY REGRESSION`.

## Execução

```bash
set -a && . ./.env && set +a
SUPABASE_SERVICE_ROLE_KEY=... bun run tests/security/negative-tests.ts
```

A service role é usada **apenas** para criar usuários efêmeros e fixtures.
Nenhuma asserção de segurança é feita com ela.

Saída: `PASS`/`FAIL` por asserção e um resumo. Código de saída `1` se houver
qualquer regressão.

Contraparte positiva: `bun run tests/functional/market-flow.ts` (33 asserções)
prova que o caminho legítimo continua funcionando — uma invariante que bloqueia
o ataque e também o uso correto é considerada defeito.

## Cobertura (84 asserções)

1. Acesso anônimo (tabelas e RPCs)
2. Isolamento cross-tenant
3. Autoridade de validação (RBAC + caminho RPC obrigatório)
4. Integridade da trilha de auditoria
5. Imutabilidade da prova bruta
6. Imutabilidade de tenant e máquina de estados
7. Regras de composição de dataset (inclusive cross-case)
8. Congelamento, manifesto SHA-256 e imutabilidade pós-freeze
9. Escalação de privilégio em membros
10. Escopo de storage

## Limitação de limpeza

Tabelas append-only recusam `DELETE` por desenho, inclusive para a service role.
Ao final, os usuários de teste são removidos e as organizações de fixture são
renomeadas para `ZZ-SECURITY-TEST-FIXTURE-<timestamp>`; as linhas de evidência,
dataset e auditoria permanecem no banco por imposição das próprias garantias.
Rodar em ambiente de produção deixa resíduo identificável — preferir ambiente de
preview.
