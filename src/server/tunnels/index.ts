import { startCloudflareTunnel } from "./cloudflare.js";
import { startLoopholeTunnel } from "./loophole.js";
import { startZrokTunnel } from "./zrok.js";
import { startExposeTunnel } from "./expose.js";
import { startPacketriotTunnel } from "./packetriot.js";
import { startSrvusTunnel } from "./srvus.js";
import type { Provider } from "../config.js";

export interface TunnelOptions {
  port: number;
  provider: Provider;
  subdomain?: string;
  sshkey?: string;
}

export async function startTunnel(options: TunnelOptions): Promise<string> {
  const { port, provider, subdomain, sshkey } = options;

  switch (provider) {
    case "loophole":
      return startLoopholeTunnel(port, subdomain);

    case "zrok":
      return startZrokTunnel(port, subdomain);

    case "expose":
      return startExposeTunnel(port, subdomain, sshkey);

    case "packetriot":
      return startPacketriotTunnel(port);

    case "srvus":
      return startSrvusTunnel(port, subdomain, sshkey);

    case "cloudflare":
    default:
      return startCloudflareTunnel(port);
  }
}
