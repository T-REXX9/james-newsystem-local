import { createHmac } from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);
const createFastcgiClient = require('fastcgi-client');
const projectRoot = path.resolve(__dirname, '..');
const distDir = path.resolve(projectRoot, 'dist');
const apiRoot = path.resolve(projectRoot, '..', 'api');
const apiPublicDir = path.join(apiRoot, 'public');
const apiEntryScript = path.join(apiPublicDir, 'index.php');

const PUBLIC_HOST = process.env.PROD_HOST || '0.0.0.0';
const PUBLIC_PORT = Number(process.env.PROD_PORT || 8080);
const PHP_FPM_HOST = process.env.PHP_FPM_HOST || '127.0.0.1';
const PHP_FPM_PORT = Number(process.env.PHP_FPM_PORT || 9070);
const APP_BASE_PATH = '/james-newsystem/';
const SOCKET_PATH = '/socket.io';
const TOKEN_SECRET = process.env.AUTH_SECRET || process.env.APP_KEY || 'change-this-secret';
const NOTIFY_SECRET = process.env.INTERNAL_CHAT_SOCKET_SECRET || TOKEN_SECRET;

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
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

const sendJson = (response, statusCode, payload) => {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(payload));
};

const ensureDistExists = () => {
  if (!fs.existsSync(path.join(distDir, 'index.html'))) {
    throw new Error(`Built frontend not found at ${distDir}. Run npm run build first.`);
  }
};

const ensureApiEntryExists = () => {
  if (!fs.existsSync(apiEntryScript)) {
    throw new Error(`PHP API front controller not found at ${apiEntryScript}.`);
  }
};

const safeFilePath = (requestPath) => {
  const relative = requestPath.slice(APP_BASE_PATH.length);
  const normalized = path.normalize(relative).replace(/^(\.\.(\/|\\|$))+/, '');
  return path.join(distDir, normalized);
};

const serveFile = (response, filePath) => {
  const extension = path.extname(filePath).toLowerCase();
  response.statusCode = 200;
  response.setHeader('Content-Type', MIME_TYPES[extension] || 'application/octet-stream');
  fs.createReadStream(filePath).pipe(response);
};

const serveAppAsset = (requestPath, response) => {
  const requestedPath = safeFilePath(requestPath);
  if (fs.existsSync(requestedPath) && fs.statSync(requestedPath).isFile()) {
    serveFile(response, requestedPath);
    return true;
  }

  if (!path.extname(requestPath)) {
    serveFile(response, path.join(distDir, 'index.html'));
    return true;
  }

  return false;
};

const fastcgiClient = createFastcgiClient({
  host: PHP_FPM_HOST,
  port: PHP_FPM_PORT,
  skipCheckServer: false,
});

let fastcgiReadyError = null;
const fastcgiReady = new Promise((resolve, reject) => {
  fastcgiClient.once('ready', resolve);
  fastcgiClient.once('error', (error) => {
    fastcgiReadyError = error;
    reject(error);
  });
});
fastcgiReady.catch(() => {});

const normalizeRemoteAddress = (value) => String(value || '').replace(/^::ffff:/, '') || '127.0.0.1';

const buildFastCgiParams = (request, url) => {
  const hostHeader = String(request.headers.host || `127.0.0.1:${PUBLIC_PORT}`);
  const serverName = hostHeader.split(':')[0] || '127.0.0.1';
  const remoteAddress = normalizeRemoteAddress(request.socket.remoteAddress);
  const remotePort = Number(request.socket.remotePort || 0);
  const bodyLength = String(request.headers['content-length'] || '');

  const params = {
    GATEWAY_INTERFACE: 'CGI/1.1',
    SERVER_SOFTWARE: 'node-fastcgi',
    SERVER_PROTOCOL: `HTTP/${request.httpVersion || '1.1'}`,
    REQUEST_METHOD: request.method || 'GET',
    REQUEST_SCHEME: 'http',
    HTTPS: 'off',
    REMOTE_ADDR: remoteAddress,
    REMOTE_PORT: remotePort,
    SERVER_ADDR: normalizeRemoteAddress(request.socket.localAddress),
    SERVER_PORT: PUBLIC_PORT,
    SERVER_NAME: serverName,
    DOCUMENT_ROOT: apiPublicDir,
    SCRIPT_FILENAME: apiEntryScript,
    SCRIPT_NAME: '/index.php',
    DOCUMENT_URI: '/index.php',
    REQUEST_URI: `${url.pathname}${url.search}`,
    QUERY_STRING: url.search.length > 1 ? url.search.slice(1) : '',
    CONTENT_TYPE: String(request.headers['content-type'] || ''),
    CONTENT_LENGTH: bodyLength,
    REDIRECT_STATUS: '200',
  };

  Object.entries(request.headers).forEach(([key, value]) => {
    if (value === undefined) return;
    const normalizedKey = key.toUpperCase().replace(/-/g, '_');
    if (normalizedKey === 'CONTENT_TYPE' || normalizedKey === 'CONTENT_LENGTH') return;
    params[`HTTP_${normalizedKey}`] = Array.isArray(value) ? value.join(', ') : String(value);
  });

  return params;
};

const parseAndForwardFastCgiResponse = (stdout, response) => new Promise((resolve, reject) => {
  let headerBuffer = Buffer.alloc(0);
  let headersSent = false;
  let statusCode = 200;

  const finalizeHeaders = (rawHeaderText) => {
    rawHeaderText
      .split(/\r\n/)
      .filter(Boolean)
      .forEach((line) => {
        const separatorIndex = line.indexOf(':');
        if (separatorIndex === -1) {
          return;
        }

        const headerName = line.slice(0, separatorIndex).trim();
        const headerValue = line.slice(separatorIndex + 1).trim();
        if (headerName.toLowerCase() === 'status') {
          const parsed = Number(headerValue.split(/\s+/)[0] || 200);
          if (Number.isFinite(parsed) && parsed > 0) {
            statusCode = parsed;
          }
          return;
        }

        response.setHeader(headerName, headerValue);
      });

    response.statusCode = statusCode;
    headersSent = true;
  };

  stdout.on('data', (chunk) => {
    const bufferChunk = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    if (!headersSent) {
      headerBuffer = Buffer.concat([headerBuffer, bufferChunk]);
      const delimiterIndex = headerBuffer.indexOf('\r\n\r\n');
      if (delimiterIndex === -1) {
        return;
      }

      const headerText = headerBuffer.subarray(0, delimiterIndex).toString('utf8');
      const bodyStart = headerBuffer.subarray(delimiterIndex + 4);
      finalizeHeaders(headerText);
      if (bodyStart.length > 0) {
        response.write(bodyStart);
      }
      headerBuffer = Buffer.alloc(0);
      return;
    }

    response.write(bufferChunk);
  });

  stdout.on('end', () => {
    if (!headersSent) {
      response.statusCode = 502;
    }
    response.end();
    resolve();
  });

  stdout.on('error', (error) => {
    if (!response.headersSent) {
      response.statusCode = 502;
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify({ error: error.message || 'FastCGI stdout failed' }));
    } else {
      response.end();
    }
    reject(error);
  });
});

const proxyApiRequest = async (request, response) => {
  if (fastcgiReadyError) {
    throw fastcgiReadyError;
  }
  await fastcgiReady;

  const incomingUrl = new URL(request.url, `http://${request.headers.host || `${PUBLIC_HOST}:${PUBLIC_PORT}`}`);
  const params = buildFastCgiParams(request, incomingUrl);

  await new Promise((resolve, reject) => {
    fastcgiClient.request(params, (error, fcgiRequest) => {
      if (error) {
        reject(error);
        return;
      }

      let stderr = '';
      fcgiRequest.stderr.on('data', (chunk) => {
        stderr += chunk.toString('utf8');
      });
      fcgiRequest.stderr.on('end', () => {
        if (stderr.trim() !== '') {
          console.error(stderr.trim());
        }
      });
      fcgiRequest.stderr.on('error', (streamError) => {
        console.error(streamError);
      });

      parseAndForwardFastCgiResponse(fcgiRequest.stdout, response)
        .then(() => {
          const exitStatus = fcgiRequest.getExitStatus();
          if (exitStatus instanceof Error) {
            reject(exitStatus);
            return;
          }
          if (exitStatus !== 0) {
            reject(new Error(`PHP-FPM exited with status ${exitStatus}`));
            return;
          }
          resolve();
        })
        .catch(reject);

      request.on('aborted', () => {
        fcgiRequest.abort();
      });
      request.on('error', (streamError) => {
        fcgiRequest.abort();
        reject(streamError);
      });

      if (request.method === 'GET' || request.method === 'HEAD') {
        fcgiRequest.stdin.end();
        return;
      }

      request.pipe(fcgiRequest.stdin);
    });
  });
};

const server = http.createServer(async (request, response) => {
  try {
    if (!request.url) {
      sendJson(response, 404, { error: 'Not found' });
      return;
    }

    const url = new URL(request.url, `http://${request.headers.host || `${PUBLIC_HOST}:${PUBLIC_PORT}`}`);

    if (request.method === 'GET' && url.pathname === '/health') {
      sendJson(response, 200, {
        ok: true,
        frontend_base: APP_BASE_PATH,
        php_fpm_target: `${PHP_FPM_HOST}:${PHP_FPM_PORT}`,
        socket_path: SOCKET_PATH,
      });
      return;
    }

    if (request.method === 'POST' && url.pathname === '/internal-chat/events') {
      const providedSecret = String(request.headers['x-internal-chat-secret'] || '').trim();
      if (providedSecret === '' || providedSecret !== NOTIFY_SECRET) {
        sendJson(response, 401, { error: 'Unauthorized' });
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
          sendJson(response, 400, { error: 'Invalid JSON payload' });
          return;
        }

        broadcastInternalChatEvent(payload);
        sendJson(response, 202, { accepted: true });
      });
      request.on('error', () => {
        sendJson(response, 500, { error: 'Failed to read request body' });
      });
      return;
    }

    if (url.pathname === '/') {
      response.statusCode = 302;
      response.setHeader('Location', APP_BASE_PATH);
      response.end();
      return;
    }

    if (url.pathname.startsWith('/api/')) {
      await proxyApiRequest(request, response);
      return;
    }

    if (url.pathname === APP_BASE_PATH.slice(0, -1) || url.pathname.startsWith(APP_BASE_PATH)) {
      if (serveAppAsset(url.pathname, response)) {
        return;
      }
    }

    sendJson(response, 404, { error: 'Not found' });
  } catch (error) {
    response.statusCode = 502;
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({
      error: error instanceof Error ? error.message : 'Upstream request failed',
    }));
  }
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
    console.info('[InternalChatProdServer] Authenticated socket', {
      socketId: socket.id,
      userId,
      mainId,
      transport: socket.conn.transport.name,
    });
    next();
  } catch (error) {
    console.error('[InternalChatProdServer] Socket authentication failed', {
      message: error instanceof Error ? error.message : String(error),
      address: socket.handshake.address,
      authKeys: Object.keys(socket.handshake.auth || {}),
    });
    next(error);
  }
});

io.on('connection', (socket) => {
  socket.on('disconnect', (reason) => {
    console.warn('[InternalChatProdServer] Socket disconnected', {
      socketId: socket.id,
      userId: String(socket.data?.claims?.sub || ''),
      reason,
    });
  });
});

io.engine.on('connection_error', (error) => {
  console.error('[InternalChatProdServer] Engine connection error', {
    code: error.code,
    message: error.message,
    context: error.context,
  });
});

const emitToUser = (userId, payload) => {
  const normalized = String(userId || '').trim();
  if (normalized === '') return;
  io.to(`user:${normalized}`).emit('chat:event', payload);
};

const participantsFromConversationKey = (conversationKey) => {
  const match = String(conversationKey || '').trim().match(/^dm:(\d+):(\d+)$/);
  if (!match) {
    return [];
  }

  return [match[1], match[2]];
};

const emitToConversationParticipants = (conversationKey, payload) => {
  const participants = participantsFromConversationKey(conversationKey);
  if (participants.length === 0) {
    return;
  }

  participants.forEach((participantId) => emitToUser(participantId, payload));
};

const broadcastInternalChatEvent = (payload) => {
  const type = String(payload?.type || '').trim();

  if (type === 'messages.created') {
    const items = Array.isArray(payload?.items) ? payload.items : [];
    items.forEach((item) => {
      const message = {
        id: String(item?.id || ''),
        conversation_key: String(item?.conversation_key || ''),
        sender_id: String(item?.sender_id || ''),
        recipient_id: String(item?.recipient_id || ''),
        message: String(item?.message || ''),
        created_at: String(item?.created_at || ''),
        is_from_current_user: false,
        sender_name: String(item?.sender_name || ''),
        recipient_name: String(item?.recipient_name || ''),
        sender_avatar_url: String(item?.sender_avatar_url || ''),
        recipient_avatar_url: String(item?.recipient_avatar_url || ''),
        delivery_status: String(item?.delivery_status || 'sent'),
        is_read_by_recipient: Boolean(item?.is_read_by_recipient),
        reactions: Array.isArray(item?.reactions) ? item.reactions : [],
        current_user_reaction: item?.current_user_reaction ?? null,
        reply_to_message_id: item?.reply_to_message_id ?? null,
        reply_preview: item?.reply_preview ?? null,
      };

      emitToUser(message.sender_id, { type: 'message.created', message });
      if (message.recipient_id !== message.sender_id) {
        emitToUser(message.recipient_id, { type: 'message.created', message });
      }
    });
    return;
  }

  if (type === 'conversation.read') {
    emitToConversationParticipants(String(payload?.conversation_key || ''), {
      type: 'conversation.read',
      user_id: String(payload?.user_id || ''),
      read_by_user_id: String(payload?.read_by_user_id || payload?.user_id || ''),
      conversation_key: String(payload?.conversation_key || ''),
      updated_count: Number(payload?.updated_count || 0),
    });
    return;
  }

  if (type === 'reaction.updated') {
    emitToConversationParticipants(String(payload?.conversation_key || ''), {
      type: 'reaction.updated',
      conversation_key: String(payload?.conversation_key || ''),
      message_id: String(payload?.message_id || ''),
      reactions: Array.isArray(payload?.reactions) ? payload.reactions : [],
      current_user_reaction: payload?.current_user_reaction ?? null,
      actor_user_id: String(payload?.actor_user_id || ''),
    });
    return;
  }

  if (type === 'typing.updated') {
    emitToConversationParticipants(String(payload?.conversation_key || ''), {
      type: 'typing.updated',
      conversation_key: String(payload?.conversation_key || ''),
      user_id: String(payload?.user_id || ''),
      is_typing: Boolean(payload?.is_typing),
      typing_user_ids: Array.isArray(payload?.typing_user_ids) ? payload.typing_user_ids.map((id) => String(id || '')) : [],
    });
  }
};

ensureDistExists();
ensureApiEntryExists();
server.listen(PUBLIC_PORT, PUBLIC_HOST, () => {
  console.log(`Production server listening on http://${PUBLIC_HOST}:${PUBLIC_PORT}${APP_BASE_PATH}`);
});
