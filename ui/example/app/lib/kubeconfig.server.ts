import { readFileSync } from "fs";
import { load } from "js-yaml";
import { join } from "path";

interface KubeConfig {
  apiServerUrl: string;
  clientCert: Buffer | undefined;
  clientKey: Buffer | undefined;
  caCert: Buffer | undefined;
}

let cachedConfig: KubeConfig | null = null;

/**
 * Reads kubeconfig from .test-infra/kubeconfig and extracts API server URL and certificates.
 * This is a server-only utility (the .server.ts suffix ensures it's never bundled for the client).
 */
export function getKubeConfig(): KubeConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  let apiServerUrl = "https://127.0.0.1:6443";
  let clientCert: Buffer | undefined;
  let clientKey: Buffer | undefined;
  let caCert: Buffer | undefined;

  try {
    // Look for kubeconfig in the project root's .test-infra directory
    const kubeconfigPath = join(process.cwd(), "../../.test-infra/kubeconfig");
    const kubeconfig = load(readFileSync(kubeconfigPath, "utf8")) as {
      clusters: Array<{
        cluster: {
          server: string;
          "certificate-authority-data"?: string;
        };
      }>;
      users: Array<{
        user: {
          "client-certificate-data"?: string;
          "client-key-data"?: string;
        };
      }>;
    };

    apiServerUrl = kubeconfig.clusters[0].cluster.server;

    // Decode base64 certificates
    const certData = kubeconfig.users[0].user["client-certificate-data"];
    const keyData = kubeconfig.users[0].user["client-key-data"];
    const caData = kubeconfig.clusters[0].cluster["certificate-authority-data"];

    if (certData) clientCert = Buffer.from(certData, "base64");
    if (keyData) clientKey = Buffer.from(keyData, "base64");
    if (caData) caCert = Buffer.from(caData, "base64");

    console.log("✅ Loaded kubeconfig from:", kubeconfigPath);
    console.log("✅ Using Kubernetes API server:", apiServerUrl);
  } catch (e) {
    console.warn("⚠️  Could not read kubeconfig:", e);
  }

  cachedConfig = { apiServerUrl, clientCert, clientKey, caCert };
  return cachedConfig;
}

/**
 * Clears the cached kubeconfig (useful for testing or hot-reload scenarios).
 */
export function clearKubeConfigCache(): void {
  cachedConfig = null;
}
