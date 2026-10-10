import assert from "node:assert/strict";
import { test } from "node:test";
import { decideCleanup, decideDeploy } from "./decide.mjs";

const repo = "owner/app";
const owner = "owner";
const sha = "a".repeat(40);

const baseRun = () => ({
  event: "pull_request",
  conclusion: "success",
  path: ".github/workflows/preview-build.yml",
  head_sha: sha,
  head_repository: { full_name: repo },
  actor: { login: owner },
  triggering_actor: { login: owner },
  pull_requests: [{ number: 5 }],
});
const basePr = () => ({
  number: 5,
  state: "open",
  user: { login: owner },
  head: { sha, repo: { full_name: repo } },
  base: { repo: { full_name: repo } },
});
const decide = (patch = {}) =>
  decideDeploy({ run: baseRun(), pr: basePr(), repo, owner, enabled: true, ...patch });

test("すべて満たせば deploy", () => {
  assert.equal(decide().action, "deploy");
});

test("有効化スイッチが true 以外なら skip", () => {
  for (const enabled of [false, undefined, "true", 1, null]) {
    assert.equal(decide({ enabled }).action, "skip");
  }
});

test("run の条件が欠ければ skip", () => {
  const mutations = {
    イベント: (r) => (r.event = "push"),
    結論: (r) => (r.conclusion = "failure"),
    パス: (r) => (r.path = ".github/workflows/ci.yml"),
    "パス(末尾付き)": (r) => (r.path += "@refs/heads/main"),
    head_repository: (r) => (r.head_repository = { full_name: "fork/app" }),
    "head_repository なし": (r) => (r.head_repository = null),
    actor: (r) => (r.actor = { login: "other" }),
    triggering_actor: (r) => (r.triggering_actor = { login: "other" }),
    "PR なし": (r) => (r.pull_requests = []),
    "PR 複数": (r) => (r.pull_requests = [{ number: 5 }, { number: 6 }]),
    "head_sha なし": (r) => (r.head_sha = ""),
  };
  for (const [label, mutate] of Object.entries(mutations)) {
    const run = baseRun();
    mutate(run);
    assert.equal(decide({ run }).action, "skip", label);
  }
});

test("作成者が owner でも actor が違えば skip", () => {
  const run = baseRun();
  run.actor = { login: "someone" };
  const pr = basePr();
  pr.user = { login: owner };
  assert.equal(decide({ run, pr }).action, "skip");
});

test("PR の作成者が違っても actor が owner なら deploy", () => {
  const pr = basePr();
  pr.user = { login: "someone" };
  assert.equal(decide({ pr }).action, "deploy");
});

test("PR の整合が取れなければ skip", () => {
  const cases = {
    番号: (p) => (p.number = 6),
    "head repo": (p) => (p.head.repo = { full_name: "fork/app" }),
    "head repo null": (p) => (p.head.repo = null),
    "base repo": (p) => (p.base.repo = { full_name: "other/app" }),
  };
  for (const [label, mutate] of Object.entries(cases)) {
    const pr = basePr();
    mutate(pr);
    assert.equal(decide({ pr }).action, "skip", label);
  }
  assert.equal(decide({ pr: null }).action, "skip");
});

test("閉じた PR は delete、古い SHA は skip", () => {
  const closed = basePr();
  closed.state = "closed";
  assert.equal(decide({ pr: closed }).action, "delete");
  const stale = basePr();
  stale.head.sha = "b".repeat(40);
  assert.equal(decide({ pr: stale }).action, "skip");
});

test("閉じた PR でも fork や run 条件の欠落なら delete にしない", () => {
  const closed = basePr();
  closed.state = "closed";
  closed.head.repo = { full_name: "fork/app" };
  assert.equal(decide({ pr: closed }).action, "skip");
  const run = baseRun();
  run.actor = { login: "other" };
  const closed2 = basePr();
  closed2.state = "closed";
  assert.equal(decide({ run, pr: closed2 }).action, "skip");
});

test("cleanup: closed かつ同一 repo だけ delete", () => {
  const pr = basePr();
  pr.state = "closed";
  assert.equal(decideCleanup({ pr, repo, enabled: true }).action, "delete");
  assert.equal(decideCleanup({ pr, repo, enabled: false }).action, "skip");
  pr.head.repo = { full_name: "fork/app" };
  assert.equal(decideCleanup({ pr, repo, enabled: true }).action, "skip");
  const open = basePr();
  assert.equal(decideCleanup({ pr: open, repo, enabled: true }).action, "skip");
  const other = basePr();
  other.state = "draft";
  assert.equal(decideCleanup({ pr: other, repo, enabled: true }).action, "skip");
  assert.equal(decideCleanup({ pr: null, repo, enabled: true }).action, "skip");
});
