const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');

const SECRET_KEY = process.env.JWT_SECRET;
if (!SECRET_KEY) {
  throw new Error('JWT_SECRET não definido — define-o no .env antes de arrancar o servidor');
}

// Middleware de autenticação HTTP
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided', code: 'AUTH_REQUIRED' });
  }

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token', code: 'AUTH_INVALID' });
    }
    req.user = user;
    next();
  });
}

// Limite de tentativas de login: 5 falhas por 15 min, por IP. Logins bem-sucedidos não contam.
// NOTA: se o backend correr atrás de um proxy reverso (nginx, Cloudflare…), é preciso
// app.set('trust proxy', <nº de proxies>) no server.js; senão todos os clientes partilham o IP do
// proxy e 5 falhas bloqueiam toda a gente. Exposto diretamente, não é necessário.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, error: 'Demasiadas tentativas de login. Tenta novamente dentro de 15 minutos.' },
});

// Login endpoint
function login(req, res) {
  const { username, password } = req.body;
  
  // Validação simples (TEMPORÁRIO - trocar por OAuth WSO2 depois)
  // Credenciais lidas do ambiente (ver .env.example); entradas sem valor são ignoradas
  const validUsers = [
    { username: process.env.DASHBOARD_USER_1, password: process.env.DASHBOARD_PASS_1, role: 'admin' },
    { username: process.env.DASHBOARD_USER_2, password: process.env.DASHBOARD_PASS_2, role: 'operator' }
  ].filter(u => u.username && u.password);

  const user = validUsers.find(u => u.username === username && u.password === password);

  if (user) {
    const token = jwt.sign(
      { 
        username: user.username, 
        role: user.role,
        timestamp: Date.now()
      }, 
      SECRET_KEY, 
      { expiresIn: '24h' }
    );
    
    res.json({ 
      success: true,
      token,
      user: { 
        username: user.username, 
        role: user.role 
      }
    });
  } else {
    res.status(401).json({ 
      success: false,
      error: 'Invalid credentials' 
    });
  }
}

// Verificar token (HTTP endpoint)
function verifyToken(req, res) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ valid: false, error: 'No token' });
  }

  jwt.verify(token, SECRET_KEY, (err, decoded) => {
    if (err) {
      return res.status(403).json({ valid: false, error: 'Invalid token' });
    }
    res.json({ 
      valid: true, 
      user: {
        username: decoded.username,
        role: decoded.role
      }
    });
  });
}

// Middleware de autenticação WebSocket
function authenticateWebSocket(socket, next) {
  const token = socket.handshake.auth?.token;
  
  if (!token) {
    console.log('⚠️  WebSocket conectado sem autenticação (modo dev)');
    return next(); // Permite conexão sem token em dev
  }

  jwt.verify(token, SECRET_KEY, (err, decoded) => {
    if (err) {
      console.error('❌ Token WebSocket inválido:', err.message);
      return next(new Error('Authentication error'));
    }
    
    console.log('✅ WebSocket autenticado:', decoded.username);
    socket.user = decoded;
    next();
  });
}

module.exports = { 
  authenticateToken, 
  login, 
  loginLimiter,
  verifyToken,
  authenticateWebSocket,
  SECRET_KEY 
};
