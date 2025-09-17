// Cloudflare Worker for Zoho API Proxy
// 将 /oauth/* 转发到 https://accounts.zoho.com/oauth/*
// 将 /mail/*  转发到 https://mail.zoho.com/api/*
// 如果你的 Zoho 在 EU/IN，把 .com 改成 .eu / .in

const ACCOUNTS_ORIGIN = 'https://accounts.zoho.com';
const MAIL_ORIGIN     = 'https://mail.zoho.com';

const ALLOWED_PREFIXES = ['/oauth/', '/mail/'];

// 可选：在 Workers → Settings → Variables and Secrets 添加 PROXY_KEY
// 并把开关设为 true，后端请求时带上请求头 x-proxy-key
const ENABLE_SHARED_KEY = false;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 只放行这两个前缀
    if (!ALLOWED_PREFIXES.some(p => url.pathname.startsWith(p))) {
      return new Response('Not found', { status: 404 });
    }

    // 简单的共享密钥校验（可选关闭）
    if (ENABLE_SHARED_KEY) {
      const k = request.headers.get('x-proxy-key');
      if (!k || k !== env.PROXY_KEY) {
        return new Response('Forbidden', { status: 403 });
      }
    }

    // 处理 CORS 预检
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Authorization,Content-Type,x-proxy-key',
          'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
          'Access-Control-Max-Age': '600',
        },
      });
    }

    // 目标 URL 映射
    let target;
    if (url.pathname.startsWith('/oauth/')) {
      // /oauth/v2/token -> https://accounts.zoho.com/oauth/v2/token
      target = new URL(url.pathname + url.search, ACCOUNTS_ORIGIN);
      console.log('OAuth request:', url.pathname, '->', target.toString());
    } else if (url.pathname.startsWith('/mail/')) {
      // /mail/accounts -> https://mail.zoho.com/api/accounts
      // /mail/folders  -> https://mail.zoho.com/api/folders
      // 仅替换前缀，避免 /mail/api/... 变成 /api/api/...
      const mailPath = url.pathname.replace(/^\/mail\//, '/api/');
      target = new URL(mailPath + url.search, MAIL_ORIGIN);
      console.log('Mail API request:', url.pathname, '->', target.toString());
    } else {
      console.log('Unknown path:', url.pathname);
      return new Response('Not found', { status: 404 });
    }

    // 复制必要请求头，移除可能冲突的
    const reqHeaders = new Headers(request.headers);
    reqHeaders.delete('host');
    reqHeaders.delete('cf-connecting-ip');
    reqHeaders.delete('x-forwarded-for');
    reqHeaders.delete('x-real-ip');

    const init = {
      method: request.method,
      headers: reqHeaders,
      body: (request.method === 'GET' || request.method === 'HEAD') ? undefined : request.body,
      redirect: 'follow',
      cache: 'no-store',            // 不缓存请求
      cf: { cacheEverything: false }, // 移除 cacheTtl 配置
    };

    try {
      console.log('Fetching:', target.toString());
      const resp = await fetch(target.toString(), init);
      console.log('Response status:', resp.status);

      // 复制响应头并追加 CORS/缓存头
      const outHeaders = new Headers(resp.headers);
      outHeaders.set('Access-Control-Allow-Origin', '*');
      outHeaders.set('Access-Control-Allow-Headers', 'Authorization,Content-Type,x-proxy-key');
      outHeaders.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
      outHeaders.set('Cache-Control', 'no-store');

      // 流式转发响应体
      return new Response(resp.body, {
        status: resp.status,
        statusText: resp.statusText,
        headers: outHeaders,
      });
    } catch (error) {
      console.error('Fetch error:', error);
      return new Response(JSON.stringify({
        error: 'Proxy fetch failed',
        message: error.message,
        target: target.toString()
      }), {
        status: 502,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  }
}
