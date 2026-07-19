import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const issues = JSON.parse(readFileSync(join(root, "scripts/github-todos.json"), "utf8"));

for (let i = 0; i < issues.length; i++) {
  const item = issues[i];
  process.stdout.write(`[${i + 1}/${issues.length}] ${item.title}\n`);
  const url = execFileSync(
    "gh",
    [
      "issue",
      "create",
      "--title",
      item.title,
      "--label",
      `todo,${item.phase}`,
      "--body",
      item.body,
    ],
    { encoding: "utf8", cwd: root },
  );
  process.stdout.write(url);
}

process.stdout.write(`Done: ${issues.length} issues\n`);
