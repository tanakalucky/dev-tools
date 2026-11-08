"""アプリ固有指示の参照と、配布してよい設定範囲を検証する。"""

from pathlib import Path
import re
import tomllib
import unittest


ROOT = Path(__file__).resolve().parents[2]
SOURCE_COMMIT = "8b9dabdc34eb493be5bd061d0c439590552c4099"


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
        roots = (ROOT / ".ai-config", ROOT / ".agents", ROOT / ".claude", ROOT / ".codex/agents")
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


    def test_共通設定の参照がアプリ内で解決する(self):
        # Arrange
        roots = (".ai-config", ".agents", ".claude", ".codex/agents")
        documents = [ROOT / "AGENTS.md"]
        for root in roots:
            documents.extend((ROOT / root).rglob("*.md"))
            documents.extend((ROOT / root).rglob("*.toml"))

        # Act
        references = []
        for document in documents:
            text = document.read_text(encoding="utf-8")
            for link in re.findall(r"\]\(([^)]+)\)", text):
                if re.match(r"[a-zA-Z][a-zA-Z0-9+.-]*:|#", link):
                    continue
                references.append((document, document.parent / link.split("#")[0]))

        # Assert
        self.assertTrue(references)
        for document, target in references:
            with self.subTest(document=document.relative_to(ROOT), target=target):
                self.assertTrue(target.exists())
                self.assertTrue(target.resolve().is_relative_to(ROOT))

    def test_共通入口と役割定義が揃い旧入口が残らない(self):
        # Arrange
        names = ("clarify", "fsd", "cloudflare-deploy", "development-orchestrator",
                 "development-improvement", "weekly-discovery", "ai-dev-config-review",
                 "review-correctness", "review-tests", "review-design")
        roles = ("bug-researcher", "implementer", "improvement-analyst", "refactor-researcher",
                 "review-correctness", "review-design", "review-tests", "voter")

        # Act
        entries = [ROOT / tool / "skills" / name / "SKILL.md"
                   for tool in (".agents", ".claude") for name in names]
        definitions = [ROOT / tool / "agents" / ("ai-dev-" + role + extension)
                       for tool, extension in ((".codex", ".toml"), (".claude", ".md"))
                       for role in roles]

        # Assert
        self.assertTrue((ROOT / "CLAUDE.md").is_symlink())
        self.assertEqual((ROOT / "CLAUDE.md").readlink(), Path("AGENTS.md"))
        for path in entries + definitions:
            with self.subTest(path=path.relative_to(ROOT)):
                self.assertTrue(path.is_file())
                if path.suffix == ".toml":
                    definition = tomllib.loads(path.read_text(encoding="utf-8"))
                    self.assertEqual(definition["name"], path.stem)
                    self.assertTrue(definition["developer_instructions"])
        self.assertFalse(list((ROOT / ".agents/skills").glob("config-*")))
        self.assertFalse((ROOT / ".claude/skills/review").exists())


if __name__ == "__main__":
    unittest.main()
