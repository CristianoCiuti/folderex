import { startCloudflareTunnel } from "./cloudflare.js";
import { startLoopholeTunnel } from "./loophole.js";
import { startZrokTunnel } from "./zrok.js";
import type { Provider } from "./config.js";

export interface TunnelOptions {
  port: number;
  provider: Provider;
  subdomain?: string;
}

export async function startTunnel(options: TunnelOptions): Promise<string> {
  const { port, provider, subdomain } = options;

  switch (provider) {
    case "loophole":
      return startLoopholeTunnel(port, subdomain);

    case "zrok":
      return startZrokTunnel(port, subdomain);

    case "cloudflare":
    default:
      return startCloudflareTunnel(port);
  }
}
