import {
  INITIAL_STATE,
  pressKey,
  pasteNumber,
  type CalculatorKey,
  type CalculatorState,
} from "./calculator-state";
import { evaluate, type Operator } from "./evaluate";

export const HISTORY_LIMIT = 50;
export const HISTORY_STORAGE_KEY = "dev-tools.calculator.history";

export type HistoryEntry = { id: string; calculation: CalculatorState };
export type CalculatorSession = {
  calculator: CalculatorState;
  history: HistoryEntry[];
  loaded: boolean;
};

export const INITIAL_SESSION: CalculatorSession = {
  calculator: INITIAL_STATE,
  history: [],
  loaded: false,
};

export type SessionAction =
  | { type: "load"; history: HistoryEntry[] }
  | { type: "press"; key: CalculatorKey; id: string }
  | { type: "paste"; text: string }
  | { type: "restore"; id: string; mode: "edit" | "continue" }
  | { type: "delete"; id: string }
  | { type: "clear-history" };

// 計算と履歴を同じ遷移で更新する。連打・React の再評価で二重記録しない。
export function reduceSession(
  session: CalculatorSession,
  action: SessionAction,
): CalculatorSession {
  if (action.type === "load") {
    return session.loaded ? session : { ...session, history: action.history, loaded: true };
  }
  if (!session.loaded) return session;

  switch (action.type) {
    case "paste":
      return { ...session, calculator: pasteNumber(session.calculator, action.text) };
    case "press": {
      const calculator = pressKey(session.calculator, action.key);
      const completed = session.calculator.outcome === null && calculator.outcome !== null;
      return {
        ...session,
        calculator,
        history: completed
          ? [{ id: action.id, calculation: calculator }, ...session.history].slice(0, HISTORY_LIMIT)
          : session.history,
      };
    }
    case "restore": {
      const entry = session.history.find(({ id }) => id === action.id);
      if (!entry) return session;
      const { outcome } = entry.calculation;
      if (action.mode === "continue" && outcome?.kind !== "result") return session;
      const calculator =
        action.mode === "continue" && outcome?.kind === "result"
          ? { ...INITIAL_STATE, operands: [outcome.raw], carryDisplay: outcome.text }
          : { ...entry.calculation, outcome: null, notice: null };
      return {
        ...session,
        calculator,
      };
    }
    case "delete":
      return { ...session, history: session.history.filter(({ id }) => id !== action.id) };
    case "clear-history":
      return { ...session, history: [] };
  }
}

export function serializeHistory(history: HistoryEntry[]): string {
  return JSON.stringify({ version: 1, entries: history.slice(0, HISTORY_LIMIT) });
}

// 保存内容は信頼せず、式から結果を再計算する。破損した項目は他の項目と切り離して捨てる。
export function parseHistory(serialized: string | null): HistoryEntry[] {
  if (serialized === null) return [];
  try {
    const data: unknown = JSON.parse(serialized);
    if (!isRecord(data) || data.version !== 1 || !Array.isArray(data.entries)) return [];
    const history: HistoryEntry[] = [];
    const ids = new Set<string>();
    for (const value of data.entries) {
      const entry = parseEntry(value);
      if (!entry || ids.has(entry.id)) continue;
      history.push(entry);
      ids.add(entry.id);
      if (history.length === HISTORY_LIMIT) break;
    }
    return history;
  } catch {
    return [];
  }
}

function parseEntry(value: unknown): HistoryEntry | null {
  if (!isRecord(value) || typeof value.id !== "string" || !value.id || value.id.length > 100) {
    return null;
  }
  const calculation = value.calculation;
  if (!isRecord(calculation)) return null;
  const { operands, operators, carryDisplay } = calculation;
  if (
    !Array.isArray(operands) ||
    !operands.every(isNumber) ||
    !Array.isArray(operators) ||
    !operators.every(isOperator) ||
    operators.length === 0 ||
    operands.length !== operators.length + 1 ||
    (carryDisplay !== null && !isNumber(carryDisplay))
  ) {
    return null;
  }
  try {
    if (carryDisplay !== null) {
      const first = evaluate(operands.slice(0, 1), []);
      if (first.kind !== "value" || first.text !== carryDisplay) return null;
    }
    const restored = pressKey({ ...INITIAL_STATE, operands, operators, carryDisplay }, "=");
    if (restored.outcome?.kind === "result" && !isNumber(restored.outcome.raw)) return null;
    return { id: value.id, calculation: restored };
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNumber(value: unknown): value is string {
  return typeof value === "string" && /^-?\d+(?:\.\d+)?(?:e[+-]?\d+)?$/.test(value);
}

function isOperator(value: unknown): value is Operator {
  return value === "+" || value === "-" || value === "*" || value === "/";
}
