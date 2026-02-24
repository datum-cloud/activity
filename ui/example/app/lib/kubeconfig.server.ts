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
 * Reads API server configuration from environment variables or kubeconfig.
 * This is a server-only utility (the .server.ts suffix ensures it's never bundled for the client).
 *
 * Environment variables (take precedence):
 * - ACTIVITY_API_SERVER_URL: URL to the activity-apiserver (e.g., https://activity-apiserver.activity-system.svc:443)
 * - ACTIVITY_API_CA_FILE: Path to CA certificate file for TLS verification
 * - ACTIVITY_API_SKIP_TLS_VERIFY: Set to "true" to skip TLS verification (not recommended for production)
 *
 * Fallback: Reads from kubeconfig at .test-infra/kubeconfig (for local development)
 */
export function getKubeConfig(): KubeConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  // Check for environment variable configuration first (production mode)
  const envApiServerUrl = process.env.ACTIVITY_API_SERVER_URL;
  if (envApiServerUrl) {
    console.log("✅ Using API server from environment:", envApiServerUrl);

    let caCert: Buffer | undefined;
    const caFile = process.env.ACTIVITY_API_CA_FILE;
    if (caFile) {
      try {
        caCert = readFileSync(caFile);
        console.log("✅ Loaded CA certificate from:", caFile);
      } catch (e) {
        console.warn("⚠️  Could not read CA certificate:", e);
      }
    }

    cachedConfig = {
      apiServerUrl: envApiServerUrl,
      clientCert: undefined,
      clientKey: undefined,
      caCert,
    };
    return cachedConfig;
  }

  // Fallback to kubeconfig (local development)
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
    console.warn("⚠️  Could not read kubeconfig, using default:", apiServerUrl);
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
