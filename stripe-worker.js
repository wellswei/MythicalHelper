// Cloudflare Worker for Stripe API calls
// 部署到 Cloudflare Workers 来解决 IPv6-only 服务器无法访问 Stripe API 的问题

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // 只允许 POST 请求
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }
    
    // 验证请求来源
    const origin = request.headers.get('Origin');
    if (origin !== 'https://mythicalhelper.org') {
      return new Response('Unauthorized', { status: 401 });
    }
    
    try {
      const body = await request.json();
      const { action, data } = body;
      
      if (action === 'create_checkout_session') {
        return await createCheckoutSession(data, env);
      } else if (action === 'verify_session') {
        return await verifySession(data, env);
      } else {
        return new Response('Invalid action', { status: 400 });
      }
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};

async function createCheckoutSession(data, env) {
  const { type, user_id, new_valid_until, amount, frontend_url } = data;
  
  const stripe = require('stripe')(env.STRIPE_SECRET_KEY);
  
  let line_items;
  if (type === 'renewal') {
    line_items = [{
      price_data: {
        currency: 'usd',
        product_data: {
          name: 'MythicalHelper Guild Membership Renewal',
          description: 'Extend your membership for one year',
        },
        unit_amount: 999, // $9.99 in cents
      },
      quantity: 1,
    }];
  } else if (type === 'donation') {
    line_items = [{
      price_data: {
        currency: 'usd',
        product_data: {
          name: 'MythicalHelper Guild Donation',
          description: 'Support the Guild with your generous gift',
        },
        unit_amount: amount,
      },
      quantity: 1,
    }];
  }
  
  const checkout_session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: line_items,
    mode: 'payment',
    success_url: `${frontend_url}/portal?${type}=success`,
    cancel_url: `${frontend_url}/portal?${type}=cancelled`,
    metadata: {
      user_id: user_id,
      type: type,
      new_valid_until: new_valid_until,
      amount: amount ? amount.toString() : '999'
    }
  });
  
  return new Response(JSON.stringify({
    checkout_url: checkout_session.url,
    session_id: checkout_session.id
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

async function verifySession(data, env) {
  const { session_id } = data;
  
  const stripe = require('stripe')(env.STRIPE_SECRET_KEY);
  const session = await stripe.checkout.sessions.retrieve(session_id);
  
  return new Response(JSON.stringify({
    status: session.payment_status === 'paid' ? 'complete' : 'pending'
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
