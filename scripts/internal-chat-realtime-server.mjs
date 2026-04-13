import http from 'node:http';
import { createHmac } from 'node:crypto';
import { Server } from 'socket.io';
import { INTERNAL_CHAT_SOCKET_EVENT, translateInternalChatNotification } from './internal-chat-realtime-contract.mjs';

const HOST = process.env.INTERNAL_CHAT_SOCKET_HOST || '127.0.0.1';
const PORT = Number(process.env.INTERNAL_CHAT_SOCKET_PORT || 8082);
const SOCKET_PATH = process.env.INTERNAL_CHAT_SOCKET_PATH || '/socket.io';
const TOKEN_SECRET = process.env.AUTH_SECRET || process.env.APP_KEY || 'change-this-secret';
const NOTIFY_SECRET = process.env.INTERNAL_CHAT_SOCKET_SECRET || TOKEN_SECRET;

const json = (response, statusCode, payload) => {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(payload));
};

const base64UrlEncode = (value) => Buffer.from(value).toString('base64url');

const verifyToken = (token) => {
  if (typeof token !== 'string' || token.trim() === '') {
    throw new Error('Missing token');
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    throw new Error('Invalid token format');
  }

  const [payloadB64, sigB64] = parts;
  const expected = base64UrlEncode(createHmac('sha256', TOKEN_SECRET).update(payloadB64).digest());
  if (expected !== sigB64) {
    throw new Error('Invalid token signature');
  }

  const payloadJson = Buffer.from(payloadB64, 'base64url').toString('utf8');
  const payload = JSON.parse(payloadJson);
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid token payload');
  }

  const exp = Number(payload.exp || 0);
  if (exp <= 0 || exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Token expired');
  }

  return payload;
};

const server = http.createServer((request, response) => {
  if (!request.url) {
    json(response, 404, { error: 'Not found' });
    return;
  }

  const url = new URL(request.url, `http://${request.headers.host || `${HOST}:${PORT}`}`);

  if (request.method === 'GET' && url.pathname === '/health') {
    json(response, 200, { ok: true, path: SOCKET_PATH });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/internal-chat/events') {
    const providedSecret = String(request.headers['x-internal-chat-secret'] || '').trim();
    if (providedSecret === '' || providedSecret !== NOTIFY_SECRET) {
      json(response, 401, { error: 'Unauthorized' });
      return;
    }

    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        request.destroy();
      }
    });
    request.on('end', () => {
      let payload;
      try {
        payload = body ? JSON.parse(body) : {};
      } catch {
        json(response, 400, { error: 'Invalid JSON payload' });
        return;
      }

      broadcastInternalChatEvent(payload);
      json(response, 202, { accepted: true });
    });
    request.on('error', () => {
      json(response, 500, { error: 'Failed to read request body' });
    });
    return;
  }

  json(response, 404, { error: 'Not found' });
});

const io = new Server(server, {
  path: SOCKET_PATH,
  cors: {
    origin: true,
    credentials: true,
  },
});

io.use((socket, next) => {
  try {
    const authToken =
      socket.handshake.auth?.token ||
      socket.handshake.query?.token ||
      String(socket.handshake.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const claims = verifyToken(String(authToken || ''));
    const userId = String(claims.sub || '').trim();
    const mainId = String(claims.main_userid || '').trim();

    if (userId === '' || mainId === '') {
      throw new Error('Invalid auth context');
    }

    socket.data.claims = claims;
    socket.join(`user:${userId}`);
    socket.join(`main:${mainId}`);
    console.info('[InternalChatRealtimeServer] Authenticated socket', {
      socketId: socket.id,
      userId,
      mainId,
      transport: socket.conn.transport.name,
    });
    next();
  } catch (error) {
    console.error('[InternalChatRealtimeServer] Socket authentication failed', {
      message: error instanceof Error ? error.message : String(error),
      address: socket.handshake.address,
      authKeys: Object.keys(socket.handshake.auth || {}),
    });
    next(error);
  }
});

io.on('connection', (socket) => {
  socket.on('disconnect', (reason) => {
    console.warn('[InternalChatRealtimeServer] Socket disconnected', {
      socketId: socket.id,
      userId: String(socket.data?.claims?.sub || ''),
      reason,
    });
  });
});

io.engine.on('connection_error', (error) => {
  console.error('[InternalChatRealtimeServer] Engine connection error', {
    code: error.code,
    message: error.message,
    context: error.context,
  });
});

const emitToUser = (userId, payload) => {
  const normalized = String(userId || '').trim();
  if (normalized === '') {
    return;
  }
  io.to(`user:${normalized}`).emit(INTERNAL_CHAT_SOCKET_EVENT, payload);
};

const broadcastInternalChatEvent = (payload) => {
  for (const { userId, event } of translateInternalChatNotification(payload)) {
    emitToUser(userId, event);
  }
};

server.listen(PORT, HOST, () => {
  console.log(`Internal chat realtime server listening on http://${HOST}:${PORT}`);
});
