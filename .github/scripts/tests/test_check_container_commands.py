import importlib.util
from pathlib import Path
import unittest

MODULE = Path(__file__).resolve().parents[1] / "check_container_commands.py"
spec = importlib.util.spec_from_file_location("commands", MODULE)
commands = importlib.util.module_from_spec(spec)
spec.loader.exec_module(commands)

def job(command):
    return {"kind": "Job", "metadata": {"name": "migrate"},
            "spec": {"template": {"spec": {"containers": [{"name": "migrate", "command": ["sh", "-ec", command]}]}}}}

class ContainerCommandsTest(unittest.TestCase):
    def test_rejects_double_dollar(self):
        self.assertTrue(commands.problems([job("psql <<'SQL'\nCREATE FUNCTION f() RETURNS trigger AS $$ BEGIN END; $$ LANGUAGE plpgsql;\nSQL")]))

    def test_accepts_named_dollar_quotes(self):
        self.assertEqual(commands.problems([job("CREATE FUNCTION f() RETURNS trigger AS $fn$ BEGIN END; $fn$ LANGUAGE plpgsql;")]), [])

if __name__ == "__main__":
    unittest.main()
