# 魔導戦記オンライン

卓を作り、参加・招待して複数人で遊べるブラウザ版の準備リポジトリです。デプロイ先は Cloudflare を想定しています。配布資料に合わせ、文書内のゲーム名は「魔導戦記」と表記します。

現在は **2ndの全カード仕様案・割り込み裁定案・実装計画まで**。ゲーム本体とデプロイ設定はまだ作成していません。

## 最初に読む文書

1. [資料一覧と展開手順](resources/README.md)
2. [2nd全カード・能力仕様、裁定案、対戦例](docs/rules/second-edition/README.md)
3. [Cloudflare構成とオンライン対戦の設計案](docs/superpowers/specs/2026-09-07-online-game-design.md)
4. [段階別の実装計画](docs/superpowers/plans/2026-09-07-online-game.md)

推奨構成は **1卓につき1 Durable Object + WebSocket + 永続化**。操作や期限イベントを受けたときにゲームを進め、参加者の判断を待つ間は休止できます。ホストのブラウザをゲームサーバーにしません。

初回はユーザーの選択により **2nd Edition** を採用します。行動220枚・人物26枚・110能力を目視照合し、補完裁定案と32件の対戦例を作成しました。補完裁定は2026-09-08に試作の基準として暫定採用しました。[版の決定](docs/rules/selected-ruleset.md)と[初期調査](docs/rules/analysis.md)も参照できます。

## ローカル資料

原本5点とZIPの展開ファイルは `resources/` に取り込み済みです。バイナリ原本・展開画像・抽出テキストはローカル保持とし `.gitignore` に指定しています。Gitには出典、SHA-256、素材索引、手順、設計文書を残せます。別のチェックアウトでは次のコマンドで再生成します。

```bash
python3 scripts/import_resources.py --source-dir /Users/chinju/Downloads
python3 scripts/import_resources.py --verify
python3 scripts/validate_second_edition.py --write-report
```

Python 3.10以上とPopplerの `pdfinfo` / `pdftotext` が必要です。原本を変更せず、既存の異なる内容への上書きも拒否します。

[3rd Ed.のカード画像一覧](resources/catalog/preview.html) はローカル生成ファイルです。209種類の表面画像を、保存された卓内の複製枚数とともに確認できます。
