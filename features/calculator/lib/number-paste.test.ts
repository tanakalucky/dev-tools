import { describe, expect, it } from "vitest";
import {
  INITIAL_STATE,
  INVALID_PASTE_NOTICE,
  TOO_MANY_DIGITS_NOTICE,
  getDisplay,
  parsePastedNumber,
  pasteNumber,
  pressKey,
  type CalculatorKey,
  type CalculatorState,
} from "./calculator-state";
import {
  INITIAL_SESSION,
  parseHistory,
  reduceSession,
  serializeHistory,
} from "./calculator-history";

function enter(sequence: string, state: CalculatorState = INITIAL_STATE) {
  return [...sequence].reduce((current, key) => pressKey(current, key as CalculatorKey), state);
}

describe("number paste validation (AAA)", () => {
  it.each([
    ["1,234.5", "1234.5"],
    [" -1,234.50 \n", "-1234.50"],
    ["+12", "12"],
    [".5", "0.5"],
    ["-.5", "-0.5"],
    ["5.", "5."],
    ["0007.20", "7.20"],
    ["-000", "-0"],
    ["1,234,567", "1234567"],
    ["0", "0"],
    ["\u00a0123\u00a0", "123"],
  ])("accepts one decimal number %s", (input, expected) => {
    // Arrange / Act
    const parsed = parsePastedNumber(input!);
    // Assert
    expect(parsed).toEqual({ value: expected, notice: null });
  });

  it.each([
    "",
    " ",
    ".",
    "-",
    "1+2",
    "1 × 2",
    "(1)",
    "1,23",
    "1234,567",
    "1,,234",
    "1,234,56",
    "1.234,56",
    "1 234",
    "1\n234",
    "1.2.3",
    "1_000",
    "1e3",
    "1e309",
    "NaN",
    "Infinity",
    "-Infinity",
    "0xFF",
    "１２３",
    "−123",
    "$123",
    "123px",
    "=123",
  ])("rejects malformed or non-decimal input %s", (input) => {
    // Arrange / Act
    const parsed = parsePastedNumber(input);
    // Assert
    expect(parsed).toEqual({ value: null, notice: INVALID_PASTE_NOTICE });
  });

  it("enforces the same stored 40-digit limit without rounding", () => {
    // Arrange
    const exact = "1234567890123456789012345678901234567890";
    // Act / Assert
    expect(parsePastedNumber(exact)).toEqual({ value: exact, notice: null });
    expect(parsePastedNumber(exact + "1")).toEqual({ value: null, notice: TOO_MANY_DIGITS_NOTICE });
    expect(parsePastedNumber("0." + "1".repeat(39)).value).not.toBeNull();
    expect(parsePastedNumber("0." + "1".repeat(40)).notice).toBe(TOO_MANY_DIGITS_NOTICE);
    expect(parsePastedNumber("0".repeat(45) + "1").value).toBe("1");
  });
});

describe("operand paste transitions (AAA)", () => {
  it.each([
    ["", "7", "7"],
    ["12+34", "-7.5", "12 ＋ -7.5"],
    ["12+", "-.5", "12 ＋ -0.5"],
    ["1+2=", "9", "9"],
    ["5/0=", "9", "9"],
  ])("replaces at boundary %s", (sequence, text, expression) => {
    // Arrange
    const original = enter(sequence!);
    // Act
    const pasted = pasteNumber(original, text!);
    // Assert
    expect(getDisplay(pasted).expression).toBe(expression);
    expect(pasted.outcome).toBeNull();
    expect(pasted.notice).toBeNull();
  });

  it.each(["12+34", "1/3=", "5/0=", "1/3=*"])(
    "preserves all calculation data when rejecting in %s",
    (sequence) => {
      // Arrange
      const original = enter(sequence);
      // Act
      const rejected = pasteNumber(original, "1+2");
      const tooLong = pasteNumber(original, "9".repeat(41));
      // Assert
      expect(rejected).toEqual({ ...original, notice: INVALID_PASTE_NOTICE });
      expect(tooLong).toEqual({ ...original, notice: TOO_MANY_DIGITS_NOTICE });
    },
  );

  it("continues typing and backspacing a pasted negative number naturally", () => {
    // Arrange
    const pasted = pasteNumber(INITIAL_STATE, "-0");
    // Act
    const typed = enter("07.5", pasted);
    const backspaced = pressKey(typed, "backspace");
    const completed = enter("*2=", backspaced);
    // Assert
    expect(getDisplay(typed).result).toBe("-7.5");
    expect(getDisplay(backspaced).result).toBe("-7.");
    expect(getDisplay(completed).result).toBe("-14");
  });

  it("preserves a carried raw value when pasting the next operand, and clears it when replacing the carry", () => {
    // Arrange
    const pending = enter("1/3=*");
    // Act
    const nextOperand = pasteNumber(pending, "3");
    const replacedCarry = pasteNumber(pressKey(pending, "backspace"), "2");
    // Assert
    expect(nextOperand.carryDisplay).toBe("0.333333333333");
    expect(getDisplay(pressKey(nextOperand, "=")).result).toBe("1");
    expect(replacedCarry.carryDisplay).toBeNull();
    expect(getDisplay(enter("*3=", replacedCarry)).result).toBe("6");
  });

  it("keeps all 40 digits for subsequent calculation", () => {
    // Arrange
    const original = pasteNumber(INITIAL_STATE, "1234567890123456789012345678901234567890");
    // Act
    const next = pasteNumber(pressKey(original, "-"), "1234567890123456789012345678901234567889");
    // Assert
    expect(getDisplay(pressKey(next, "=")).result).toBe("1");
  });

  it("never evaluates or adds history until equals is explicitly pressed", () => {
    // Arrange
    let session = reduceSession(INITIAL_SESSION, { type: "load", history: [] });
    session = reduceSession(session, { type: "press", key: "1", id: "first" });
    session = reduceSession(session, { type: "press", key: "+", id: "operator" });
    // Act
    const pasted = reduceSession(session, { type: "paste", text: "2" });
    const completed = reduceSession(pasted, { type: "press", key: "=", id: "done" });
    const replacedResult = reduceSession(completed, { type: "paste", text: "9" });
    // Assert
    expect(pasted.history).toBe(session.history);
    expect(pasted.calculator.outcome).toBeNull();
    expect(completed.history).toHaveLength(1);
    expect(replacedResult.history).toBe(completed.history);
    expect(parseHistory(serializeHistory(completed.history))).toEqual(completed.history);
    expect(reduceSession(INITIAL_SESSION, { type: "paste", text: "2" })).toBe(INITIAL_SESSION);
  });
});
