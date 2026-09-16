# スマート請求書作成アプリ (Smart Invoice Generator)

React と Firebase を利用して構築された、モバイル対応の請求書作成・管理アプリケーションです。

## 特徴 (Features)

- 📱 **レスポンシブデザイン**: PCでもスマートフォンでも快適に操作できる最適化されたUI。
- ☁️ **クラウド同期**: Firebase (Firestore & Auth) を利用し、データはクラウド上に安全に保存・同期されます。
- 🏢 **自社プロファイル管理**: 複数の自社情報（メイン、副業など）を登録し、ワンクリックで切り替え可能。
- 🤝 **請求先（クライアント）管理**: 頻繁に利用する取引先の情報を保存し、フォームへ簡単に呼び出せます。
- 📄 **PDF / JPG エクスポート**: 美しいA4フォーマットで請求書をプレビューし、PDFやJPG形式でダウンロード可能。
- 🔐 **セキュアな認証**: Google アカウントを利用した安全なログイン（ユーザーごとのデータ分離対応）。

## 使用技術 (Tech Stack)

- **Frontend**: React 19, TypeScript, Vite
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Export**: `html-to-image` (JPG), `jspdf` (PDF)
- **Backend / BaaS**: Firebase (Authentication, Firestore)

## Webサイトとしての公開方法 (Hosting & Deployment)

このアプリは、**Vercel** または **GitHub Pages** を使って、完全無料で簡単にWebアプリとして公開できます。

### 方法1: Vercel で公開する場合（★一番おすすめ・設定不要で一番簡単）
React/Vite アプリケーションを最もトラブルなく、高速に公開できる公式推奨の方法です。
1. [Vercel](https://vercel.com/) にアクセスし、「Continue with GitHub」でログインします（無料）。
2. ダッシュボードの「Add New...」→「Project」をクリックします。
3. このリポジトリ（`invoice-generator`）が表示されるので、「Import」をクリックします。
4. 設定項目は変更せず、そのまま「Deploy」ボタンを押します。
5. 30秒ほどでビルドが完了し、世界中からアクセスできる公開URL（例: `https://your-invoice-app.vercel.app`）が発行されます！

### 方法2: GitHub Pages で公開する場合
1. GitHub のリポジトリページで、上部の **「Actions」** タブを開きます。
2. 検索バーに「**Vite**」または「**Static HTML**」と入力し、推奨されたワークフローの「Configure」を押してコミットします。
3. リポジトリの **「Settings」** → **「Pages」** で Source を **「GitHub Actions」** に指定します。

---

### ⚠️ 公開後の重要設定: Firebase の「承認済みドメイン」への追加
Webサイトが公開されたら、Googleログインを有効にするために以下の設定を1度だけ行ってください：
1. [Firebase Console](https://console.firebase.google.com/) を開きます。
2. 左メニュー「Authentication（認証）」→「Settings（設定）」タブを開きます。
3. 「承認済みドメイン（Authorized domains）」の「ドメインを追加」をクリックします。
4. 発行されたURLのドメイン部分（例: `xxx.vercel.app` や `ユーザー名.github.io`）を入力して保存します。
※ これを行わないと、サイトは表示されてもGoogleログイン時にエラーが発生します。

### 広告収入（AdSense）の導入について
運用コスト（課金）を相殺したり収益化を図るために、Webアプリ内にGoogle AdSenseなどの広告を埋め込むことが可能です。
ReactアプリへのAdSense導入は、`public/index.html` の `<head>` 内に広告タグを追加するか、専用のReactコンポーネントを作成してレイアウトに組み込むことで実現できます。

## ライセンス (License)

MIT License
