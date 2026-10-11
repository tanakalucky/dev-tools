import { evaluate, type Evaluation, type Operator } from "./evaluate";

const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;

export type Digit = (typeof DIGITS)[number];
export type CalculatorKey = Digit | "." | Operator | "=" | "backspace" | "clear";

export type Outcome =
  | { kind: "result"; text: string; raw: string; approximate: boolean }
  | { kind: "error"; message: string };

// operators.length が operands.length と等しいとき、式は演算子で終わっている。
export type CalculatorState = {
  operands: string[];
  operators: Operator[];
  outcome: Outcome | null;
  carryDisplay: string | null;
  carryApproximate: boolean;
  notice: string | null;
};

export type Display = {
  expression: string;
  result: string;
  isError: boolean;
  copyText: string | null;
};

export const OPERATOR_SYMBOLS: Record<Operator, string> = {
  "+": "＋",
  "-": "−",
  "*": "×",
  "/": "÷",
};

export const EQUALS_SYMBOL = "＝";
export const DIVIDE_BY_ZERO_MESSAGE = "0で割れません";
export const MAX_OPERAND_DIGITS = 40;
export const TOO_MANY_DIGITS_NOTICE = `1つの数値は${MAX_OPERAND_DIGITS}桁までです`;

export const INITIAL_STATE: CalculatorState = {
  operands: [],
  operators: [],
  outcome: null,
  carryDisplay: null,
  carryApproximate: false,
  notice: null,
};

// 指数表記(例: 1.23e+12)になった結果は、文字単位の編集の対象にしない。
const EDITABLE_OPERAND = /^-?\d*\.?\d*$/;

const KEYBOARD_KEYS = new Map<string, CalculatorKey>([
  ...DIGITS.map((digit): [string, CalculatorKey] => [digit, digit]),
  [".", "."],
  ["+", "+"],
  ["-", "-"],
  ["*", "*"],
  ["/", "/"],
  ["=", "="],
  ["Enter", "="],
  ["Backspace", "backspace"],
  ["Escape", "clear"],
]);

export function pressKey(state: CalculatorState, key: CalculatorKey): CalculatorState {
  switch (key) {
    case "clear":
      return INITIAL_STATE;
    case "backspace":
      return pressBackspace(state);
    case "=":
      return pressEquals(state);
    case "+":
    case "-":
    case "*":
    case "/":
      return pressOperator(state, key);
    default:
      return pressNumberKey(state, key);
  }
}

export function parseKeyboardKey(eventKey: string): CalculatorKey | null {
  return KEYBOARD_KEYS.get(eventKey) ?? null;
}

export function getDisplay(state: CalculatorState): Display {
  const { operands, operators, outcome, carryDisplay } = state;

  const terms = operands.flatMap((operand, index) => {
    const operator = operators[index];

    const shown = index === 0 && carryDisplay !== null ? carryDisplay : operand;

    return operator === undefined ? [shown] : [shown, OPERATOR_SYMBOLS[operator]];
  });
  const expression = (outcome === null ? terms : [...terms, EQUALS_SYMBOL]).join(" ");

  if (outcome?.kind === "error") {
    return { expression, result: outcome.message, isError: true, copyText: null };
  }

  if (outcome?.kind === "result") {
    return { expression, result: outcome.text, isError: false, copyText: outcome.text };
  }

  const result =
    operands.length === 1 && carryDisplay !== null ? carryDisplay : (operands.at(-1) ?? "0");

  return { expression, result, isError: false, copyText: null };
}

function pressNumberKey(state: CalculatorState, key: Digit | "."): CalculatorState {
  // 結果・エラーの後の数字と小数点は、新しい計算を始める。
  const base = state.outcome === null ? state : INITIAL_STATE;
  const startsOperand = base.operators.length === base.operands.length;
  const editsCarry = !startsOperand && base.operands.length === 1 && base.carryDisplay !== null;
  const current = startsOperand
    ? ""
    : editsCarry
      ? base.carryDisplay!
      : (base.operands.at(-1) ?? "");

  if (!EDITABLE_OPERAND.test(current)) {
    return withoutNotice(base);
  }

  const next = appendToOperand(current, key);

  if (next === current) {
    return withoutNotice(base);
  }

  if (countDigits(next) > MAX_OPERAND_DIGITS) {
    return { ...base, notice: TOO_MANY_DIGITS_NOTICE };
  }

  const kept = startsOperand ? base.operands : base.operands.slice(0, -1);

  return {
    ...base,
    operands: [...kept, next],
    carryDisplay: editsCarry ? null : base.carryDisplay,
    carryApproximate: editsCarry ? false : base.carryApproximate,
    notice: null,
  };
}

function pressOperator(state: CalculatorState, operator: Operator): CalculatorState {
  const { outcome, operands, operators } = state;

  if (outcome?.kind === "error") {
    return state;
  }

  if (outcome?.kind === "result") {
    return {
      ...INITIAL_STATE,
      operands: [outcome.raw],
      operators: [operator],
      carryDisplay: outcome.text,
      carryApproximate: outcome.approximate,
    };
  }

  if (operands.length === 0) {
    return { ...INITIAL_STATE, operands: ["0"], operators: [operator] };
  }

  if (operators.length === operands.length) {
    return { ...state, operators: [...operators.slice(0, -1), operator], notice: null };
  }

  return {
    ...state,
    operands: dropTrailingDot(operands),
    operators: [...operators, operator],
    notice: null,
  };
}

function pressEquals(state: CalculatorState): CalculatorState {
  const { operands, operators, outcome } = state;
  const isComplete =
    outcome === null && operators.length > 0 && operators.length === operands.length - 1;

  if (!isComplete) {
    return withoutNotice(state);
  }

  const finished = dropTrailingDot(operands);

  return {
    ...state,
    operands: finished,
    outcome: toOutcome(evaluate(finished, operators, state.carryApproximate)),
    notice: null,
  };
}

// 結果・エラーの後は「＝」を取り消して式の編集に戻る。文字は削らない。
function pressBackspace(state: CalculatorState): CalculatorState {
  const { operands, operators } = state;

  if (state.outcome !== null) {
    return { ...state, outcome: null, notice: null };
  }

  if (operators.length === operands.length) {
    return { ...state, operators: operators.slice(0, -1), notice: null };
  }

  const editsCarry = operands.length === 1 && state.carryDisplay !== null;
  const last = editsCarry ? state.carryDisplay! : (operands.at(-1) ?? "");
  const shortened = EDITABLE_OPERAND.test(last) ? last.slice(0, -1) : "";
  const isEmpty = shortened === "" || shortened === "-";

  return {
    ...state,
    operands: isEmpty ? operands.slice(0, -1) : [...operands.slice(0, -1), shortened],
    carryDisplay: editsCarry ? null : state.carryDisplay,
    carryApproximate: editsCarry ? false : state.carryApproximate,
    notice: null,
  };
}

function appendToOperand(current: string, key: Digit | "."): string {
  if (key === ".") {
    return current.includes(".") ? current : `${current === "" ? "0" : current}.`;
  }

  return current === "0" ? key : current + key;
}

function dropTrailingDot(operands: string[]): string[] {
  const last = operands.at(-1);

  return last?.endsWith(".") ? [...operands.slice(0, -1), last.slice(0, -1)] : operands;
}

function countDigits(operand: string): number {
  return operand.replace(/\D/g, "").length;
}

function toOutcome(evaluation: Evaluation): Outcome {
  return evaluation.kind === "value"
    ? {
        kind: "result",
        text: evaluation.text,
        raw: evaluation.raw,
        approximate: evaluation.approximate,
      }
    : { kind: "error", message: DIVIDE_BY_ZERO_MESSAGE };
}

function withoutNotice(state: CalculatorState): CalculatorState {
  return { ...state, notice: null };
}
