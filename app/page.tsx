export default function HomePage() {
  return (
    <main className="mx-auto max-w-176 px-4 py-8">
      <header>
        <h1 className="m-0 text-[1.75rem]">dev-tools</h1>
        <p className="mt-1 mb-0 text-muted-foreground">
          ブラウザだけで動く開発者向けユーティリティ。
        </p>
      </header>

      <section aria-labelledby="tools-heading">
        <h2 id="tools-heading" className="mt-8 mb-3 text-lg">
          ツール
        </h2>
        <ul className="m-0 list-none p-0">
          <li className="rounded-lg border px-4 py-3.5">
            <a href="/json" className="underline">
              JSON フォーマッター
            </a>
            <p className="mt-1 mb-0 text-muted-foreground">
              JSON を 2 スペースで整形、最小化、検証します。重複キーは警告します。
            </p>
          </li>
        </ul>
      </section>
    </main>
  );
}
