import { JsonTool } from "../../features/json/components/json-tool";

export const metadata = {
  title: "JSON フォーマッター - dev-tools",
  description: "ブラウザ内だけで JSON の整形、最小化、検証を行います。",
};

export default function JsonPage() {
  return (
    <main className="page page-wide">
      <header>
        <p className="breadcrumb">
          <a href="/">dev-tools</a>
        </p>
        <h1>JSON フォーマッター</h1>
        <p className="lede">
          JSON の整形、最小化、検証を行います。データはこのブラウザタブの外に出ません。
        </p>
      </header>

      <JsonTool />
    </main>
  );
}
