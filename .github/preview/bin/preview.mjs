// preview 基盤の薄い CLI。判定ロジックは lib/ にあり、ここは入出力だけを扱う。
// 使い方: node preview.mjs <decide-deploy | decide-cleanup | prepare-artifact | assert-name | make-synthetic>

import { rewriteWorkerConfig, writeSyntheticArtifact } from "../lib/artifact.mjs";
import { decideCleanup, decideDeploy } from "../lib/decide.mjs";
import { assertRepo, githubGet, writeOutputs } from "../lib/github.mjs";
import { assertPreviewWorkerName, parsePrNumber, previewWorkerName } from "../lib/names.mjs";

const env = process.env;

function apiOptions() {
  if (!env.GITHUB_TOKEN) throw new Error("GITHUB_TOKEN がありません");
  return { token: env.GITHUB_TOKEN, apiUrl: env.GITHUB_API_URL || "https://api.github.com" };
}

async function decideDeployCommand() {
  const repo = assertRepo(env.GITHUB_REPOSITORY);
  const enabled = env.PREVIEW_ENABLED === "true";
  if (!enabled) {
    await writeOutputs({ action: "skip", reason: "有効化スイッチが true ではありません" });
    return;
  }
  if (!/^[1-9][0-9]{0,17}$/.test(env.RUN_ID ?? "")) throw new Error("RUN_ID が不正です");
  const options = apiOptions();
  const run = await githubGet(`/repos/${repo}/actions/runs/${env.RUN_ID}`, options);
  const prNumber = Array.isArray(run.pull_requests) ? run.pull_requests[0]?.number : undefined;
  let pr = null;
  if (run.pull_requests?.length === 1) {
    pr = await githubGet(`/repos/${repo}/pulls/${parsePrNumber(prNumber)}`, options);
  }
  const decision = decideDeploy({ run, pr, repo, owner: env.PREVIEW_OWNER, enabled });
  const outputs = { ...decision };
  if (decision.action !== "skip") {
    outputs.name = previewWorkerName(prNumber);
    if (!/^[0-9a-f]{40}$/.test(run.head_sha)) throw new Error("head SHA が不正です");
    outputs.head_sha = run.head_sha;
  }
  await writeOutputs(outputs);
}

async function decideCleanupCommand() {
  const repo = assertRepo(env.GITHUB_REPOSITORY);
  const enabled = env.PREVIEW_ENABLED === "true";
  if (!enabled) {
    await writeOutputs({ action: "skip", reason: "有効化スイッチが true ではありません" });
    return;
  }
  const number = parsePrNumber(env.PR_NUMBER);
  const pr = await githubGet(`/repos/${repo}/pulls/${number}`, apiOptions());
  const decision = decideCleanup({ pr, repo, enabled });
  const outputs = { ...decision };
  if (decision.action === "delete") outputs.name = previewWorkerName(number);
  await writeOutputs(outputs);
}

const commands = {
  "decide-deploy": decideDeployCommand,
  "decide-cleanup": decideCleanupCommand,
  "prepare-artifact": async () => {
    const [dir, name] = process.argv.slice(3);
    const result = await rewriteWorkerConfig(dir, name);
    console.log(`成果物を検査し設定を書き換えました(ファイル ${result.files} 件、名前 ${name})`);
  },
  "assert-name": async () => {
    console.log(`名前を確認しました: ${assertPreviewWorkerName(env.WORKER_NAME)}`);
  },
  "make-synthetic": async () => {
    await writeSyntheticArtifact(process.argv[3]);
    console.log("合成の最小成果物を作成しました");
  },
};

const handler = commands[process.argv[2]];
if (!handler) {
  console.error("不明なサブコマンドです");
  process.exit(2);
}
try {
  await handler();
} catch (error) {
  console.error(`エラー: ${error.message}`);
  process.exit(1);
}
