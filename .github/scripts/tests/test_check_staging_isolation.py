import copy
import importlib.util
from pathlib import Path
import unittest

MODULE = Path(__file__).resolve().parents[1] / "check_staging_isolation.py"
spec = importlib.util.spec_from_file_location("isolation", MODULE)
isolation = importlib.util.module_from_spec(spec)
spec.loader.exec_module(isolation)

def deployment(name, **variables):
    return {"kind": "Deployment", "metadata": {"name": name, "namespace": "behavior-staging"},
            "spec": {"template": {"spec": {"containers": [{"name": name, "env": [
                {"name": key, "value": value} for key, value in variables.items()]}]}}}}

def load_balancer(port, namespace):
    return {"kind": "Service", "metadata": {"name": "svc", "namespace": namespace},
            "spec": {"type": "LoadBalancer", "ports": [{"port": port}]}}

ISOLATED = [
    deployment("ingestion-api", INGESTION_TOPICS_RAWEVENTS="staging.app-usage-events.raw.v1"),
    deployment("stream-processor",
               POSTGRES_HOST="timescaledb",
               PROCESSOR_TOPICS_RAWEVENTS="app-usage-events.raw.v1,staging.app-usage-events.raw.v1",
               PROCESSOR_TOPICS_DEADLETTER="staging.app-usage-events.dlq.v1",
               SPRING_KAFKA_CONSUMER_GROUPID="raw-event-persistence-staging-v1"),
    load_balancer(18090, "behavior-staging"),
]
PRODUCTION = [load_balancer(18080, "behavior")]

class StagingIsolationTest(unittest.TestCase):
    def check(self, mutate=None):
        staging = copy.deepcopy(ISOLATED)
        if mutate:
            mutate(staging)
        return isolation.problems(staging, PRODUCTION)

    def set_env(self, staging, deployment_name, name, value):
        doc = next(d for d in staging if d["metadata"]["name"] == deployment_name)
        variables = doc["spec"]["template"]["spec"]["containers"][0]["env"]
        variables[:] = [v for v in variables if v["name"] != name] + ([{"name": name, "value": value}] if value else [])

    def test_accepts_isolated_staging(self):
        self.assertEqual(self.check(), [])

    def test_rejects_ingestion_writing_to_production_topic(self):
        self.assertTrue(self.check(lambda s: self.set_env(s, "ingestion-api", "INGESTION_TOPICS_RAWEVENTS", None)))

    def test_rejects_production_consumer_group(self):
        self.assertTrue(self.check(lambda s: self.set_env(
            s, "stream-processor", "SPRING_KAFKA_CONSUMER_GROUPID", "raw-event-persistence-v1")))

    def test_rejects_missing_consumer_group_override(self):
        self.assertTrue(self.check(lambda s: self.set_env(s, "stream-processor", "SPRING_KAFKA_CONSUMER_GROUPID", None)))

    def test_rejects_production_dead_letter_topic(self):
        self.assertTrue(self.check(lambda s: self.set_env(
            s, "stream-processor", "PROCESSOR_TOPICS_DEADLETTER", "app-usage-events.dlq.v1")))

    def test_rejects_processor_that_ignores_staging_topic(self):
        self.assertTrue(self.check(lambda s: self.set_env(
            s, "stream-processor", "PROCESSOR_TOPICS_RAWEVENTS", "app-usage-events.raw.v1")))

    def test_rejects_production_database_host(self):
        self.assertTrue(self.check(lambda s: self.set_env(
            s, "stream-processor", "POSTGRES_HOST", "timescaledb.behavior.svc.cluster.local")))

    def test_rejects_node_port_collision(self):
        self.assertTrue(self.check(lambda s: s.append(load_balancer(18080, "behavior-staging"))))

    def test_rejects_resources_outside_staging_namespace(self):
        def move(staging):
            staging[0]["metadata"]["namespace"] = "behavior"
        self.assertTrue(self.check(move))

if __name__ == "__main__":
    unittest.main()
