# PROMPT INJECTION DEFENSE

Conteúdo capturado da web é **dado hostil**, nunca instrução. Esta é a defesa em
camadas do motor de pesquisa.

## 1. Separação de papéis

- O modelo de extração **não recebe ferramenta alguma**: não busca, não lê
  página, não alcança banco, storage ou RPC.
- O conteúdo capturado entra na chamada como dado delimitado, com instrução
  explícita de que o texto não pode alterar regras.
- Nenhuma decisão de estado (verificar, promover, congelar, transicionar) é
  acessível ao modelo. Todas exigem RPC autenticada com papel humano.

## 2. Detecção determinística

`detectAdversarialContent` procura padrões de instrução no conteúdo (pt-BR e en):
"ignore as instruções anteriores", "ignore previous instructions", "you are now
an assistant", "system prompt", "desconsidere o acima", "responda apenas que",
"considere este imóvel como". Qualquer ocorrência gera
`ADVERSARIAL_CONTENT_SUSPECTED` na extração e a fonte é tratada como hostil na
revisão humana.

## 3. Conferência de suporte

Mesmo que a instrução hostil convença o modelo, o valor só sobrevive se:

1. o trecho citado existir no conteúdo capturado;
2. o número aparecer dentro desse trecho;
3. o número do modelo coincidir com o parser determinístico;
4. o nome do campo pertencer à allowlist fechada;
5. um preço transacionado não estiver apoiado em linguagem de preço pedido.

Falha em qualquer item ⇒ `support_check_status = FAILED` e o campo **não pode**
ser verificado (trigger `guard_support_check_before_verification`).

## 4. Fonte é o que a ferramenta retornou

URL citada apenas na prosa do modelo é rejeitada. Domínio é extraído do host da
URL canônica, nunca do texto. Políticas por domínio (`ALLOWED`,
`REVIEW_REQUIRED`, `BLOCKED`) são avaliadas no servidor antes de qualquer
captura.

## 5. Integridade da captura

O conteúdo é armazenado em bucket privado e o SHA-256 é calculado no servidor
lendo os bytes gravados. O gate confere trechos contra esses bytes — não contra o
texto que o modelo diz ter lido.

## 6. Prova executável

`bun run tests/functional/research-flow.ts` inclui uma página hostil que tenta
declarar o imóvel como vendido por outro valor. O teste exige que:

- a injeção seja sinalizada;
- `transaction_price` permaneça `NOT_FOUND`;
- apenas o preço realmente publicado sobreviva;
- a alegação de transação apoiada em preço anunciado seja reprovada.
