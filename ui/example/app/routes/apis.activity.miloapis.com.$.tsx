import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import https from "https";
import http from "http";

/**
 * Catch-all resource route for /apis/activity.miloapis.com/* requests.
 * Proxies to the Activity API server.
 */

const ACTIVITY_API_HOST = process.env.ACTIVITY_API_HOST || "activity-apiserver.activity-system.svc";
const ACTIVITY_API_PORT = process.env.ACTIVITY_API_PORT || "443";

async function proxyRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname + url.search;

  // Build the target URL
  const targetUrl = new URL(path, `https://${ACTIVITY_API_HOST}:${ACTIVITY_API_PORT}`);
  const isHttps = targetUrl.protocol === "https:";

  // Get request body if present
  let body: string | undefined;
  if (request.method !== "GET" && request.method !== "HEAD") {
    body = await request.text();
  }

  // Build headers
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    const lowerKey = key.toLowerCase();
    if (lowerKey !== "host" && lowerKey !== "connection" && lowerKey !== "authorization") {
      headers[key] = value;
    }
  });

  // Add impersonation headers for the Activity API server
  headers["X-Remote-User"] = "activity-ui";
  headers["X-Remote-Group"] = "system:serviceaccounts:activity-system";

  return new Promise((resolve) => {
    const options: https.RequestOptions = {
      hostname: targetUrl.hostname,
      port: targetUrl.port || (isHttps ? 443 : 80),
      path: targetUrl.pathname + targetUrl.search,
      method: request.method,
      headers,
      // TLS options
      ...(isHttps
        ? {
            rejectUnauthorized: false, // TODO: Enable proper cert verification
          }
        : {}),
    };

    const transport = isHttps ? https : http;
    const proxyReq = transport.request(options, (proxyRes) => {
      const responseHeaders = new Headers();
      Object.entries(proxyRes.headers).forEach(([key, value]) => {
        if (
          value &&
          key.toLowerCase() !== "transfer-encoding" &&
          key.toLowerCase() !== "connection"
        ) {
          responseHeaders.set(key, Array.isArray(value) ? value.join(", ") : value);
        }
      });

      const chunks: Buffer[] = [];
      proxyRes.on("data", (chunk) => chunks.push(chunk));
      proxyRes.on("end", () => {
        const responseBody = Buffer.concat(chunks);
        resolve(
          new Response(responseBody, {
            status: proxyRes.statusCode || 500,
            statusText: proxyRes.statusMessage || "Unknown",
            headers: responseHeaders,
          })
        );
      });
    });

    proxyReq.on("error", (error) => {
      console.error("Activity API proxy error:", error);
      resolve(
        new Response(
          JSON.stringify({
            error: "Failed to proxy request to Activity API",
            message: error.message,
          }),
          {
            status: 502,
            headers: { "Content-Type": "application/json" },
          }
        )
      );
    });

    if (body) {
      proxyReq.write(body);
    }
    proxyReq.end();
  });
}

export async function loader({ request }: LoaderFunctionArgs) {
  return proxyRequest(request);
}

export async function action({ request }: ActionFunctionArgs) {
  return proxyRequest(request);
}
