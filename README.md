# WordPress コンテンツ移行用スクリプト群

WordPress から Gatsby に移行するにあたって、使用したスクリプト群です。

## WordPress 記事ダンプ

`wp_posts.sql` を phpMyAdmin などから MySQL に対して実行して、結果を YAML でエクスポートします。
（結果セットが `wp_posts.yml`）

## Markdown 変換

※ 事前に `lib/name-translation.js` でユーザー名をマッピングしておく必要があります
※ ドメイン名をハードコーディングしているので MSeeeeN 以外では `lib/index.js` 内の数カ所を修正する必要があります

`wp_posts.yml` から Markdown ファイルに変換します。メタデータは frontmatter に転記されます。

```
node index.js
```

`result` ディレクトリに Markdown に変換した結果が入ります。

記事中の画像をダウンロードする場合は `--include-images` オプションをつけます。
各記事 slug の `images` ディレクトリに画像が slug-番号 形式で格納されます。


## 画像縮小・最適化

イメージライブラリ sharp を使って、大きな解像度や圧縮率の低い画像を縮小・圧縮します。

下記のように実行してディレクトリ配下の画像ファイルを再帰的に処理します。

```
node optimize-images.js ディレクトリ
```

png と jpg 両方に圧縮してみて圧縮率の低いほうを採用します。操作前のほうがサイズが小さい場合はなにもしません。

オリジナルのファイルは `.org` という拡張子で保持されます。

`*.org` から元に戻すスクリプトもあります。

```
node recover-images.js ディレクトリ
```
