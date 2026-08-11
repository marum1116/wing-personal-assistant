# wing-personal-assistant

Cloudflare Workers 上で動かす「羽魂メモ」Bot バックエンドの最小 TypeScript プロジェクトです。  
この段階では LINE API / OpenAI API / Supabase にはまだ接続していません。

## 現在の構成

- ランタイム: Cloudflare Workers
- 言語: TypeScript
- 開発ツール: Wrangler
- Worker 名: `wing-personal-assistant`

### エンドポイント

- `GET /` -> `wing-personal-assistant is running`
- `POST /webhook` -> LINE Webhook受信・署名検証・テキスト自動返信

## セットアップ

```bash
npm install
```

## ローカル起動

```bash
npm run dev
```

起動後の確認例:

```bash
curl http://127.0.0.1:8787/
curl -X POST http://127.0.0.1:8787/webhook
```

## 必要なSecrets名

- `LINE_CHANNEL_SECRET`
- `LINE_CHANNEL_ACCESS_TOKEN`

ローカルでの設定例（値そのものは記載しない）:

`.dev.vars` に上記2つのキーを設定する。

## 動作確認手順

1. `.dev.vars` に必要な Secrets を設定する
2. `npm run dev` で Worker を起動する
3. LINE Developers Console の Webhook URL を `<公開URL>/webhook` に設定する
4. Webhook 検証を実行し、200 が返ることを確認する
5. LINE公式アカウントへテキスト送信し、「受け取りました：<本文>」が返信されることを確認する

## 秘密情報の扱い

- Channel secret / Channel access token などの秘密情報はコードに直接書かない
- ローカル変数は `.dev.vars` を使用可能
- `.dev.vars` は `.gitignore` に含めてあり、GitHub にコミットされません
