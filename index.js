const http = require('http');

// Get original subscription URL from environment variable
const SOURCE_SUB = process.env.SOURCE_SUB;
const PORT = process.env.PORT || 3000;

const server = http.createServer(async (req, res) => {
  // Handle health check or favicon requests
  if (req.url === '/favicon.ico') {
    res.writeHead(404);
    res.end();
    return;
  }

  // If SOURCE_SUB is not configured, show error
  if (!SOURCE_SUB) {
    res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
      <html>
        <head>
          <title>Ошибка Конфигурации</title>
          <style>
            body { font-family: sans-serif; background: #121214; color: #e1e1e6; padding: 40px; text-align: center; }
            .card { background: #202024; padding: 30px; border-radius: 8px; display: inline-block; max-width: 500px; text-align: left; border: 1px solid #323238; }
            h1 { color: #f75a68; margin-top: 0; }
            code { background: #121214; padding: 4px 8px; border-radius: 4px; color: #00e676; font-family: monospace; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>Ошибка настройки</h1>
            <p>Переменная окружения <code>SOURCE_SUB</code> не задана.</p>
            <p>Пожалуйста, перейдите в панель управления <b>Render.com</b> -> <b>Environment</b> и добавьте переменную:</p>
            <p><code>SOURCE_SUB</code> = <code>ссылка_на_оригинальную_подписку</code></p>
          </div>
        </body>
      </html>
    `);
    return;
  }

  try {
    console.log(`[${new Date().toISOString()}] Запрос подписки от ${req.socket.remoteAddress}`);

    // Fetch the original subscription
    const response = await fetch(SOURCE_SUB, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`Не удалось скачать оригинальную подписку: HTTP ${response.status}`);
    }

    const rawBody = await response.text();
    
    // Parse and clean subscription content
    const cleanBase64 = cleanSubscriptionContent(rawBody);

    // Set headers to rename subscription to "oracle VPN" and prevent cache
    res.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'profile-title': 'oracle VPN',
      'Content-Disposition': 'attachment; filename="oracle VPN"; filename*=UTF-8\'\'oracle%20VPN'
    });

    res.end(cleanBase64);
    console.log(`[${new Date().toISOString()}] Подписка успешно отдана под именем "oracle VPN"`);

  } catch (error) {
    console.error(`[${new Date().toISOString()}] Ошибка:`, error.message);
    res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(`Ошибка при получении оригинальной подписки: ${error.message}`);
  }
});

/**
 * Parses the subscription body, extracts only protocol links,
 * strips any text comments/metadata, and returns new clean base64.
 */
function cleanSubscriptionContent(rawBody) {
  let content = rawBody.trim();
  
  // Try decoding from base64 first
  let decoded = '';
  try {
    decoded = Buffer.from(content, 'base64').toString('utf8');
  } catch (e) {
    decoded = '';
  }

  // Check if the decoded content has typical v2ray links.
  const hasLinks = (str) => /^(vmess|vless|ss|trojan|hysteria|hy2|tuic|socks|http):\/\//m.test(str);
  
  let linesStr = '';
  if (decoded && hasLinks(decoded)) {
    linesStr = decoded;
  } else if (hasLinks(content)) {
    linesStr = content;
  } else {
    // If we can't find clear links, just use whatever we decoded, or raw content
    linesStr = decoded || content;
  }

  // Split by lines and clean
  const cleanLines = linesStr
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => {
      if (!line) return false;
      // Only keep actual protocol links
      return /^(vmess|vless|ss|trojan|hysteria|hy2|tuic|socks|http):\/\//i.test(line);
    });

  // Encode back to Base64
  return Buffer.from(cleanLines.join('\n')).toString('base64');
}

server.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});
