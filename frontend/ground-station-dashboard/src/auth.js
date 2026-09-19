// Autenticação do dashboard (só necessária para ações de escrita, ex.: agendar observações).
// O resto da app é leitura pública e não passa por aqui.
//
// O token vive em sessionStorage (limpo ao fechar o separador). Fica acessível a JavaScript
// da própria página, por isso não guardes nada sensível além do JWT de sessão.

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const TOKEN_KEY = 'gs-auth-token';

export function getToken() {
  try { return sessionStorage.getItem(TOKEN_KEY); } catch { return null; }
}

function setToken(token) {
  try { sessionStorage.setItem(TOKEN_KEY, token); } catch { /* storage bloqueado */ }
}

export function logout() {
  try { sessionStorage.removeItem(TOKEN_KEY); } catch { /* storage bloqueado */ }
}

export async function login(username, password) {
  try {
    const res = await fetch(`${API_BASE}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.token) {
      setToken(data.token);
      return { success: true };
    }
    return { success: false, error: data.error || `Falha no login (HTTP ${res.status})` };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ── Pedido de login ─────────────────────────────────────────────────────────
// O <AuthGate /> (montado uma vez no App) regista aqui a função que abre o formulário.
let promptHandler = null;
let pendingLogin = null;

export function setLoginPrompt(handler) {
  promptHandler = handler;
  return () => { if (promptHandler === handler) promptHandler = null; };
}

function requestLogin() {
  if (!promptHandler) return Promise.reject(new Error('login indisponível'));
  if (!pendingLogin) {
    pendingLogin = new Promise((resolve, reject) => promptHandler({ resolve, reject }))
      .finally(() => { pendingLogin = null; });
  }
  return pendingLogin;
}

// Só um 401/403 gerado pelo NOSSO backend (com `code`) conta como "precisa de login".
// O proxy SatNOGS devolve tal e qual os 401/403 da SatNOGS, que não têm nada a ver com isto.
async function isAuthError(res) {
  if (res.status !== 401 && res.status !== 403) return false;
  const body = await res.clone().json().catch(() => null);
  return body?.code === 'AUTH_REQUIRED' || body?.code === 'AUTH_INVALID';
}

// fetch com Authorization. Se o backend responder "precisa de login", abre o formulário e
// repete o pedido uma vez. Se o utilizador cancelar, devolve a resposta original.
export async function authFetch(url, options = {}) {
  const send = () => {
    const token = getToken();
    return fetch(url, {
      ...options,
      headers: { ...options.headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
  };

  const res = await send();
  if (!(await isAuthError(res))) return res;

  logout(); // token em falta, inválido ou expirado

  try {
    await requestLogin();
  } catch {
    return res;
  }
  return send();
}
