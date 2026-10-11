export type FormatJsonResult = { ok: true; formatted: string } | { ok: false; message: string };

type ParseResult = { ok: true; value: unknown } | { ok: false; message: string };

const INDENT_SPACES = 2;

export function formatJson(input: string): FormatJsonResult {
  const ordinary = parseJson(input);

  if (ordinary.ok) {
    return { ok: true, formatted: stringifyJson(ordinary.value) };
  }

  const unescaped = removeTerminalQuoteEscapes(input);

  if (unescaped !== null) {
    const repaired = parseJson(unescaped);

    if (repaired.ok) {
      return { ok: true, formatted: stringifyJson(repaired.value) };
    }
  }

  // 利用者が貼り付けた入力に対応するエラーを返すため、常に元の入力のエラーを使う。
  return { ok: false, message: ordinary.message };
}

function parseJson(text: string): ParseResult {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}

function stringifyJson(value: unknown): string {
  return JSON.stringify(value, null, INDENT_SPACES);
}

/**
 * ターミナル表示由来の形(元の `"` がすべて `\"` になったもの)だけを対象に、
 * 各 `"` の直前のバックスラッシュを 1 つだけ取り除く。
 * 対象外(引用符が無い、またはバックスラッシュの付かない `"` がある)なら null。
 */
function removeTerminalQuoteEscapes(text: string): string | null {
  const firstCharacter = text.trimStart()[0];
  const hasQuote = text.includes('"');
  const hasUnescapedQuote = /(^|[^\\])"/.test(text);

  if ((firstCharacter !== "{" && firstCharacter !== "[") || !hasQuote || hasUnescapedQuote) {
    return null;
  }

  return text.replace(/\\"/g, '"');
}
