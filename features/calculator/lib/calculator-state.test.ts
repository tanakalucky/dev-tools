import { describe, expect, it } from "vitest";

import {
  INITIAL_STATE,
  MAX_OPERAND_DIGITS,
  TOO_MANY_DIGITS_NOTICE,
  getDisplay,
  parseKeyboardKey,
  pressKey,
  type CalculatorKey,
  type CalculatorState,
} from "./calculator-state";

describe("calculation", () => {
  it("shows 0 and an empty expression at the start", () => {
    expect(getDisplay(INITIAL_STATE)).toEqual({
      expression: "",
      result: "0",
      isError: false,
      copyText: null,
    });
  });

  it("follows operator precedence: 2+3×4=14", () => {
    expect(show("2+3*4=")).toMatchObject({ expression: "2 ＋ 3 × 4 ＝", result: "14" });
  });

  it("supports − and ÷ with decimals", () => {
    expect(show("7.5/2-0.25=")).toMatchObject({ result: "3.5" });
  });

  it("shows 0.1+0.2 as 0.3", () => {
    expect(show("0.1+0.2=")).toMatchObject({ result: "0.3", copyText: "0.3" });
  });

  it("rounds the result to 12 significant digits", () => {
    expect(show("1/3=")).toMatchObject({ result: "0.333333333333", copyText: "0.333333333333" });
  });

  it("shows the expression with the sample from the design: 128 + 64 = 192", () => {
    expect(show("128+64=")).toEqual({
      expression: "128 ＋ 64 ＝",
      result: "192",
      isError: false,
      copyText: "192",
    });
  });

  it("shows the operand being entered as the live result", () => {
    expect(show("12+345")).toMatchObject({ expression: "12 ＋ 345", result: "345" });
    expect(show("12+345").copyText).toBeNull();
    expect(show("12+")).toMatchObject({ expression: "12 ＋", result: "12" });
  });
});

describe("number entry", () => {
  it("normalizes a leading zero", () => {
    expect(show("007")).toMatchObject({ expression: "7" });
    expect(show("0")).toMatchObject({ expression: "0" });
    expect(show("00")).toMatchObject({ expression: "0" });
    expect(show("0.05")).toMatchObject({ expression: "0.05" });
  });

  it("starts an operand with 0. when the dot comes first", () => {
    expect(show(".5")).toMatchObject({ expression: "0.5" });
    expect(show("1+.5")).toMatchObject({ expression: "1 ＋ 0.5" });
  });

  it("ignores a second dot in the same operand but allows one in the next", () => {
    expect(show("1.2.3")).toMatchObject({ expression: "1.23" });
    expect(show("1.2+3.4.5")).toMatchObject({ expression: "1.2 ＋ 3.45" });
  });

  it("drops a trailing dot when an operator or = follows", () => {
    expect(show("5.+")).toMatchObject({ expression: "5 ＋" });
    expect(show("5.+2.=")).toMatchObject({ expression: "5 ＋ 2 ＝", result: "7" });
  });

  it("accepts more than 12 digits and rounds only the result", () => {
    expect(show("1234567890123-1234567890122=")).toMatchObject({ result: "1" });
  });
});

describe("operators", () => {
  it("replaces the previous operator when an operator repeats", () => {
    expect(show("5+*3")).toMatchObject({ expression: "5 × 3" });
    expect(show("5+-")).toMatchObject({ expression: "5 −" });
    expect(show("5+-*/")).toMatchObject({ expression: "5 ÷" });
  });

  it("uses 0 as the first operand when an operator comes first", () => {
    expect(show("-5=")).toMatchObject({ expression: "0 − 5 ＝", result: "-5" });
  });

  it("does nothing for = on an incomplete expression", () => {
    expect(pressKeys("=")).toEqual(INITIAL_STATE);
    expect(pressKeys("5=")).toEqual(pressKeys("5"));
    expect(pressKeys("5+=")).toEqual(pressKeys("5+"));
  });
});

describe("after a result", () => {
  it("starts a new calculation with a digit or a dot", () => {
    expect(show("1+2=9")).toMatchObject({ expression: "9", result: "9" });
    expect(show("1+2=.")).toMatchObject({ expression: "0." });
  });

  it("continues from the result with an operator", () => {
    expect(show("1+2=*4=")).toMatchObject({ expression: "3 × 4 ＝", result: "12" });
    expect(show("1+2=*")).toMatchObject({ expression: "3 ×" });
  });

  it("continues from a negative result", () => {
    expect(show("1-3=+5=")).toMatchObject({ expression: "-2 ＋ 5 ＝", result: "3" });
  });

  it("continues from the internal decimal value rather than the rounded display", () => {
    expect(show("1/3=*3=")).toMatchObject({ result: "1", expression: "0.333333333333 × 3 ＝" });
  });

  it("hides recurring-decimal residue after cancellation, including continued calculations", () => {
    expect(show("1/3*3-1=")).toMatchObject({ result: "0", copyText: "0" });
    expect(show("1/3=*3=-1=")).toMatchObject({ result: "0", copyText: "0" });
  });

  it("keeps the internal value when a pending operator is removed and entered again", () => {
    expect(show("1/3=*B*3=")).toMatchObject({
      result: "1",
      expression: "0.333333333333 × 3 ＝",
    });
    expect(show("1/3=*B")).toMatchObject({
      result: "0.333333333333",
      expression: "0.333333333333",
    });
  });

  it("edits the displayed value only when a digit or another Backspace changes it", () => {
    expect(show("1/3=*B4")).toMatchObject({ result: "0.3333333333334" });
    expect(show("1/3=*BB")).toMatchObject({ result: "0.33333333333" });
  });

  it("ignores another =", () => {
    expect(pressKeys("1+2==")).toEqual(pressKeys("1+2="));
  });

  it("returns to editing the same expression on backspace without deleting a character", () => {
    expect(show("1+2=B")).toMatchObject({ expression: "1 ＋ 2", result: "2", copyText: null });
    expect(show("1+2=B3=")).toMatchObject({ expression: "1 ＋ 23 ＝", result: "24" });
  });
});

describe("division by zero", () => {
  it("shows a short error and no copy text", () => {
    expect(show("5/0=")).toEqual({
      expression: "5 ÷ 0 ＝",
      result: "0で割れません",
      isError: true,
      copyText: null,
    });
  });

  it("reports an error for a zero divisor in any part of the expression", () => {
    expect(show("1+2/0=")).toMatchObject({ isError: true });
    expect(show("0/0=")).toMatchObject({ isError: true });
  });

  it("recovers into a new calculation on the next digit or dot", () => {
    expect(show("5/0=7")).toMatchObject({ expression: "7", isError: false });
    expect(show("5/0=.")).toMatchObject({ expression: "0.", isError: false });
  });

  it("recovers on AC", () => {
    expect(pressKeys("5/0=C")).toEqual(INITIAL_STATE);
  });

  it("ignores operators and = until it recovers", () => {
    expect(pressKeys("5/0=+")).toEqual(pressKeys("5/0="));
    expect(pressKeys("5/0==")).toEqual(pressKeys("5/0="));
  });

  it("returns to editing the expression on backspace so the divisor can be fixed", () => {
    expect(show("5/0=B")).toMatchObject({ expression: "5 ÷ 0", isError: false });
    expect(show("5/0=BB2=")).toMatchObject({ expression: "5 ÷ 2 ＝", result: "2.5" });
  });
});

describe("backspace and AC", () => {
  it("removes one character at a time, then the operator, then the previous operand", () => {
    expect(show("12+34B")).toMatchObject({ expression: "12 ＋ 3" });
    expect(show("12+34BB")).toMatchObject({ expression: "12 ＋" });
    expect(show("12+34BBB")).toMatchObject({ expression: "12" });
    expect(show("12+34BBBBB")).toMatchObject({ expression: "" });
  });

  it("removes a dot like any other character", () => {
    expect(show("1.5BB")).toMatchObject({ expression: "1" });
    expect(show("1.BB")).toMatchObject({ expression: "" });
  });

  it("does nothing on an empty calculator", () => {
    expect(getDisplay(pressKeys("B"))).toEqual(getDisplay(INITIAL_STATE));
  });

  it("clears everything on AC, including a pending expression", () => {
    expect(pressKeys("12+3C")).toEqual(INITIAL_STATE);
  });

  it("removes a continued negative operand entirely instead of leaving a lone minus", () => {
    expect(show("1-3=+B")).toMatchObject({ expression: "-2" });
    expect(show("1-3=+BB")).toMatchObject({ expression: "" });
  });

  it("removes a continued exponent result as one unit", () => {
    expect(show("1234567890123*1=+BB")).toMatchObject({ expression: "" });
    expect(show("1234567890123*1=+B5")).toMatchObject({ expression: "1.23456789012e+12" });
  });
});

describe("limits", () => {
  it("rejects a digit beyond the maximum digits of one number and says so", () => {
    const full = pressKeys("1".repeat(MAX_OPERAND_DIGITS));
    const rejected = pressKey(full, "1");

    expect(rejected.operands).toEqual(full.operands);
    expect(rejected.notice).toBe(TOO_MANY_DIGITS_NOTICE);
  });

  it("counts digits but not the dot", () => {
    const full = pressKeys(`0.${"1".repeat(MAX_OPERAND_DIGITS - 1)}`);

    expect(pressKey(full, "1").notice).toBe(TOO_MANY_DIGITS_NOTICE);
    expect(pressKey(full, ".").notice).toBeNull();
  });

  it("clears the notice on the next accepted key", () => {
    const rejected = pressKey(pressKeys("1".repeat(MAX_OPERAND_DIGITS)), "1");

    expect(rejected.notice).not.toBeNull();
    expect(pressKey(rejected, "+").notice).toBeNull();
  });

  it("evaluates more than 20 operands without an arbitrary expression limit", () => {
    expect(show("1+".repeat(20) + "1=")).toMatchObject({ result: "21" });
  });
});

describe("parseKeyboardKey", () => {
  it.each([
    ["0", "0"],
    ["9", "9"],
    [".", "."],
    ["+", "+"],
    ["-", "-"],
    ["*", "*"],
    ["/", "/"],
    ["=", "="],
    ["Enter", "="],
    ["Backspace", "backspace"],
    ["Escape", "clear"],
  ])("maps %s to %s", (eventKey, expected) => {
    expect(parseKeyboardKey(eventKey)).toBe(expected);
  });

  it.each(["a", " ", "Tab", "x", "×", "Delete", "10", "constructor"])("ignores %s", (eventKey) => {
    expect(parseKeyboardKey(eventKey)).toBeNull();
  });
});

function show(sequence: string) {
  return getDisplay(pressKeys(sequence));
}

function pressKeys(sequence: string): CalculatorState {
  return [...sequence].reduce(
    (state, character) => pressKey(state, toKey(character)),
    INITIAL_STATE,
  );
}

function toKey(character: string): CalculatorKey {
  if (character === "B") return "backspace";
  if (character === "C") return "clear";

  return character as CalculatorKey;
}
