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
kubectl apply -f .\kubernetes\timescaledb-init.yaml
kubectl apply -f .\kubernetes\behavior-secrets.local.yaml
kubectl apply -f .\kubernetes\kafka-sasl.local.yaml
kubectl apply -f .\kubernetes\kafka-jaas.local.yaml

kubectl apply -f .\kubernetes\timescaledb.yaml
kubectl apply -f .\kubernetes\kafka-svc.yaml
kubectl apply -f .\kubernetes\kafka-bootstrap-service.yaml
kubectl apply -f .\kubernetes\kafka-stateful-set.yaml

kubectl rollout status statefulset/timescaledb -n behavior --timeout=180s
kubectl rollout status statefulset/kafka -n kafka --timeout=300s

# Homelab-only, one-time: registers the staging environment with Argo CD.
# See docs/ci-cd.md for the two-stage (staging/production) promotion model.
kubectl apply -f .\argocd\behavior-staging-app.yaml
```

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
