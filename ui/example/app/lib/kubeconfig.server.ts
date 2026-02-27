import { readFileSync, existsSync } from "fs";
import { load } from "js-yaml";
import { join } from "path";

interface KubeConfig {
  apiServerUrl: string;
  clientCert: Buffer | undefined;
  clientKey: Buffer | undefined;
  caCert: Buffer | undefined;
  bearerToken: string | undefined;
}

let cachedConfig: KubeConfig | null = null;

// In-cluster ServiceAccount paths
const IN_CLUSTER_TOKEN_PATH = "/var/run/secrets/kubernetes.io/serviceaccount/token";
const IN_CLUSTER_CA_PATH = "/var/run/secrets/kubernetes.io/serviceaccount/ca.crt";
const IN_CLUSTER_NAMESPACE_PATH = "/var/run/secrets/kubernetes.io/serviceaccount/namespace";

/**
 * Reads API server configuration from environment variables, in-cluster config, or kubeconfig.
 * This is a server-only utility (the .server.ts suffix ensures it's never bundled for the client).
 *
 * Priority order:
 * 1. Environment variables (ACTIVITY_API_SERVER_URL, etc.)
 * 2. In-cluster ServiceAccount authentication (when running in Kubernetes)
 * 3. Kubeconfig file at .test-infra/kubeconfig (for local development)
 *
 * Environment variables:
 * - ACTIVITY_API_SERVER_URL: URL to the API server
 * - ACTIVITY_API_CA_FILE: Path to CA certificate file for TLS verification
 * - ACTIVITY_API_CERT_FILE: Path to client certificate for mTLS
 * - ACTIVITY_API_KEY_FILE: Path to client key for mTLS
 * - ACTIVITY_API_TOKEN_FILE: Path to bearer token file
 * - KUBERNETES_SERVICE_HOST/PORT: Auto-set when running in-cluster
 */
export function getKubeConfig(): KubeConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  // Check for environment variable configuration first
  const envApiServerUrl = process.env.ACTIVITY_API_SERVER_URL;
  if (envApiServerUrl) {
    console.log("✅ Using API server from environment:", envApiServerUrl);

    let caCert: Buffer | undefined;
    let clientCert: Buffer | undefined;
    let clientKey: Buffer | undefined;
    let bearerToken: string | undefined;

    const caFile = process.env.ACTIVITY_API_CA_FILE;
    if (caFile) {
      try {
        caCert = readFileSync(caFile);
        console.log("✅ Loaded CA certificate from:", caFile);
      } catch (e) {
        console.warn("⚠️  Could not read CA certificate:", e);
      }
    }

    // Load bearer token for ServiceAccount authentication
    const tokenFile = process.env.ACTIVITY_API_TOKEN_FILE;
    if (tokenFile) {
      try {
        bearerToken = readFileSync(tokenFile, "utf8").trim();
        console.log("✅ Loaded bearer token from:", tokenFile);
      } catch (e) {
        console.warn("⚠️  Could not read bearer token:", e);
      }
    }

    // Load client certificate for mTLS authentication (fallback if no token)
    if (!bearerToken) {
      const certFile = process.env.ACTIVITY_API_CERT_FILE;
      const keyFile = process.env.ACTIVITY_API_KEY_FILE;
      if (certFile && keyFile) {
        try {
          clientCert = readFileSync(certFile);
          clientKey = readFileSync(keyFile);
          console.log("✅ Loaded client certificate from:", certFile);
        } catch (e) {
          console.warn("⚠️  Could not read client certificate:", e);
        }
      }
    }

    cachedConfig = {
      apiServerUrl: envApiServerUrl,
      clientCert,
      clientKey,
      caCert,
      bearerToken,
    };
    return cachedConfig;
  }

  // Check for in-cluster configuration (ServiceAccount)
  const k8sHost = process.env.KUBERNETES_SERVICE_HOST;
  const k8sPort = process.env.KUBERNETES_SERVICE_PORT;
  if (k8sHost && k8sPort && existsSync(IN_CLUSTER_TOKEN_PATH)) {
    console.log("✅ Detected in-cluster environment, using ServiceAccount authentication");

    let caCert: Buffer | undefined;
    let bearerToken: string | undefined;

    try {
      caCert = readFileSync(IN_CLUSTER_CA_PATH);
      console.log("✅ Loaded in-cluster CA certificate");
    } catch (e) {
      console.warn("⚠️  Could not read in-cluster CA certificate:", e);
    }

    try {
      bearerToken = readFileSync(IN_CLUSTER_TOKEN_PATH, "utf8").trim();
      console.log("✅ Loaded ServiceAccount token");
    } catch (e) {
      console.warn("⚠️  Could not read ServiceAccount token:", e);
    }

    const apiServerUrl = `https://${k8sHost}:${k8sPort}`;
    console.log("✅ Using Kubernetes API server:", apiServerUrl);

    cachedConfig = {
      apiServerUrl,
      clientCert: undefined,
      clientKey: undefined,
      caCert,
      bearerToken,
    };
    return cachedConfig;
  }

  // Fallback to kubeconfig (local development)
  let apiServerUrl = "https://127.0.0.1:6443";
  let clientCert: Buffer | undefined;
  let clientKey: Buffer | undefined;
  let caCert: Buffer | undefined;
  let bearerToken: string | undefined;

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
          token?: string;
        };
      }>;
    };

    apiServerUrl = kubeconfig.clusters[0].cluster.server;

    // Check for token first
    const token = kubeconfig.users[0].user.token;
    if (token) {
      bearerToken = token;
      console.log("✅ Using token authentication from kubeconfig");
    } else {
      // Decode base64 certificates
      const certData = kubeconfig.users[0].user["client-certificate-data"];
      const keyData = kubeconfig.users[0].user["client-key-data"];

      if (certData) clientCert = Buffer.from(certData, "base64");
      if (keyData) clientKey = Buffer.from(keyData, "base64");
    }

    const caData = kubeconfig.clusters[0].cluster["certificate-authority-data"];
    if (caData) caCert = Buffer.from(caData, "base64");

    console.log("✅ Loaded kubeconfig from:", kubeconfigPath);
    console.log("✅ Using Kubernetes API server:", apiServerUrl);
  } catch (e) {
    console.warn("⚠️  Could not read kubeconfig, using default:", apiServerUrl);
  }

  cachedConfig = { apiServerUrl, clientCert, clientKey, caCert, bearerToken };
  return cachedConfig;
}

/**
 * Clears the cached kubeconfig (useful for testing or hot-reload scenarios).
 */
export function clearKubeConfigCache(): void {
  cachedConfig = null;
}
