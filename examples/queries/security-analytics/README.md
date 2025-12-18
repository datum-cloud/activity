# Security Analytics Examples

Pre-built queries for security monitoring and threat detection.

## Examples

1. **[01-privilege-escalation-attempts.yaml](01-privilege-escalation-attempts.yaml)** - Detect RBAC policy changes
2. **[02-secret-access.yaml](02-secret-access.yaml)** - Track access to secrets
3. **[03-failed-authentication.yaml](03-failed-authentication.yaml)** - Find authentication failures (401)
4. **[04-permission-denied.yaml](04-permission-denied.yaml)** - Track authorization failures (403)

## Security Monitoring Best Practices

### 1. Continuous Monitoring

Set up persistent queries for critical security events:

```bash
# Apply all security queries
kubectl apply -f security-analytics/

# Check for new threats regularly
watch -n 60 'kubectl get auditlogquery -l category=security'
```

### 2. Alert Integration

Export query results to your SIEM or alerting system:

```bash
# Get failed auth attempts as JSON
kubectl get auditlogquery failed-authentication -o json > alerts.json
```

### 3. Investigation Workflow

When investigating a security event:

1. Start with broad queries (all failed operations)
2. Narrow down by time window
3. Focus on specific user or resource
4. Check related events (before/after)

### 4. Common Threat Patterns

**Privilege Escalation:**
- Changes to RBAC policies
- Service account token access
- Permission denied followed by RBAC changes

**Data Exfiltration:**
- Unusual secret access patterns
- Large volume of read operations
- Cross-namespace access patterns

**Lateral Movement:**
- Service account activity across namespaces
- Unusual resource access patterns
- Failed authorization attempts

## Detection Use Cases

### Insider Threat Detection

```yaml
spec:
  filter: |
    user.username.contains('@company.com') &&
    objectRef.resource in ['secrets', 'configmaps'] &&
    verb in ['get', 'list']
```

### Compromised Service Account

```yaml
spec:
  filter: |
    user.username.startsWith('system:serviceaccount:') &&
    responseStatus.code == 403
```

### Unusual Write Operations

```yaml
spec:
  filter: |
    verb in ['create', 'update', 'patch', 'delete'] &&
    objectRef.namespace == 'production' &&
    responseStatus.code >= 200 && responseStatus.code < 300
```

## Integration with SIEM

Export events for analysis:

```bash
# Export to JSON for Splunk/ELK
kubectl get auditlogquery privilege-escalation-attempts -o json

# Stream to log aggregator
kubectl get auditlogquery --watch -o json | your-log-shipper
```

## Alerting Examples

Set up alerts using Grafana + ClickHouse datasource:

1. Create alert rules based on query results
2. Set thresholds (e.g., >10 failed auth in 5 min)
3. Route to Slack/PagerDuty/email

## Compliance

Many security queries support compliance requirements:

- **SOC 2**: Failed auth tracking, access monitoring
- **PCI-DSS**: Secrets access, admin actions
- **HIPAA**: Data access audit trails
- **ISO 27001**: Privilege escalation detection

## Next Steps

- [Compliance Examples](../compliance/) - Regulatory compliance queries
- [Troubleshooting](../troubleshooting/) - Incident investigation
