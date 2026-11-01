"""アプリ固有指示の参照と、配布してよい設定範囲を検証する。"""

from pathlib import Path
import re
import unittest


ROOT = Path(__file__).resolve().parents[2]
SOURCE_COMMIT = "1ebac1b35b51cda5e0de69445f99ceca89d01d83"


class ProjectIntegrationTests(unittest.TestCase):
    def test_project_links_resolve_inside_the_application(self):
        # Arrange
        agents = ROOT / "AGENTS.md"
        links = re.findall(r"\]\(([^)#]+)(?:#[^)]*)?\)", agents.read_text(encoding="utf-8"))

        # Act
        targets = {link: (ROOT / link).resolve(strict=True) for link in links}

        # Assert
        self.assertIn("README.md", targets)
        self.assertIn("tools/oxlint-boundaries/README.md", targets)
        self.assertIn("docs/deploy/README.md", targets)
        for link, target in targets.items():
            with self.subTest(link=link):
                self.assertTrue(target.is_relative_to(ROOT))
                self.assertTrue(target.is_file())

    def test_source_and_project_instructions_are_recorded(self):
        # Arrange
        source = ROOT / ".ai-config/README.md"
        agents = ROOT / "AGENTS.md"

        # Act
        provenance = source.read_text(encoding="utf-8")
        instructions = agents.read_text(encoding="utf-8")

        # Assert
        self.assertIn(SOURCE_COMMIT, provenance)
        for required in ("dev-tools 固有の指示", "features/*/lib", "components/ui/", "localStorage", "最大50件", "npm run test:e2e"):
            with self.subTest(rule=required):
                self.assertIn(required, instructions)

    def test_validation_history_and_secret_files_are_not_distributed(self):
        # Arrange
        roots = (ROOT / ".ai-config", ROOT / ".agents", ROOT / ".claude")
        forbidden_suffixes = (".jsonl", ".pem", ".key")

        # Act: inspect names only; never read credentials or ignored content.
        files = [path for root in roots for path in root.rglob("*") if path.is_file()]

        # Assert
        self.assertFalse((ROOT / ".ai-config/validation").exists())
        for path in files:
            with self.subTest(path=path.relative_to(ROOT)):
                self.assertNotIn(".git", path.parts)
                self.assertFalse(path.name.startswith((".env", ".dev.vars")))
                self.assertFalse(path.name.endswith(forbidden_suffixes))


if __name__ == "__main__":
    unittest.main()
