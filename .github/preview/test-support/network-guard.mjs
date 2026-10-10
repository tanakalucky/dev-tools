// node --import で先読みする接続ガード。
// ループバック (127.0.0.1 / ::1 / localhost) 以外への接続を拒否し、
// 試みた宛先を PREFLIGHT_GUARD_LOG が指すファイルへ追記する。
import net from "node:net";
import tls from "node:tls";
import dns from "node:dns";
import fs from "node:fs";

const FLAG = Symbol.for("preflight.network-guard");

if (!globalThis[FLAG]) {
  globalThis[FLAG] = true;

  const logPath = process.env.PREFLIGHT_GUARD_LOG;
  const loopbackHosts = new Set(["127.0.0.1", "::1", "localhost", "[::1]"]);

  const record = (kind, target) => {
    if (!logPath) return;
    try {
      fs.appendFileSync(logPath, JSON.stringify({ kind, target, at: Date.now() }) + "\n");
    } catch {
      // ログに書けなくても遮断は続ける
    }
  };

  const isLoopback = (host) => typeof host === "string" && loopbackHosts.has(host);

  // net.Socket#connect の引数 (options / port, host / path) から宛先を取り出す
  const describeTarget = (args) => {
    let a = args[0];
    if (Array.isArray(a)) a = a[0];
    if (a && typeof a === "object") {
      if (a.path) return { host: null, label: `ipc:${a.path}` };
      const host = a.host ?? "localhost";
      return { host, label: `${host}:${a.port ?? ""}` };
    }
    if (typeof a === "string" && Number.isNaN(Number(a))) {
      return { host: null, label: `ipc:${a}` };
    }
    const host = typeof args[1] === "string" ? args[1] : "localhost";
    return { host, label: `${host}:${a ?? ""}` };
  };

  const origConnect = net.Socket.prototype.connect;
  net.Socket.prototype.connect = function guardedConnect(...args) {
    const { host, label } = describeTarget(args);
    if (!isLoopback(host)) {
      record("net.connect", label);
      const err = new Error(`network-guard: ループバック以外への接続を拒否しました (${label})`);
      err.code = "EGUARDBLOCKED";
      process.nextTick(() => this.destroy(err));
      return this;
    }
    return origConnect.apply(this, args);
  };

  const origTlsConnect = tls.connect;
  tls.connect = function guardedTlsConnect(...args) {
    const a = args[0];
    const host =
      a && typeof a === "object"
        ? (a.host ?? a.servername ?? "localhost")
        : (args[1] ?? "localhost");
    if (!isLoopback(host)) {
      record("tls.connect", String(host));
      const err = new Error(`network-guard: TLS 接続を拒否しました (${host})`);
      err.code = "EGUARDBLOCKED";
      throw err;
    }
    return origTlsConnect.apply(this, args);
  };

  const origLookup = dns.lookup;
  dns.lookup = function guardedLookup(hostname, ...rest) {
    if (!isLoopback(hostname) && !net.isIP(hostname)) {
      record("dns.lookup", String(hostname));
      const cb = rest[rest.length - 1];
      const err = new Error(`network-guard: 名前解決を拒否しました (${hostname})`);
      err.code = "EGUARDBLOCKED";
      if (typeof cb === "function") {
        process.nextTick(() => cb(err));
        return {};
      }
      throw err;
    }
    return origLookup.call(this, hostname, ...rest);
  };

  const origPromisesLookup = dns.promises.lookup;
  dns.promises.lookup = async function guardedPromisesLookup(hostname, ...rest) {
    if (!isLoopback(hostname) && !net.isIP(hostname)) {
      record("dns.promises.lookup", String(hostname));
      const err = new Error(`network-guard: 名前解決を拒否しました (${hostname})`);
      err.code = "EGUARDBLOCKED";
      throw err;
    }
    return origPromisesLookup.call(this, hostname, ...rest);
  };
}
