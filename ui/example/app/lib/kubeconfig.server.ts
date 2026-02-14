import { readFileSync, existsSync } from "fs";
import { load } from "js-yaml";
import { join } from "path";

interface KubeConfig {
  apiServerUrl: string;
  clientCert: Buffer | undefined;
  clientKey: Buffer | undefined;
  caCert: Buffer | undefined;
  token: string | undefined;
}

let cachedConfig: KubeConfig | null = null;

// In-cluster paths for service account credentials
const IN_CLUSTER_TOKEN_PATH = "/var/run/secrets/kubernetes.io/serviceaccount/token";
const IN_CLUSTER_CA_PATH = "/var/run/secrets/kubernetes.io/serviceaccount/ca.crt";

/**
 * Reads kubeconfig from .test-infra/kubeconfig or uses in-cluster service account.
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
  let token: string | undefined;

  // First, check if we're running in-cluster (service account mounted)
  if (existsSync(IN_CLUSTER_TOKEN_PATH)) {
    try {
      token = readFileSync(IN_CLUSTER_TOKEN_PATH, "utf8").trim();
      if (existsSync(IN_CLUSTER_CA_PATH)) {
        caCert = readFileSync(IN_CLUSTER_CA_PATH);
      }
      apiServerUrl = `https://${process.env.KUBERNETES_SERVICE_HOST || "kubernetes.default.svc"}:${process.env.KUBERNETES_SERVICE_PORT || "443"}`;
      console.log("✅ Using in-cluster Kubernetes config");
      console.log("✅ Using Kubernetes API server:", apiServerUrl);
    } catch (e) {
      console.warn("⚠️  Could not read in-cluster credentials:", e);
    }
  } else {
    // Fall back to kubeconfig file for local development
    try {
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
  }

  cachedConfig = { apiServerUrl, clientCert, clientKey, caCert, token };
  return cachedConfig;
}

/**
 * Clears the cached kubeconfig (useful for testing or hot-reload scenarios).
 */
export function clearKubeConfigCache(): void {
  cachedConfig = null;
}
