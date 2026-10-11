# character-count

テキストの文字数を数えるツール。ルートは `/character-count`(`app/character-count/page.tsx`)。入力はブラウザ内だけで処理し、送信・保存・追跡はしない。

## できること

- 入力した文字数を、入力と同時に 1 つの大きな数字で表示する(ボタン操作は不要)。

文字数以外の指標、履歴、永続化、ファイル入力、コピー、クリアは扱わない。

## 構成

- `lib/count-characters.ts` - 純粋な数え上げ `countCharacters(text)`(React / DOM に依存しない)。テストは隣の `count-characters.test.ts`。
- `components/character-count.tsx` - 画面(Client Component)。shadcn の `Textarea` を使う。

## 数え方

- 標準の `Intl.Segmenter`(既定の grapheme 単位)で区切り、見た目の 1 文字を 1 と数える。追加パッケージや独自の Unicode 互換処理は持たない。実行環境の `Intl.Segmenter` と結果が異なる特殊な文字列があっても許容する。
- 改行(LF・CRLF・CR)の区切りは数えない。
- ASCII スペース、全角スペース、タブは数える。
