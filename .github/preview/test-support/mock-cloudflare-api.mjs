// Cloudflare API の模擬サーバー (ループバック専用)。
// 受け取ったリクエストの概要だけを記録する。Authorization の値は記録せず有無のみ残す。
import http from "node:http";

const ACCOUNT = "00000000000000000000000000000000";

const NOT_FOUND = {
  __status: 404,
  errors: [{ code: 10090, message: "workers.api.error.service_not_found" }],
};

// 経路ごとの応答を作る。
//   existing: Worker が既に存在する応答にする
//   buckets: assets-upload-session が未アップロードのファイルを返す (本体アップロード経路)
//   missing: Worker 関連の GET / DELETE を 404 にする (存在しない Worker)
export function makeRoute({ existing = false, buckets = false, missing = false } = {}) {
  return function route(method, path, json) {
    if (path.endsWith("/user/tokens/verify")) return { id: "fake-token-id", status: "active" };
    if (path === "/client/v4/accounts") return [{ id: ACCOUNT, name: "preflight-account" }];
    if (missing && /\/workers\//.test(path) && (method === "GET" || method === "DELETE")) {
      if (!path.endsWith("/subdomain") && !path.endsWith("/deployments")) return NOT_FOUND;
    }
    if (method === "GET" && /\/workers\/services\/[^/]+$/.test(path)) {
      if (!existing) return NOT_FOUND;
      const name = path.split("/").pop();
      return {
        id: name,
        default_environment: {
          environment: "production",
          script: {
            id: name,
            tag: "preflight-tag",
            etag: "preflight-etag",
            created_on: "2026-01-01T00:00:00Z",
            modified_on: "2026-01-01T00:00:00Z",
          },
        },
      };
    }
    if (method === "GET" && path.endsWith("/deployments")) return { deployments: [] };
    // 既存 Worker の更新は versions 作成 -> deployments 作成の経路を通る
    if (method === "POST" && path.endsWith("/versions")) {
      return {
        id: "preflight-version-id",
        number: 1,
        metadata: {},
        startup_time_ms: 1,
        resources: { bindings: [], script: { etag: "preflight-etag" }, script_runtime: {} },
      };
    }
    if (method === "POST" && path.endsWith("/deployments")) {
      return {
        id: "preflight-deployment-id",
        strategy: "percentage",
        versions: [{ version_id: "preflight-version-id", percentage: 100 }],
      };
    }
    if (path.endsWith("/assets-upload-session")) {
      // 本体アップロード経路では、送られた manifest の hash をすべて未アップロードとして返す
      const hashes =
        buckets && json && json.manifest ? Object.values(json.manifest).map((v) => v.hash) : [];
      return { jwt: "preflight-fake-asset-jwt", buckets: hashes.length > 0 ? [hashes] : [] };
    }
    if (path.endsWith("/assets/upload")) return { jwt: "preflight-fake-completion-jwt" };
    if (/\/workers\/workers\/[^/]+$/.test(path)) {
      return { id: "preflight-worker-id", subdomain: { enabled: false, previews_enabled: false } };
    }
    if (path.endsWith("/workers/subdomain")) return { subdomain: "preflight" };
    return {};
  };
}

export const routeResult = makeRoute();

function summarizeBody(contentType, buf) {
  if (buf.length === 0) return { kind: "empty", bytes: 0 };
  const ct = contentType || "";
  if (ct.includes("multipart/form-data")) {
    const text = buf.toString("latin1");
    const names = [...text.matchAll(/Content-Disposition:[^\r\n]*?name="([^"]+)"/gi)].map(
      (m) => m[1],
    );
    return { kind: "multipart", bytes: buf.length, partNames: names };
  }
  if (ct.includes("json")) {
    try {
      const v = JSON.parse(buf.toString("utf8"));
      return {
        kind: "json",
        bytes: buf.length,
        keys: v && typeof v === "object" ? Object.keys(v) : [],
      };
    } catch {
      return { kind: "json-invalid", bytes: buf.length };
    }
  }
  return { kind: "other", bytes: buf.length, contentType: ct };
}

function parseJson(contentType, buf) {
  if (!(contentType || "").includes("json") || buf.length === 0) return undefined;
  try {
    return JSON.parse(buf.toString("utf8"));
  } catch {
    return undefined;
  }
}

export async function startMockApi({ route = routeResult } = {}) {
  const requests = [];
  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const buf = Buffer.concat(chunks);
      const url = new URL(req.url, "http://127.0.0.1");
      requests.push({
        method: req.method,
        path: url.pathname,
        query: [...url.searchParams.keys()],
        hasAuthorization: Boolean(req.headers.authorization),
        hasContentType: Boolean(req.headers["content-type"]),
        userAgent: req.headers["user-agent"] ? "present" : "absent",
        body: summarizeBody(req.headers["content-type"], buf),
      });
      const result = route(req.method, url.pathname, parseJson(req.headers["content-type"], buf));
      const failed = result && result.__status;
      const payload = JSON.stringify(
        failed
          ? { success: false, errors: result.errors, messages: [], result: null }
          : { success: true, errors: [], messages: [], result },
      );
      res.writeHead(failed ? result.__status : 200, { "content-type": "application/json" });
      res.end(payload);
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  return {
    port,
    requests,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}
