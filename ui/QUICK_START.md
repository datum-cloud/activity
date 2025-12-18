# Quick Start Guide

## Prerequisites

- Node.js 18+ installed
- npm or yarn

## Installation & Setup

### 1. Install Dependencies

From the repository root:

```bash
task ui:install
```

Or manually:

```bash
cd ui
npm install
```

### 2. Build the Component Library

```bash
task ui:build
```

Or manually:

```bash
cd ui
npm run build
```

### 3. Start the Example App

```bash
task ui:start
```

Or manually:

```bash
cd ui/example
npm install
npm run dev
```

The app will open at [http://localhost:3000](http://localhost:3000)

## Connecting to Activity

The example application has two modes:

### Mode 1: Direct Connection (Production/Remote API)

1. Enter the full URL of Activity
2. Optionally provide a bearer token for authentication
3. Click "Connect"

Example:
- URL: `https://activity-api.example.com`
- Token: `your-bearer-token-here`

### Mode 2: Local Development (with Proxy)

For local development with Activity running in Kubernetes:

1. **Port forward the API server:**
   ```bash
   task test-infra:kubectl -- port-forward -n activity-system svc/activity-apiserver 6443:443
   ```

2. **In the UI, use the proxy path:**
   - URL: `` (leave empty or use `http://localhost:3000`)
   - Token: (leave empty for local dev)

The Vite dev server will proxy `/apis` requests to `localhost:6443`.

## Testing Queries

Once connected, try these example queries:

1. **Recent deletes:**
   ```
   verb == "delete"
   ```

2. **Secret access:**
   ```
   resource == "secrets" && verb in ["get", "list"]
   ```

3. **Production changes:**
   ```
   ns == "production" && verb in ["create", "update", "delete"]
   ```

4. **Failed operations:**
   ```
   responseStatus.code >= 400
   ```

## Development Workflow

### Watch Mode

Build the component library in watch mode while developing:

```bash
task ui:dev
```

In another terminal, run the example app:

```bash
task ui:start
```

### Type Checking

```bash
task ui:type-check
```

### Linting

```bash
task ui:lint
```

## Troubleshooting

### Cannot connect to API

1. Verify Activity is running
2. Check port forwarding is active
3. Look for errors in the browser console
4. Check the proxy configuration in `ui/example/vite.config.ts`

### No events showing

1. Ensure ClickHouse has audit log data
2. Verify your CEL filter syntax
3. Try a simpler filter like `verb == "get"`
4. Check the API server logs

### Build errors

1. Delete `node_modules` and reinstall:
   ```bash
   task ui:clean
   task ui:install
   ```

2. Ensure you're using Node.js 18+:
   ```bash
   node --version
   ```

## Next Steps

- See [UI README](README.md) for component documentation
- See [Example README](example/README.md) for example app details
- See [Main README](../README.md) for Activity documentation
