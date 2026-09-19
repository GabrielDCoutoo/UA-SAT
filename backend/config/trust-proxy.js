// config/trust-proxy.js
// Atrás de um proxy reverso (nginx), define TRUST_PROXY=<nº de proxies entre o cliente e o Node> (ex.: 1).
// Sem isto, req.ip é o IP do proxy e o rate limit do login trata todos os clientes como um só.
// NÃO definir se o Node estiver exposto diretamente: o cabeçalho X-Forwarded-For passaria a poder
// ser forjado pelo cliente, e o rate limit deixava de servir para nada.
function configureTrustProxy(app, value = process.env.TRUST_PROXY) {
  if (!value || value === 'false') return null;
  if (value === 'true') {
    throw new Error("TRUST_PROXY=true confia em qualquer X-Forwarded-For; usa o nº de proxies (ex.: TRUST_PROXY=1)");
  }
  const setting = /^\d+$/.test(value) ? Number(value) : value; // nº de saltos, ou 'loopback', etc.
  app.set('trust proxy', setting);
  return setting;
}

module.exports = configureTrustProxy;
