# 配布資料の取り込み記録

取り込み日: 2026-09-07。出典: [夢祭遙「魔導戦記カードゲーム」](https://note.com/dreamfv/n/nb58307ec682c)。ユーザー指定のDownloads内ファイルをコピーし、元ファイルは変更していません。

## 原本と役割

| 原本 | 配布ページ上の版 | 内容・確認結果 | ローカル保存先 |
|---|---|---|---|
| MadoRule.pdf | 第2版 | 14ページ。表紙、共通ルール、キャラクター背景、補足。本文の日付は2012-06-26 | [ルールPDF](original/second-edition/MadoRule.pdf) |
| Summary.pdf | 第2版 | 1ページ。同じ手順サマリーを4面付け | [サマリーPDF](original/second-edition/Summary.pdf) |
| CardAll.pdf | 第2版 | 25ページ。行動カードの印刷用シート | [カードPDF](original/second-edition/CardAll.pdf) |
| Character(A4).pdf | 第2版 | 7ページ。キャラクターシート | [キャラクターPDF](original/second-edition/Character(A4).pdf) |
| 魔導戦記1 3rd Ed ルームデータ.zip | 3rd Ed. | ユドナリウム用のルームスナップショット | [ルームZIP](original/third-edition/madou-senki-3rd-room.zip) |

ZIPは44,728,687バイト、展開内容は82,539,110バイト。XML 3個とJPEG 218個、合計221ファイルです。SHA-256と個別サイズは [manifest.json](manifest.json) に保存しました。ZIPの圧縮解除はCRC検証を伴い、全ファイルのハッシュも検証しています。

## 展開結果

`extracted/udonarium-3rd/` に元のファイル名のまま展開しています。

| 区分 | 個数 | 注意点 |
|---|---:|---|
| キャラクター山 (`stack-1`) | 24枚、表面24画像 | カードの中身は画像。XML上の名称は「カード」 |
| 行動カード山 (`stack-2`) | 219枚、表面183画像 | 同じ表面画像を参照する複製がある |
| 山の外の変身カード | 2枚 | 破壊神ヴァンミール、聖騎士ランスロット2 |
| 全カードオブジェクト | 245枚、表面209画像 | 公式の構成枚数を検証した値ではなく、保存状態の実測 |
| `character` オブジェクト | 14個 | ダメージカウンターやサンプルのモンスター等。ゲームのキャラクター14人という意味ではない |
| 卓マスク / ダイス | 4個 / 2個 | レイアウト、ユドナリウム組み込み素材を含む |

第2版ルール記載の行動カードは220枚です。3rd Ed.の219枚を「1枚欠落」と断定せず、版変更か保存状態の違いかを正規デッキリストで確認します。ダメージカウンターには0以外の値もあるため、ルームを初期ゲーム状態として取り込むこともしません。

全カードの表裏画像はZIP内で解決できました。ダイス・サンプルキャラクター等の組み込み画像識別子13種類はZIP内にありません。[実測サマリー](catalog/room-summary.json) に列挙しています。カード素材の欠損ではありません。

## 再利用用の索引

- [card-instances.json](catalog/card-instances.json): 245枚それぞれの表裏、所属する山、元の順序・配置属性。
- [card-fronts.json](catalog/card-fronts.json): 表面209画像単位の集約、複製数、転記状態。
- [pdf-metadata.json](catalog/pdf-metadata.json): ページ数とテキスト抽出品質。
- [preview.html](catalog/preview.html): 原寸画像にリンクするカード一覧。ローカル生成。
- `text/second-edition/*.txt`: `pdftotext -layout` の未加工出力。改ページ文字を保持。

**索引は実行可能なカード定義ではありません。** XMLは効果テキストを持たず、大部分の名称も汎用名です。画像の目視・OCR・校正を経て、別途名前、属性、効果、発動タイミング、枚数を構造化します。画像ハッシュは素材ID、将来の `cardDefinitionId` は版を含む意味上のIDとし、区別します。

`CardAll.pdf` と `Character(A4).pdf` の抽出テキストにはフォント対応由来とみられる文字化けがあり、自動変換には使えません。PDF自体の表示は正常です。`MadoRule.pdf` は概ね読めますが2段組みなので、段落の順序はPDF画像と照合します。調査ではルールp.5-6、カードp.1、キャラクターp.7をレンダリングして確認しました。

## 再生成と検証

```bash
python3 scripts/import_resources.py --source-dir /Users/chinju/Downloads
python3 scripts/import_resources.py --verify
```

ZIPの名前はUnicode正規化後に照合します。展開先外へのパス、シンボリックリンク、重複エントリを拒否します。異なる原本・変更済み展開ファイルは上書きせず停止します。新しい版を受け取った場合は別ディレクトリで管理してください。

`original/`、`extracted/`、`text/`、生成した `preview.html` はGit管理外です。原本を含めたサービス公開時の素材配信範囲・クレジットは、配布者の利用条件を確認して決めます。配布ページで確認できたのはPDFとユドナリウム用ZIPの公開で、オンラインサービスへの再配布条件は明記されていません。
