# 2ndカード画像の生成

必要な原本は `resources/original/second-edition/CardAll.pdf` と `Character(A4).pdf`。原本の取り込みは [資料手順](../../resources/README.md)を参照。

Popplerの`pdftoppm`と、`scripts/requirements-assets.txt`のPillowを用いる。現在検証した環境はPoppler26.03.0、Pillow12.1.1、libwebp1.6.0。エンコーダ更新によりファイルのバイト列が変わる可能性があるので、マニフェストへ生成環境と原本・画像双方のSHA-256を記録する。

```bash
pnpm prepare:assets
pnpm verify:assets
pnpm test:assets
```

`apps/web/public/cards/second/`へ、行動220枚と人物26枚を物理ID名のlossless WebPで生成する。3rdのJPEGは使用しない。余白を各セル内で除去し印刷枠を残す。生成物はGit対象外。原本PDF自体は配信ディレクトリにコピーしない。

検査は期待する246枚、出典PDF集合、出典ページ・行・列、画像URL、画像内容のハッシュと寸法を照合する。追加の古いWebPがあると生成・検査を拒否する。他用途のファイルを自動削除しないため、その場合は新しい出力ディレクトリを選ぶか、不要な生成物を確認して除去する。

カード画像は拡大確認用として使い、ゲームの操作・条件説明・ログはHTMLの文字でも提供する。画像を表示できない場合も、カード名と効果説明を読めるようにする。

## 配信前の確認記録

2026-09-08に[作者の配布ページ](https://note.com/dreamfv/n/nb58307ec682c)を再確認。2nd PDFと3rdルームデータの配布を確認した。ページ本文には、この専用アプリでの画像再配信条件を明示した記載は見つからなかった。ローカル生成・検証は実施済み。公開先と配信条件の確認は実装計画Task8で追跡し、許諾取得済みとは扱わない。作者への連絡は行っていない。
