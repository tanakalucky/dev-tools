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
        <p className="text-muted-foreground">開発中</p>
      </section>
    </main>
  );
}
