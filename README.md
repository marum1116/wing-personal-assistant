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
- `POST /webhook` -> `OK` (HTTP 200)

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

## 秘密情報の扱い

- Channel secret / Channel access token などの秘密情報はコードに直接書かない
- ローカル変数は `.dev.vars` を使用可能
- `.dev.vars` は `.gitignore` に含めてあり、GitHub にコミットされません
