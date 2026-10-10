import { JsonTool } from "../../features/json/components/json-tool";

export const metadata = {
  title: "JSON フォーマッター - dev-tools",
  description: "ブラウザ内だけで JSON の整形、最小化、検証を行います。",
};

export default function JsonPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <header>
        <p className="mt-0 mb-2 text-sm">
          <a href="/" className="underline">
            dev-tools
          </a>
        </p>
        <h1 className="m-0 text-[1.75rem]">JSON フォーマッター</h1>
        <p className="mt-1 mb-0 text-muted-foreground">
          JSON の整形、最小化、検証を行います。データはこのブラウザタブの外に出ません。
        </p>
      </header>

      <JsonTool />
    </main>
  );
}
