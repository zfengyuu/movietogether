import { DurableObject } from 'cloudflare:workers';

// One named Container for all rooms because current Socket.IO rooms are in memory.
// Durable Object routing preserves WebSocket upgrades to the same process.
const CONTAINER_PORT = 3001;
const IDLE_MS = 60 * 60 * 1000;

export class HoiRoomContainer extends DurableObject {
  starting;

  constructor(ctx, env) {
    super(ctx, env);
    if (ctx.container.running) {
      void ctx.blockConcurrencyWhile(() => ctx.container.setInactivityTimeout(IDLE_MS));
    }
  }

  async fetch(request) {
    this.starting ??= this.ensureReady().finally(() => { this.starting = undefined; });
    await this.starting;

    const target = new URL(request.url);
    target.protocol = 'http:';
    target.host = 'container';
    const forwarded = new Request(target, request);
    forwarded.headers.delete('host');
    return this.ctx.container.getTcpPort(CONTAINER_PORT).fetch(forwarded);
  }

  async ensureReady() {
    const container = this.ctx.container;
    if (!container.running) {
      if (!this.env.DATABASE_URL) throw new Error('DATABASE_URL Worker secret not configured');
      container.start({
        image: container.images.base,
        instance: 'basic',
        enableInternet: true,
        env: {
          NODE_ENV: 'production',
          PORT: String(CONTAINER_PORT),
          SERVE_STATIC: 'true',
          DEMO_WALLET_ENABLED: 'false',
          PAYMENTS_MODE: this.env.PAYMENTS_MODE === 'sandbox' ? 'sandbox' : 'disabled',
          UPLOAD_ROOT: '/tmp/hoiroom',
          DATABASE_URL: this.env.DATABASE_URL,
          // The 3 VIMO_* values only generate a bank QR; they never verify a payment.
          VIMO_BANK_ID: this.env.VIMO_BANK_ID || '',
          VIMO_BANK_ACCOUNT: this.env.VIMO_BANK_ACCOUNT || '',
          VIMO_BANK_NAME: this.env.VIMO_BANK_NAME || '',
          // Signed SePay webhook settings: sandbox only until a live rollout is reviewed.
          VIETQR_BANK_ACCOUNT: this.env.VIETQR_BANK_ACCOUNT || '',
          SEPAY_WEBHOOK_SECRET: this.env.SEPAY_WEBHOOK_SECRET || ''
        }
      });
    }
    await container.setInactivityTimeout(IDLE_MS);
    const port = container.getTcpPort(CONTAINER_PORT);
    let lastError;
    for (let attempt = 0; attempt < 100; attempt++) {
      try {
        const response = await port.fetch('http://container/api/health', {
          signal: AbortSignal.timeout(1500)
        });
        await response.body?.cancel();
        if (!response.ok) throw new Error('App not ready, health HTTP ' + response.status);
        return;
      } catch (error) {
        lastError = error;
        await scheduler.wait(300);
      }
    }
    throw new Error('HoiRoom container failed health check', { cause: lastError });
  }
}

export default {
  fetch(request, env) {
    if (!env.DATABASE_URL) return new Response('DATABASE_URL is not set in Worker secrets', { status: 503 });
    return env.HOIROOM_CONTAINER.getByName('hoiroom-single-instance').fetch(request);
  }
};
