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

## 展開・公開について (Deployment)

このリポジトリは、Webアプリケーションとして公開するためのソースコードです。
Vercel、Cloudflare Pages、Firebase HostingなどのホスティングサービスとこのGitHubリポジトリを連携させることで、自動的にインターネット上にWebアプリとして公開されます。

- 接続されたホスティングサービスは自動的に `npm run build` を実行し、生成されたファイルを配信します。
- Firebaseの接続設定やセキュリティルールはすでに組み込まれているため、デプロイするだけでそのまま動作し、ユーザーごとのデータも安全に分離されます。

### 広告収入（AdSense）の導入について
運用コスト（課金）を相殺したり収益化を図るために、Webアプリ内にGoogle AdSenseなどの広告を埋め込むことが可能です。
ReactアプリへのAdSense導入は、`public/index.html` の `<head>` 内に広告タグを追加するか、専用のReactコンポーネントを作成してレイアウトに組み込むことで実現できます。

## ライセンス (License)

MIT License
