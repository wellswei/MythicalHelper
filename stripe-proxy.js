// Cloudflare Worker for Stripe API Proxy
// 部署到 Cloudflare Workers 来解决 IPv6-only 服务器无法访问 Stripe API 的问题

export default {
  async fetch(req, env) {
    const url = new URL(req.url);

    // 只允许代理 Stripe 的 /v1/* 路径
    if (!url.pathname.startsWith("/v1/")) {
      return new Response("Not found", { status: 404 });
    }

    // 处理 CORS 预检
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(req, env) });
    }

    // 简单入站鉴权（推荐在服务端调用时携带）
    const inbound = req.headers.get("X-Worker-Auth");
    if (env.INBOUND_TOKEN && inbound !== env.INBOUND_TOKEN) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders(req, env) });
    }

    // 目标 Stripe API
    const target = "https://api.stripe.com" + url.pathname + url.search;

    // 复制请求头并用 STRIPE_SECRET 覆盖授权头
    const headers = new Headers(req.headers);
    headers.set("Authorization", `Bearer ${env.STRIPE_SECRET}`);
    headers.delete("host"); // 由 fetch 重新设置

    // 仅在有主体时传递 body
    const hasBody = !["GET", "HEAD"].includes(req.method);
    const body = hasBody ? await req.arrayBuffer() : undefined;

    // 通过 Workers 的 Fetch API 发起请求到 Stripe
    const resp = await fetch(target, {
      method: req.method,
      headers,
      body,
    }); // Workers 原生支持 fetch 出站请求

    // 回传响应并附加 CORS
    const resHeaders = new Headers(resp.headers);
    for (const [k, v] of Object.entries(corsHeaders(req, env))) resHeaders.set(k, v);

    return new Response(resp.body, { status: resp.status, headers: resHeaders });
  }
};

function corsHeaders(req, env) {
  const origin = req.headers.get("Origin");
  // 允许来自你站点的浏览器请求；服务端直连不会用到 CORS
  const allow = env.ALLOWED_ORIGIN && origin === env.ALLOWED_ORIGIN ? origin : "";
  return {
    ...(allow ? { "Access-Control-Allow-Origin": allow, "Vary": "Origin" } : {}),
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Worker-Auth",
  };
}
