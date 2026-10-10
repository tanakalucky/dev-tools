// deploy / delete / skip の判定。副作用のない純粋関数だけを置く。
// commit author と PR 作成者(pr.user)は判定に使わない。

const BUILD_WORKFLOW_PATH = ".github/workflows/preview-build.yml";

const skip = (reason) => ({ action: "skip", reason });

/**
 * 上流の workflow_run と、API で取り直した現在の PR から対応を決める。
 * @returns {{ action: "deploy" | "delete" | "skip", reason: string }}
 */
export function decideDeploy({ run, pr, repo, owner, enabled }) {
  if (enabled !== true) return skip("有効化スイッチが true ではありません");
  if (typeof repo !== "string" || repo === "" || typeof owner !== "string" || owner === "") {
    return skip("repo または owner が指定されていません");
  }
  if (!run || typeof run !== "object") return skip("workflow_run の情報がありません");
  if (run.event !== "pull_request") return skip("上流のイベントが pull_request ではありません");
  if (run.conclusion !== "success") return skip("上流のビルドが成功していません");
  if (run.path !== BUILD_WORKFLOW_PATH) return skip("上流が preview-build ではありません");
  if (run.head_repository?.full_name !== repo)
    return skip("head リポジトリが同一 repo ではありません");
  if (run.actor?.login !== owner || run.triggering_actor?.login !== owner) {
    return skip("起動者または再実行者が owner ではありません");
  }
  if (!Array.isArray(run.pull_requests) || run.pull_requests.length !== 1) {
    return skip("run に紐づく PR がちょうど 1 件ではありません");
  }
  if (typeof run.head_sha !== "string" || run.head_sha === "") {
    return skip("run の head SHA がありません");
  }
  if (!pr || typeof pr !== "object") return skip("PR の情報がありません");
  if (pr.number !== run.pull_requests[0]?.number) return skip("PR 番号が run と一致しません");
  if (pr.head?.repo?.full_name !== repo || pr.base?.repo?.full_name !== repo) {
    return skip("head または base が同一 repo ではありません");
  }
  if (pr.state !== "open") return { action: "delete", reason: "PR が閉じられています" };
  if (pr.head?.sha !== run.head_sha) {
    return skip("PR の head が run の SHA と異なります(新しい実行に任せます)");
  }
  return { action: "deploy", reason: "条件をすべて満たしました" };
}

/** PR の close に対する片付けの判定。closed かつ同一 repo のときだけ delete。 */
export function decideCleanup({ pr, repo, enabled }) {
  if (enabled !== true) return skip("有効化スイッチが true ではありません");
  if (typeof repo !== "string" || repo === "") return skip("repo が指定されていません");
  if (!pr || typeof pr !== "object") return skip("PR の情報がありません");
  if (pr.head?.repo?.full_name !== repo || pr.base?.repo?.full_name !== repo) {
    return skip("head または base が同一 repo ではありません");
  }
  if (pr.state === "closed") return { action: "delete", reason: "PR が閉じられています" };
  if (pr.state === "open") return skip("PR は open です(reopen 済み)");
  return skip("PR の状態が不明です");
}
