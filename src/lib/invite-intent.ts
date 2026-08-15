/**
 * Continuidade do convite entre o link, o signup, a confirmação de e-mail e o login.
 *
 * O token fica APENAS no navegador do convidado (localStorage), porque o ciclo de
 * confirmação de e-mail pode abrir uma aba nova — sessionStorage se perderia.
 * Nunca é enviado a log, analytics ou tabela adicional, e nunca cria vínculo:
 * serve só para reabrir a mesma tela de convite, onde o aceite continua sendo
 * um ato humano explícito validado no servidor.
 */

const KEY = "ipi.invite_intent";
const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7;

interface StoredIntent {
  token: string;
  savedAt: number;
}

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function rememberInviteIntent(token: string): void {
  const store = storage();
  if (!store || token.trim().length < 20) return;
  const payload: StoredIntent = { token: token.trim(), savedAt: Date.now() };
  try {
    store.setItem(KEY, JSON.stringify(payload));
  } catch {
    /* armazenamento indisponível: o fluxo segue pelo link original */
  }
}

export function readInviteIntent(): string | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredIntent>;
    if (typeof parsed.token !== "string" || typeof parsed.savedAt !== "number") {
      store.removeItem(KEY);
      return null;
    }
    if (Date.now() - parsed.savedAt > MAX_AGE_MS) {
      store.removeItem(KEY);
      return null;
    }
    return parsed.token;
  } catch {
    return null;
  }
}

export function clearInviteIntent(): void {
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(KEY);
  } catch {
    /* nada a fazer */
  }
}
