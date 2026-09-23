#!/usr/bin/env python3
"""Fail if the rendered staging manifests could touch production's data.

Kafka has no ACLs and both environments share one k3s node, so only
configuration keeps staging off production's topics, consumer group,
database and node ports. Usage:
    check_staging_isolation.py <staging-rendered.yaml> <production-rendered.yaml>
"""
import sys
import yaml

PRODUCTION_CONSUMER_GROUP = "raw-event-persistence-v1"
STAGING_PREFIX = "staging."

def load(path):
    return [doc for doc in yaml.safe_load_all(open(path)) if doc]

def env(docs, deployment):
    for doc in docs:
        if doc["kind"] == "Deployment" and doc["metadata"]["name"] == deployment:
            return {e["name"]: e.get("value") for e in doc["spec"]["template"]["spec"]["containers"][0].get("env", [])}
    return None

def load_balancer_ports(docs):
    return {port["port"] for doc in docs
            if doc["kind"] == "Service" and doc["spec"].get("type") == "LoadBalancer"
            for port in doc["spec"]["ports"]}

def problems(staging, production):
    found = []
    for doc in staging:
        namespace = doc["metadata"].get("namespace")
        if namespace not in (None, "behavior-staging"):
            found.append(f"{doc['kind']}/{doc['metadata']['name']} is in namespace {namespace}")
        if doc["kind"] in ("Deployment", "StatefulSet", "Job"):
            for container in doc["spec"]["template"]["spec"]["containers"]:
                for variable in container.get("env", []):
                    if ".behavior.svc" in str(variable.get("value", "")):
                        found.append(f"{doc['metadata']['name']}: {variable['name']} points into the production namespace")

    ingestion = env(staging, "ingestion-api")
    if ingestion is not None:
        topic = ingestion.get("INGESTION_TOPICS_RAWEVENTS") or ""
        if not topic.startswith(STAGING_PREFIX):
            found.append(f"ingestion-api must write to a {STAGING_PREFIX}* topic, not {topic or 'the default (production) topic'}")

    processor = env(staging, "stream-processor")
    if processor is not None:
        group = processor.get("SPRING_KAFKA_CONSUMER_GROUPID") or ""
        if not group or group == PRODUCTION_CONSUMER_GROUP:
            found.append(f"stream-processor must use its own consumer group, not {group or 'the default (production) group'}")
        dead_letter = processor.get("PROCESSOR_TOPICS_DEADLETTER") or ""
        if not dead_letter.startswith(STAGING_PREFIX):
            found.append(f"stream-processor must dead-letter to a {STAGING_PREFIX}* topic, not {dead_letter or 'the default (production) topic'}")
        raw = (processor.get("PROCESSOR_TOPICS_RAWEVENTS") or "").split(",")
        if not any(topic.strip().startswith(STAGING_PREFIX) for topic in raw):
            found.append("stream-processor must also read staging's own raw topic")

    shared = load_balancer_ports(staging) & load_balancer_ports(production)
    if shared:
        found.append(f"staging LoadBalancer ports {sorted(shared)} are already used by production on the node")
    return found

if __name__ == "__main__":
    issues = problems(load(sys.argv[1]), load(sys.argv[2]))
    for issue in issues:
        print(f"::error::{issue}")
    if issues:
        sys.exit(1)
    print("Staging is isolated from production's topics, consumer group, database and node ports.")
