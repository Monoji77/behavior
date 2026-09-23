# Kubernetes rebuild guide

This directory contains the non-secret Kubernetes definition of the local
deployment. Secret values are deliberately not tracked.

## 1. Create local secret manifests

From the repository root, make ignored local copies of the templates:

```powershell
Copy-Item .\kubernetes\behavior-secrets.example.yaml .\kubernetes\behavior-secrets.local.yaml
Copy-Item .\kubernetes\kafka-sasl.yaml .\kubernetes\kafka-sasl.local.yaml
Copy-Item .\kubernetes\kafka-jaas.yaml .\kubernetes\kafka-jaas.local.yaml
```

Edit these files before applying them:

- `behavior-secrets.local.yaml`: set the PostgreSQL password, collector token,
  and Kafka client credential.
- `kafka-sasl.local.yaml`: set the bootstrap Kafka username and password.
- `kafka-jaas.local.yaml`: set the same Kafka username and password in the
  `jaas.conf` value.

The Kafka username/password must match in all three local files.

## 2. Apply dependencies

```powershell
kubectl apply -f .\kubernetes\namespace.yaml
kubectl apply -f .\kubernetes\behavior-db-config.yaml
kubectl apply -f .\kubernetes\database\timescaledb-init.yaml
kubectl apply -f .\kubernetes\behavior-secrets.local.yaml
kubectl apply -f .\kubernetes\kafka-sasl.local.yaml
kubectl apply -f .\kubernetes\kafka-jaas.local.yaml

# Homelab-only, requires the Tailscale operator (see argocd/tailscale-operator-app.yaml)
kubectl apply -f .\kubernetes\tailscale-db-service.yaml
kubectl apply -f .\kubernetes\tailscale-dashboard-ingress.yaml

kubectl apply -f .\kubernetes\database\timescaledb.yaml
kubectl apply -f .\kubernetes\kafka-svc.yaml
kubectl apply -f .\kubernetes\kafka-bootstrap-service.yaml
kubectl apply -f .\kubernetes\kafka-stateful-set.yaml

kubectl rollout status statefulset/timescaledb -n behavior --timeout=180s
kubectl rollout status statefulset/kafka -n kafka --timeout=300s

# Homelab-only, one-time: registers the staging environment with Argo CD.
# See docs/ci-cd.md for the two-stage (staging/production) promotion model.
kubectl apply -f .\argocd\behavior-staging-app.yaml
```

### Staging secrets

Staging runs its own database and ingestion endpoint, so it needs its own
secrets in `behavior-staging` before Argo CD syncs it. Use a **new** database
password and collector token, not production's:

```sh
kubectl create namespace behavior-staging --dry-run=client -o yaml | kubectl apply -f -
kubectl -n behavior-staging create secret generic behavior-secrets \
  --from-literal=POSTGRES_PASSWORD="$(openssl rand -hex 24)" \
  --from-literal=INGESTION_COLLECTOR_TOKEN="$(openssl rand -hex 24)" \
  --dry-run=client -o yaml | kubectl apply -f -
# Kafka has a single SCRAM user; staging reuses it (isolation is by topic).
kubectl get secret behavior-kafka-client -n behavior -o yaml \
  | sed -e '/namespace:/d' -e '/resourceVersion:/d' -e '/uid:/d' -e '/creationTimestamp:/d' \
  | kubectl apply -n behavior-staging -f -
```

TimescaleDB only reads `POSTGRES_PASSWORD` when it first creates its data
volume. To change it later, update the Secret and run `ALTER USER` in the
staging database, or delete staging's `data-timescaledb-0` PVC to start over.

To read the staging collector token: `kubectl -n behavior-staging get secret
behavior-secrets -o jsonpath='{.data.INGESTION_COLLECTOR_TOKEN}' | base64 -d`.
Send test events to `http://<node>:18090/api/v1/events` as in
`docs/local-development.md`; they land only in staging's topic and database.

### Dashboard URLs

Production and staging each run their own `dashboard` Service, and each URL
points at exactly one of them:

| URL | Environment | Reaches | Audience |
|---|---|---|---|
| `https://behavior-dashboard.taildcd567.ts.net/` | production | `dashboard.behavior` via `tailscale-dashboard-ingress.yaml` (Funnel) | public |
| `https://chris.taildcd567.ts.net/` | staging | `dashboard.behavior-staging`, node port 8092 | tailnet only |

The staging URL is the k3s node's own Tailscale name, so it is configured on
the node with `tailscale serve`, not in Kubernetes. Tailscale runs inside WSL
(not on the Windows host), and the same node also serves other routes (Argo CD on
`:8445`), so replace only the 443 handler. Once staging is deployed
(`curl -f http://127.0.0.1:8092/healthz` returns `ok`), from Windows:

```powershell
wsl.exe -d Ubuntu -u root -- tailscale serve status   # 443 currently -> 127.0.0.1:8082?
wsl.exe -d Ubuntu -u root -- tailscale serve --bg --https=443 http://127.0.0.1:8092
wsl.exe -d Ubuntu -u root -- tailscale serve status   # 443 -> :8092; :8445 unchanged
```

Never run `tailscale serve reset`, which removes every route. To roll back, rerun
the second command with `8082`. Verify from another tailnet device: a curl from
the node to its own tailnet hostname returns a Tailscale 404 even when the route
is correct.

Never enable Funnel on the node (`tailscale funnel`); staging stays private.

## 3. Create Kafka topics

Run this from PowerShell after the Kafka rollout completes. It uses the broker
JAAS file inside the pod and does not print credentials.

```powershell
kubectl exec -n kafka kafka-0 -- sh -ec '
printf "%s\n" "security.protocol=SASL_PLAINTEXT" "sasl.mechanism=SCRAM-SHA-512" > /tmp/client.properties
sed "s/KafkaServer/KafkaClient/" /opt/kafka/config/jaas/jaas.conf > /tmp/kafka-client-jaas.conf
export KAFKA_OPTS="-Djava.security.auth.login.config=/tmp/kafka-client-jaas.conf"
/opt/kafka/bin/kafka-topics.sh --bootstrap-server kafka-bootstrap.kafka.svc.cluster.local:9092 --command-config /tmp/client.properties --create --if-not-exists --topic app-usage-events.raw.v1 --partitions 3 --replication-factor 3
/opt/kafka/bin/kafka-topics.sh --bootstrap-server kafka-bootstrap.kafka.svc.cluster.local:9092 --command-config /tmp/client.properties --create --if-not-exists --topic app-usage-events.dlq.v1 --partitions 3 --replication-factor 3
'
```

## 4. Deploy application services

```powershell
kubectl apply -k ./kubernetes
kubectl rollout status deployment/ingestion-api -n behavior --timeout=180s
kubectl rollout status deployment/stream-processor -n behavior --timeout=180s
kubectl rollout status deployment/analytics-api -n behavior --timeout=180s
kubectl rollout status deployment/dashboard -n behavior --timeout=180s
```

The service images must be built into Docker Desktop before the final step.

## App icons

The stream processor looks up each new app's icon in Apple's iTunes Search API
every 5 minutes (10 apps per run) and stores it in `app_icons`; apps with no
confident match get `source = 'none'` and are retried after 7 days, and the
dashboard shows a letter instead. To set or fix an icon by hand (never
overwritten by the lookup):

```sql
INSERT INTO app_icons (app, icon_url, source) VALUES ('Settings', 'https://…/icon.png', 'manual')
ON CONFLICT (app) DO UPDATE SET icon_url = EXCLUDED.icon_url, source = 'manual', looked_up_at = NOW();
```

