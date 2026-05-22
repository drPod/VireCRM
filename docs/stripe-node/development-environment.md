# 開発環境を設定する

Stripe CLI とサーバー側 SDK についての理解を深めましょう。

[ノーコードに関するドキュメント](https://docs.stripe.com/no-code.md)をご覧になるか、パートナーディレクトリーの[構築済みのソリューション](https://stripe.com/partners/directory)を使用するか、[Stripe 認定エキスパート](https://stripe.com/partners/directory?t=Consulting)を雇用してください。

Stripe のサーバー側 SDK およびコマンドラインインターフェイス (CLI) を使用することで、Stripe の REST API とやり取りできます。Stripe CLI で API を呼び出し、開発環境を効率化しましょう。

SDK を使用して、定型コードを記述しないようにします。環境からのリクエストの送信を開始するには、クイックスタートガイドにならって使用できる言語を選択します。

> #### Chrome 拡張機能
> 
> Stripe ([Elements](https://docs.stripe.com/payments/elements.md) や [Checkout](https://docs.stripe.com/payments/checkout.md) など) を使用して、ご自身のウェブサイトで決済の実装を構築することをお勧めします。次に、Chrome 拡張機能を設定して、ユーザーが購入を完了する準備ができたら、この決済ページにユーザーを誘導します。
> 
> この方法は、拡張機能内で直接決済を処理しようとするよりも安全で保守が簡単です。

# Ruby

> This is a Ruby for when lang is ruby. View the full page at https://docs.stripe.com/get-started/development-environment?lang=ruby.

このクイックスタートでは、[Stripe CLI](https://docs.stripe.com/stripe-cli.md) (Stripe 統合へのコマンドラインアクセスを可能にする重要なツール) をインストールします。また、[Stripe Ruby サーバーサイド SDK](https://github.com/stripe/stripe-ruby) を使用して、Ruby で記述されたアプリケーションから Stripe API にアクセスします。

## 学習内容

このクイックスタートでは以下について説明します。

- コードを記述することなく Stripe API を呼び出す方法
- RubyGems で bundler を使用してサードパーティーの依存関係を管理する方法
- 最新の Stripe Ruby SDK v19.0.0 をインストールする方法
- 最初の SDK リクエストを送信する方法

## 初期セットアップ

まず、[Stripe アカウントを作成する](https://dashboard.stripe.com/register)か[サインイン](https://dashboard.stripe.com/login)します。

## Stripe CLI を設定する

まず、[Stripe アカウントを作成する](https://dashboard.stripe.com/register)か[サインイン](https://dashboard.stripe.com/login)します。

### インストール

コマンドラインから、インストールスクリプトを使用するか、オペレーティングシステムのバージョン管理されたアーカイブファイルをダウンロードして展開し、CLI をインストールします。

#### homebrew

[homebrew](https://brew.sh/) で Stripe CLI をインストールするには、以下を実行します。

```bash
brew install stripe/stripe-cli/stripe
```

このコマンドを Linux バージョンの Homebrew で実行すると失敗しますが、代替手段を使用するか、Linux タブの指示に従ってこれを完了させることは可能です。

```bash
brew install stripe-cli
```

#### apt

> CLI の Debian ビルドは JFrog(https://packages.stripe.dev,) で利用可能ですが、これは Stripe が所有するドメインではありません。この URL にアクセスすると、JFrog アーティファクトリーのリストにリダイレクトされます。

Debian および Ubuntu ベースのディストリビューションに Stripe CLI をインストールする方法は以下のとおりです。

1. Stripe CLI の GPG キーを apt ソースのキーリングに追加します。

```bash
curl -s https://packages.stripe.dev/api/security/keypair/stripe-cli-gpg/public | gpg --dearmor | sudo tee /usr/share/keyrings/stripe.gpg > /dev/null
```

1. CLI の apt リポジトリーを apt ソースリストに追加します。

```bash
echo "deb [signed-by=/usr/share/keyrings/stripe.gpg] https://packages.stripe.dev/stripe-cli-debian-local stable main" | sudo tee -a /etc/apt/sources.list.d/stripe.list
```

1. パッケージリストを更新します。

```bash
sudo apt update
```

1. CLI をインストールします。

```bash
sudo apt install stripe
```

#### yum

> CLI の RPM ビルドは JFrog(https://packages.stripe.dev,) で利用可能ですが、これは Stripe が所有するドメインではありません。この URL にアクセスすると、JFrog アーティファクトリーのリストにリダイレクトされます。

RPM ベースのディストリビューションに Stripe CLI をインストールする方法は以下のとおりです。

1. CLI の yum リポジトリーを yum ソースリストに追加します。

```bash
echo -e "[Stripe]\nname=stripe\nbaseurl=https://packages.stripe.dev/stripe-cli-rpm-local/\nenabled=1\ngpgcheck=0" >> /etc/yum.repos.d/stripe.repo
```

1. CLI をインストールします。

```bash
sudo yum install stripe
```

#### Scoop

[Scoop](https://scoop.sh/) で Stripe CLI をインストールするには、以下を実行します。

```bash
scoop bucket add stripe https://github.com/stripe/scoop-stripe-cli.git
```

```bash
scoop install stripe
```

#### macOS

homebrew なしで Stripe CLI を macOS にインストールする方法は以下のとおりです。

1. [GitHub](https://github.com/stripe/stripe-cli/releases/latest) から、ご使用の cpu アーキテクチャータイプの最新の `mac-os` tar.gz ファイルをダウンロードします。
1. `tar -xvf stripe_[X.X.X]_mac-os_[ARCH_TYPE].tar.gz` を使用して、ファイルを解凍します。

必要に応じて、グローバルに実行できる場所 (`/usr/local/bin` など) にバイナリをインストールします。

#### Linux

Package Manager なしで Stripe CLI を Linux にインストールする方法は以下のとおりです。

1. [GitHub](https://github.com/stripe/stripe-cli/releases/latest) から、最新の `linux` tar.gz ファイルをダウンロードします。
1. `tar -xvf stripe_X.X.X_linux_x86_64.tar.gz` を使用して、ファイルを解凍します。
1. `./stripe` を自身の実行パスに移動します。

#### Windows

Scoop なしで Stripe CLI を Windows にインストールする方法は、以下のとおりです。

1. [GitHub](https://github.com/stripe/stripe-cli/releases/latest) から、最新の `windows` zip ファイルをダウンロードします。
1. `stripe_X.X.X_windows_x86_64.zip` ファイルを解凍します。
1. 解凍した `stripe.exe` ファイルへのパスを `Path` 環境変数に追加します。環境変数の更新方法については、[Microsoft PowerShell のドキュメント](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_environment_variables?view=powershell-7.3#saving-changes-to-environment-variables)を参照してください。

> Windows のアンチウイルススキャナーは、Stripe CLI に「安全ではない」とフラグ付けすることがあります。これは偽陽性である可能性が高いです。詳細については、GitHub リポジトリの [issue #692](https://github.com/stripe/stripe-cli/issues/692) をご覧ください。

1. 解凍した `.exe` ファイルを実行します。

#### Docker

Stripe CLI は、[Docker イメージ](https://hub.docker.com/r/stripe/stripe-cli)としても使用できます。最新バージョンをインストールするには、以下を実行します。

```bash
docker run --rm -it stripe/stripe-cli:latest
```

### 認証

ログインして Stripe ユーザー[アカウント](https://docs.stripe.com/get-started/account/set-up.md)を認証すると、制限付きキーのセットを生成できます。詳細については、[Stripe CLI のキーと権限](https://docs.stripe.com/stripe-cli/keys.md)を参照してください。

```bash
  stripe login
```

キーボードの **Enter** キーを押して、ブラウザーでの認証プロセスを完了します。

```bash
Your pairing code is: enjoy-enough-outwit-win
This pairing code verifies your authentication with Stripe.
Press Enter to open the browser or visit https://dashboard.stripe.com/stripecli/confirm_auth?t=THQdJfL3x12udFkNorJL8OF1iFlN8Az1 (^C to quit)
```

### 設定を確定

CLI のインストールが完了し、[Create a product (商品作成) API](https://docs.stripe.com/api/products/create.md) への単一の API リクエストを作成できるようになりました。

#### bash

```bash
stripe products create \
--name="My First Product" \
--description="Created with the Stripe CLI"
```

レスポンスオブジェクトの `id` 内で商品 ID を探し、次のステップのために保存しておきます。

すべて正常に機能する場合、コマンドラインに以下のレスポンスが表示されます。

#### bash

```json
{
  "id": "prod_LTenIrmp8Q67sa", // ID は次のようになります。
  "object": "product",
  "active": true,
  "attributes": [],
  "created": 1668198126,
  "default_price": null,
  "description": "Created with the Stripe CLI",
  "identifiers": {},
  "images": [],
  "livemode": false,
  "metadata": {},
  "name": "My First Product",
  "package_dimensions": null,
  "price": null,
  "product_class": null,
  "shippable": null,
  "sku": "my-first-product-10",
  "statement_descriptor": null,
  "tax_code": null,
  "type": "service",
  "unit_label": null,
  "updated": 1668198126,
  "url": null
}
```

次に、[Create a price (価格作成) API](https://docs.stripe.com/api/prices/create.md) を呼び出して、30 USD の価格を関連付けます。`product` のプレースホルダーを商品 ID (例: `prod_LTenIrmp8Q67sa`) に入れ替えます。

#### bash

```bash
stripe prices create \
  --unit-amount=3000 \
  --currency=usd \
  --product="{{PRODUCT_ID}}"
```

すべて正常に機能する場合、コマンドラインに以下のレスポンスが表示されます。

#### bash

```json
{
  "id": "price_1KzlAMJJDeE9fu01WMJJr79o", // ID は次のようになります。
  "object": "price",
  "active": true,
  "billing_scheme": "per_unit",
  "created": 1652636348,
  "currency": "usd",
  "livemode": false,
  "lookup_key": null,
  "metadata": {},
  "nickname": null,
  "product": "prod_Lh9iTGZhb2mcBy",
  "recurring": null,
  "tax_behavior": "unspecified",
  "tiers_mode": null,
  "transform_quantity": null,
  "type": "one_time",
  "unit_amount": 3000,
  "unit_amount_decimal": "3000"
}
```

## サードパーティーの依存関係を管理する

サードパーティーの依存関係の管理には、[RubyGems](http://rubygems.org/) コマンドラインツールを使用することをお勧めします。RubyGems を使用すると、新規ライブラリを追加し、Ruby プロジェクトに含めることができます。以下のコマンドを実行して、RubyGems がインストールされているかどうかを確認してください。

### RubyGems をインストールする

#### RubyGems をインストールする

```bash
gem --version
```

`gem: command not found` と返される場合は、ダウンロードページから [RubyGems をダウンロード](http://rubygems.org/pages/download)してください。

## Ruby のサーバー側 SDK をインストールする

最新バージョンの Stripe Ruby サーバー側 SDK は、v19.0.0 です。Ruby バージョン 2.3 以降をサポートします。

Ruby バージョンを確認する

```bash
ruby -v
```

### ライブラリをインストールする

[gem ファイルを作成](https://guides.rubygems.org/make-your-own-gem/)し、[RubyGems](https://rubygems.org/) で bundler を使用して、生成された gem をインストールします。

最新バージョンの [Stripe gem](https://rubygems.org/gems/stripe) をプロジェクトに追加します。

```bash
bundle add stripe
```

必要な gem を指定されたソースからインストールします。

```bash
bundle install
```

### インストールの代替手段

**依存関係として追加**: 最新バージョンのライブラリを gem 依存関係として追加します。

```ruby
source 'https://rubygems.org'

gem 'rails'
gem 'stripe'
```

**グローバルなインストール**: [RubyGems](https://rubygems.org/) を使用してグローバルにライブラリをインストールします。

```bash
gem install stripe
```

**手動インストール**: [ソースから gem を構築](https://github.com/stripe/stripe-ruby)し、以下を実行してライブラリをインストールします。

```bash
gem build stripe.gemspec
```

## 最初の SDK リクエストを実行する

これで、Ruby SDK がインストールされ、サブスクリプションの [Product (商品)](https://docs.stripe.com/api/products/create.md) を作成し、いくつかの API リクエストに [Price (価格)](https://docs.stripe.com/api/prices/create.md) を関連付けられるようになりました。この例では、Product のレスポンスで返された商品 ID を使用して価格を作成しています。

> #### API キーのベストプラクティス
> 
> このサンプルでは、*サンドボックス* (A sandbox is an isolated test environment that allows you to test Stripe functionality in your account without affecting your live integration. Use sandboxes to safely experiment with new features and changes)環境で、Stripe ユーザー[アカウント](https://docs.stripe.com/get-started/account/set-up.md)のデフォルトキーを使用します。これらの値を表示できるのはお客様のみです。キーを安全に管理するため、[ベストプラクティス](https://docs.stripe.com/keys-best-practices.md)に従ってください。

#### 商品と価格を作成する

```ruby
require 'rubygems'
require 'stripe'

# Don't embed any keys in production code. This is an example.
# See https://docs.stripe.com/keys-best-practices.
client = Stripe::StripeClient.new("sk_test_09l3shTSTKHYCzzZZsiLl2vA")

starter_subscription = client.v1.products.create(
  name: 'Starter Subscription',
  description: '$12/Month subscription',
)

starter_subscription_price = client.v1.prices.create(
  currency: 'usd',
  unit_amount: 1200,
  recurring: {interval: 'month'},
  product: starter_subscription['id'],
)

puts "Success! Here is your starter subscription product id: #{starter_subscription.id}"
puts "Success! Here is your starter subscription price id: #{starter_subscription_price.id}"
```

ファイルを `create_price.rb` という名前で保存します。コマンドラインから、保存したファイルが含まれるディレクトリーに `cd` で移動し、以下のコマンドを実行します。

#### create_price.rb

```bash
ruby create_price.rb
```

すべて正常に機能する場合、コマンドラインに以下のレスポンスが表示されます。実装を構築する際に使用できるように、これらの ID を保存します。

#### bash

```bash
Success! Here is your starter subscription product id: prod_0KxBDl589O8KAxCG1alJgiA6
Success! Here is your starter subscription price id: price_0KxBDm589O8KAxCGMgG7scjb
```

## See also

クイックスタートは以上です。以下のリンクでは、作成した商品の支払いを処理する方法をいくつか紹介しています。

- [決済用のリンクを作成する](https://docs.stripe.com/payment-links.md)
- [Stripe がオンラインで提供するページ](https://docs.stripe.com/checkout/quickstart.md)
- [高度な連携](https://docs.stripe.com/payments/quickstart-checkout-sessions.md)


# Python

> This is a Python for when lang is python. View the full page at https://docs.stripe.com/get-started/development-environment?lang=python.

このクイックスタートでは、[Stripe CLI](https://docs.stripe.com/stripe-cli.md) (Stripe 統合へのコマンドラインアクセスを可能にする重要なツール) をインストールします。また、[Stripe Python サーバーサイド SDK](https://github.com/stripe/stripe-python) を使用して、Python で記述されたアプリケーションから Stripe API にアクセスします。

## 学習内容

このクイックスタートでは以下について説明します。

- コードを記述することなく Stripe API を呼び出す方法
- 仮想環境と pip パッケージマネージャーを使用してサードパーティーの依存関係を管理する方法
- 最新の Stripe Python SDK v15.0.0 をインストールする方法
- 最初の SDK リクエストを送信する方法

## 初期セットアップ

まず、[Stripe アカウントを作成する](https://dashboard.stripe.com/register)か[サインイン](https://dashboard.stripe.com/login)します。

## Stripe CLI を設定する

### インストール

コマンドラインから、インストールスクリプトを使用するか、オペレーティングシステムのバージョン管理されたアーカイブファイルをダウンロードして展開し、CLI をインストールします。

#### homebrew

[homebrew](https://brew.sh/) で Stripe CLI をインストールするには、以下を実行します。

```bash
brew install stripe/stripe-cli/stripe
```

このコマンドを Linux バージョンの Homebrew で実行すると失敗しますが、代替手段を使用するか、Linux タブの指示に従ってこれを完了させることは可能です。

```bash
brew install stripe-cli
```

#### apt

> CLI の Debian ビルドは JFrog(https://packages.stripe.dev,) で利用可能ですが、これは Stripe が所有するドメインではありません。この URL にアクセスすると、JFrog アーティファクトリーのリストにリダイレクトされます。

Debian および Ubuntu ベースのディストリビューションに Stripe CLI をインストールする方法は以下のとおりです。

1. Stripe CLI の GPG キーを apt ソースのキーリングに追加します。

```bash
curl -s https://packages.stripe.dev/api/security/keypair/stripe-cli-gpg/public | gpg --dearmor | sudo tee /usr/share/keyrings/stripe.gpg > /dev/null
```

1. CLI の apt リポジトリーを apt ソースリストに追加します。

```bash
echo "deb [signed-by=/usr/share/keyrings/stripe.gpg] https://packages.stripe.dev/stripe-cli-debian-local stable main" | sudo tee -a /etc/apt/sources.list.d/stripe.list
```

1. パッケージリストを更新します。

```bash
sudo apt update
```

1. CLI をインストールします。

```bash
sudo apt install stripe
```

#### yum

> CLI の RPM ビルドは JFrog(https://packages.stripe.dev,) で利用可能ですが、これは Stripe が所有するドメインではありません。この URL にアクセスすると、JFrog アーティファクトリーのリストにリダイレクトされます。

RPM ベースのディストリビューションに Stripe CLI をインストールする方法は以下のとおりです。

1. CLI の yum リポジトリーを yum ソースリストに追加します。

```bash
echo -e "[Stripe]\nname=stripe\nbaseurl=https://packages.stripe.dev/stripe-cli-rpm-local/\nenabled=1\ngpgcheck=0" >> /etc/yum.repos.d/stripe.repo
```

1. CLI をインストールします。

```bash
sudo yum install stripe
```

#### Scoop

[Scoop](https://scoop.sh/) で Stripe CLI をインストールするには、以下を実行します。

```bash
scoop bucket add stripe https://github.com/stripe/scoop-stripe-cli.git
```

```bash
scoop install stripe
```

#### macOS

homebrew なしで Stripe CLI を macOS にインストールする方法は以下のとおりです。

1. [GitHub](https://github.com/stripe/stripe-cli/releases/latest) から、ご使用の cpu アーキテクチャータイプの最新の `mac-os` tar.gz ファイルをダウンロードします。
1. `tar -xvf stripe_[X.X.X]_mac-os_[ARCH_TYPE].tar.gz` を使用して、ファイルを解凍します。

必要に応じて、グローバルに実行できる場所 (`/usr/local/bin` など) にバイナリをインストールします。

#### Linux

Package Manager なしで Stripe CLI を Linux にインストールする方法は以下のとおりです。

1. [GitHub](https://github.com/stripe/stripe-cli/releases/latest) から、最新の `linux` tar.gz ファイルをダウンロードします。
1. `tar -xvf stripe_X.X.X_linux_x86_64.tar.gz` を使用して、ファイルを解凍します。
1. `./stripe` を自身の実行パスに移動します。

#### Windows

Scoop なしで Stripe CLI を Windows にインストールする方法は、以下のとおりです。

1. [GitHub](https://github.com/stripe/stripe-cli/releases/latest) から、最新の `windows` zip ファイルをダウンロードします。
1. `stripe_X.X.X_windows_x86_64.zip` ファイルを解凍します。
1. 解凍した `stripe.exe` ファイルへのパスを `Path` 環境変数に追加します。環境変数の更新方法については、[Microsoft PowerShell のドキュメント](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_environment_variables?view=powershell-7.3#saving-changes-to-environment-variables)を参照してください。

> Windows のアンチウイルススキャナーは、Stripe CLI に「安全ではない」とフラグ付けすることがあります。これは偽陽性である可能性が高いです。詳細については、GitHub リポジトリの [issue #692](https://github.com/stripe/stripe-cli/issues/692) をご覧ください。

1. 解凍した `.exe` ファイルを実行します。

#### Docker

Stripe CLI は、[Docker イメージ](https://hub.docker.com/r/stripe/stripe-cli)としても使用できます。最新バージョンをインストールするには、以下を実行します。

```bash
docker run --rm -it stripe/stripe-cli:latest
```

### 認証

ログインして Stripe ユーザー[アカウント](https://docs.stripe.com/get-started/account/set-up.md)を認証すると、制限付きキーのセットを生成できます。詳細については、[Stripe CLI のキーと権限](https://docs.stripe.com/stripe-cli/keys.md)を参照してください。

```bash
  stripe login
```

キーボードの **Enter** キーを押して、ブラウザーでの認証プロセスを完了します。

```bash
Your pairing code is: enjoy-enough-outwit-win
This pairing code verifies your authentication with Stripe.
Press Enter to open the browser or visit https://dashboard.stripe.com/stripecli/confirm_auth?t=THQdJfL3x12udFkNorJL8OF1iFlN8Az1 (^C to quit)
```

### 設定を確定

CLI のインストールが完了し、[Create a product (商品作成) API](https://docs.stripe.com/api/products/create.md) への単一の API リクエストを作成できるようになりました。

#### bash

```bash
stripe products create \
--name="My First Product" \
--description="Created with the Stripe CLI"
```

レスポンスオブジェクトの `id` 内で商品 ID を探し、次のステップのために保存しておきます。

すべて正常に機能する場合、コマンドラインに以下のレスポンスが表示されます。

#### bash

```json
{
  "id": "prod_LTenIrmp8Q67sa", // ID は次のようになります。
  "object": "product",
  "active": true,
  "attributes": [],
  "created": 1668198126,
  "default_price": null,
  "description": "Created with the Stripe CLI",
  "identifiers": {},
  "images": [],
  "livemode": false,
  "metadata": {},
  "name": "My First Product",
  "package_dimensions": null,
  "price": null,
  "product_class": null,
  "shippable": null,
  "sku": "my-first-product-10",
  "statement_descriptor": null,
  "tax_code": null,
  "type": "service",
  "unit_label": null,
  "updated": 1668198126,
  "url": null
}
```

次に、[Create a price (価格作成) API](https://docs.stripe.com/api/prices/create.md) を呼び出して、30 USD の価格を関連付けます。`product` のプレースホルダーを商品 ID (例: `prod_LTenIrmp8Q67sa`) に入れ替えます。

#### bash

```bash
stripe prices create \
  --unit-amount=3000 \
  --currency=usd \
  --product="{{PRODUCT_ID}}"
```

すべて正常に機能する場合、コマンドラインに以下のレスポンスが表示されます。

#### bash

```json
{
  "id": "price_1KzlAMJJDeE9fu01WMJJr79o", // ID は次のようになります。
  "object": "price",
  "active": true,
  "billing_scheme": "per_unit",
  "created": 1652636348,
  "currency": "usd",
  "livemode": false,
  "lookup_key": null,
  "metadata": {},
  "nickname": null,
  "product": "prod_Lh9iTGZhb2mcBy",
  "recurring": null,
  "tax_behavior": "unspecified",
  "tiers_mode": null,
  "transform_quantity": null,
  "type": "one_time",
  "unit_amount": 3000,
  "unit_amount_decimal": "3000"
}
```

## サードパーティーの依存関係を管理する

サードパーティーの依存関係の管理には、[venv](https://docs.python.org/3/tutorial/venv.html) モジュールを使用することをお勧めします。venv を使用すると、新規ライブラリを追加し、Python 3 プロジェクトに含めることができます。

### Windows (cmd.exe) の場合:

#### Windows (cmd.exe) の場合

```bash
python3 -m venv env
.\env\Scripts\activate.bat
```

### GNU/Linux または MacOS (bash) の場合:

#### GNU/Linux または MacOS (bash) の場合

```bash
python3 -m venv env
source env/bin/activate
```

## Python のサーバー側 SDK をインストールする

最新バージョンの Stripe Python サーバー側 SDK は、v15.0.0 です。Python バージョン 3.6 以降に対応します。

Python バージョンを確認する

```bash
python3 --version
```

### ライブラリをインストールする

Python のパッケージマネージャーである [PyPi](http://pypi.python.org/pypi/stripe/) からライブラリをインストールします。

```bash
pip3 install --upgrade stripe
```

次に、requirements.txt ファイルに以下のバージョンを指定します。

```txt
stripe>=15.0.0
```

### インストールの代替手段

**手動インストール**: SDK の[ソースコードをダウンロード](https://github.com/stripe/stripe-python)し、以下を実行してライブラリをインストールします。

```bash
python3 setup.py install
```

## 最初の SDK リクエストを実行する

これで、Python SDK がインストールされ、サブスクリプションの [Product (商品)](https://docs.stripe.com/api/products/create.md) を作成し、いくつかの API リクエストに [Price (価格)](https://docs.stripe.com/api/prices/create.md) を関連付けられるようになりました。この例では、Product のレスポンスで返された商品 ID を使用して価格を作成しています。

> #### API キーのベストプラクティス
> 
> このサンプルでは、*サンドボックス* (A sandbox is an isolated test environment that allows you to test Stripe functionality in your account without affecting your live integration. Use sandboxes to safely experiment with new features and changes)環境で、Stripe ユーザー[アカウント](https://docs.stripe.com/get-started/account/set-up.md)のデフォルトキーを使用します。これらの値を表示できるのはお客様のみです。キーを安全に管理するため、[ベストプラクティス](https://docs.stripe.com/keys-best-practices.md)に従ってください。

#### 商品と価格を作成する

```python
import stripe

# Don't embed any keys in production code. This is an example.
# See https://docs.stripe.com/keys-best-practices.
client = stripe.StripeClient("sk_test_09l3shTSTKHYCzzZZsiLl2vA")

starter_subscription = client.v1.products.create(params={
  "name": "Starter Subscription",
  "description": "$12/Month subscription",
})

starter_subscription_price = client.v1.prices.create(params={
  "unit_amount": 1200,
  "currency": "usd",
  "recurring": {"interval": "month"},
  "product": starter_subscription['id'],
})

# Save these identifiers
print(f"Success! Here is your starter subscription product id: {starter_subscription.id}")
print(f"Success! Here is your starter subscription price id: {starter_subscription_price.id}")
```

ファイルを `create_price.py` という名前で保存します。コマンドラインから、保存したファイルが含まれるディレクトリーに `cd` で移動し、以下のコマンドを実行します。

#### create_price.py

```bash
python3 create_price.py
```

すべて正常に機能する場合、コマンドラインに以下のレスポンスが表示されます。実装を構築する際に使用できるように、これらの ID を保存します。

#### bash

```bash
Success! Here is your starter subscription product id: prod_0KxBDl589O8KAxCG1alJgiA6
Success! Here is your starter subscription price id: price_0KxBDm589O8KAxCGMgG7scjb
```

## See also

クイックスタートは以上です。以下のリンクでは、作成した商品の支払いを処理する方法をいくつか紹介しています。

- [決済用のリンクを作成する](https://docs.stripe.com/payment-links.md)
- [Stripe がオンラインで提供するページ](https://docs.stripe.com/checkout/quickstart.md)
- [高度な連携](https://docs.stripe.com/payments/quickstart-checkout-sessions.md)


# Go

> This is a Go for when lang is go. View the full page at https://docs.stripe.com/get-started/development-environment?lang=go.

このクイックスタートでは、[Stripe CLI](https://docs.stripe.com/stripe-cli.md) (Stripe 統合へのコマンドラインアクセスを可能にする重要なツール) をインストールします。また、[Stripe Go サーバーサイド SDK](https://github.com/stripe/stripe-go) を使用して、Go で記述されたアプリケーションから Stripe API にアクセスします。

## 学習内容

このクイックスタートでは以下について説明します。

- コードを記述することなく Stripe API を呼び出す方法
- Go モジュールを使用してサードパーティーの依存関係を管理する方法
- 最新の Stripe Go SDK v85.0.0 をインストールする方法
- 最初の SDK リクエストを送信する方法

## 初期セットアップ

まず、[Stripe アカウントを作成する](https://dashboard.stripe.com/register)か[サインイン](https://dashboard.stripe.com/login)します。

## Stripe CLI を設定する

### インストール

コマンドラインから、インストールスクリプトを使用するか、オペレーティングシステムのバージョン管理されたアーカイブファイルをダウンロードして展開し、CLI をインストールします。

#### homebrew

[homebrew](https://brew.sh/) で Stripe CLI をインストールするには、以下を実行します。

```bash
brew install stripe/stripe-cli/stripe
```

このコマンドを Linux バージョンの Homebrew で実行すると失敗しますが、代替手段を使用するか、Linux タブの指示に従ってこれを完了させることは可能です。

```bash
brew install stripe-cli
```

#### apt

> CLI の Debian ビルドは JFrog(https://packages.stripe.dev,) で利用可能ですが、これは Stripe が所有するドメインではありません。この URL にアクセスすると、JFrog アーティファクトリーのリストにリダイレクトされます。

Debian および Ubuntu ベースのディストリビューションに Stripe CLI をインストールする方法は以下のとおりです。

1. Stripe CLI の GPG キーを apt ソースのキーリングに追加します。

```bash
curl -s https://packages.stripe.dev/api/security/keypair/stripe-cli-gpg/public | gpg --dearmor | sudo tee /usr/share/keyrings/stripe.gpg > /dev/null
```

1. CLI の apt リポジトリーを apt ソースリストに追加します。

```bash
echo "deb [signed-by=/usr/share/keyrings/stripe.gpg] https://packages.stripe.dev/stripe-cli-debian-local stable main" | sudo tee -a /etc/apt/sources.list.d/stripe.list
```

1. パッケージリストを更新します。

```bash
sudo apt update
```

1. CLI をインストールします。

```bash
sudo apt install stripe
```

#### yum

> CLI の RPM ビルドは JFrog(https://packages.stripe.dev,) で利用可能ですが、これは Stripe が所有するドメインではありません。この URL にアクセスすると、JFrog アーティファクトリーのリストにリダイレクトされます。

RPM ベースのディストリビューションに Stripe CLI をインストールする方法は以下のとおりです。

1. CLI の yum リポジトリーを yum ソースリストに追加します。

```bash
echo -e "[Stripe]\nname=stripe\nbaseurl=https://packages.stripe.dev/stripe-cli-rpm-local/\nenabled=1\ngpgcheck=0" >> /etc/yum.repos.d/stripe.repo
```

1. CLI をインストールします。

```bash
sudo yum install stripe
```

#### Scoop

[Scoop](https://scoop.sh/) で Stripe CLI をインストールするには、以下を実行します。

```bash
scoop bucket add stripe https://github.com/stripe/scoop-stripe-cli.git
```

```bash
scoop install stripe
```

#### macOS

homebrew なしで Stripe CLI を macOS にインストールする方法は以下のとおりです。

1. [GitHub](https://github.com/stripe/stripe-cli/releases/latest) から、ご使用の cpu アーキテクチャータイプの最新の `mac-os` tar.gz ファイルをダウンロードします。
1. `tar -xvf stripe_[X.X.X]_mac-os_[ARCH_TYPE].tar.gz` を使用して、ファイルを解凍します。

必要に応じて、グローバルに実行できる場所 (`/usr/local/bin` など) にバイナリをインストールします。

#### Linux

Package Manager なしで Stripe CLI を Linux にインストールする方法は以下のとおりです。

1. [GitHub](https://github.com/stripe/stripe-cli/releases/latest) から、最新の `linux` tar.gz ファイルをダウンロードします。
1. `tar -xvf stripe_X.X.X_linux_x86_64.tar.gz` を使用して、ファイルを解凍します。
1. `./stripe` を自身の実行パスに移動します。

#### Windows

Scoop なしで Stripe CLI を Windows にインストールする方法は、以下のとおりです。

1. [GitHub](https://github.com/stripe/stripe-cli/releases/latest) から、最新の `windows` zip ファイルをダウンロードします。
1. `stripe_X.X.X_windows_x86_64.zip` ファイルを解凍します。
1. 解凍した `stripe.exe` ファイルへのパスを `Path` 環境変数に追加します。環境変数の更新方法については、[Microsoft PowerShell のドキュメント](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_environment_variables?view=powershell-7.3#saving-changes-to-environment-variables)を参照してください。

> Windows のアンチウイルススキャナーは、Stripe CLI に「安全ではない」とフラグ付けすることがあります。これは偽陽性である可能性が高いです。詳細については、GitHub リポジトリの [issue #692](https://github.com/stripe/stripe-cli/issues/692) をご覧ください。

1. 解凍した `.exe` ファイルを実行します。

#### Docker

Stripe CLI は、[Docker イメージ](https://hub.docker.com/r/stripe/stripe-cli)としても使用できます。最新バージョンをインストールするには、以下を実行します。

```bash
docker run --rm -it stripe/stripe-cli:latest
```

### 認証

ログインして Stripe ユーザー[アカウント](https://docs.stripe.com/get-started/account/set-up.md)を認証すると、制限付きキーのセットを生成できます。詳細については、[Stripe CLI のキーと権限](https://docs.stripe.com/stripe-cli/keys.md)を参照してください。

```bash
  stripe login
```

キーボードの **Enter** キーを押して、ブラウザーでの認証プロセスを完了します。

```bash
Your pairing code is: enjoy-enough-outwit-win
This pairing code verifies your authentication with Stripe.
Press Enter to open the browser or visit https://dashboard.stripe.com/stripecli/confirm_auth?t=THQdJfL3x12udFkNorJL8OF1iFlN8Az1 (^C to quit)
```

### 設定を確定

CLI のインストールが完了し、[Create a product (商品作成) API](https://docs.stripe.com/api/products/create.md) への単一の API リクエストを作成できるようになりました。

#### bash

```bash
stripe products create \
--name="My First Product" \
--description="Created with the Stripe CLI"
```

レスポンスオブジェクトの `id` 内で商品 ID を探し、次のステップのために保存しておきます。

すべて正常に機能する場合、コマンドラインに以下のレスポンスが表示されます。

#### bash

```json
{
  "id": "prod_LTenIrmp8Q67sa", // ID は次のようになります。
  "object": "product",
  "active": true,
  "attributes": [],
  "created": 1668198126,
  "default_price": null,
  "description": "Created with the Stripe CLI",
  "identifiers": {},
  "images": [],
  "livemode": false,
  "metadata": {},
  "name": "My First Product",
  "package_dimensions": null,
  "price": null,
  "product_class": null,
  "shippable": null,
  "sku": "my-first-product-10",
  "statement_descriptor": null,
  "tax_code": null,
  "type": "service",
  "unit_label": null,
  "updated": 1668198126,
  "url": null
}
```

次に、[Create a price (価格作成) API](https://docs.stripe.com/api/prices/create.md) を呼び出して、30 USD の価格を関連付けます。`product` のプレースホルダーを商品 ID (例: `prod_LTenIrmp8Q67sa`) に入れ替えます。

#### bash

```bash
stripe prices create \
  --unit-amount=3000 \
  --currency=usd \
  --product="{{PRODUCT_ID}}"
```

すべて正常に機能する場合、コマンドラインに以下のレスポンスが表示されます。

#### bash

```json
{
  "id": "price_1KzlAMJJDeE9fu01WMJJr79o", // ID は次のようになります。
  "object": "price",
  "active": true,
  "billing_scheme": "per_unit",
  "created": 1652636348,
  "currency": "usd",
  "livemode": false,
  "lookup_key": null,
  "metadata": {},
  "nickname": null,
  "product": "prod_Lh9iTGZhb2mcBy",
  "recurring": null,
  "tax_behavior": "unspecified",
  "tiers_mode": null,
  "transform_quantity": null,
  "type": "one_time",
  "unit_amount": 3000,
  "unit_amount_decimal": "3000"
}
```

## サードパーティーの依存関係を管理する

サードパーティーの依存関係の管理には、[Go モジュール](https://go.dev/blog/using-go-modules)を使用することをお勧めします。Go モジュールを使用すると、新規ライブラリを追加し、Go プロジェクトに含めることができます。

### Go を初期化する

新しいディレクトリで最初から開始する場合は、まず、依存関係を追跡するための `go.mod` ファイルを作成する必要があります。以下に例を示します。

#### Go を初期化する

```bash
go mod init stripe-example
```

## Go のサーバー側 SDK をインストールする

最新バージョンの Stripe Go サーバー側 SDK は、v85.0.0 です。Go バージョン 1.15 以降をサポートします。

### ライブラリをインストールする

Go のパッケージマネージャーである [Go モジュール](https://go.dev/blog/using-go-modules)を使用して、ライブラリをインストールします。

```bash
go get github.com/stripe/stripe-go/v85
```

Go モジュールを使用してライブラリを「新しい」プロジェクトにインストールすると、ライブラリはプロジェクトの go.mod ファイルに依存関係として自動的に追加されます。以下に例を示します。

```go.mod
module stripe-example

go 1.18

require github.com/stripe/stripe-go/v85 85.0.0 // indirect
```

### 依存関係を同期する

「既存」のプロジェクトの管理対象の依存関係を適切に維持するには、次のコマンドを実行して、[コードの依存関係を同期](https://go.dev/doc/modules/managing-dependencies)します。

```bash
go mod tidy
```

## 最初の SDK リクエストを実行する

これで、Go SDK がインストールされ、サブスクリプションの [Product (商品)](https://docs.stripe.com/api/products/create.md) を作成し、いくつかの API リクエストに [Price (価格)](https://docs.stripe.com/api/prices/create.md) を関連付けられるようになりました。この例では、Product のレスポンスで返された商品 ID を使用して価格を作成しています。

> #### API キーのベストプラクティス
> 
> このサンプルでは、*サンドボックス* (A sandbox is an isolated test environment that allows you to test Stripe functionality in your account without affecting your live integration. Use sandboxes to safely experiment with new features and changes)環境で、Stripe ユーザー[アカウント](https://docs.stripe.com/get-started/account/set-up.md)のデフォルトキーを使用します。これらの値を表示できるのはお客様のみです。キーを安全に管理するため、[ベストプラクティス](https://docs.stripe.com/keys-best-practices.md)に従ってください。

#### 商品と価格を作成する

```go
package main

import (
  "context"
  "fmt"
  "github.com/stripe/stripe-go/v85"
)

func main() {
  // Don't embed any keys in production code. This is an example.
	// See https://docs.stripe.com/keys-best-practices.
  sc := stripe.NewClient("sk_test_09l3shTSTKHYCzzZZsiLl2vA")

	productParams := &stripe.ProductCreateParams{
		Name:        stripe.String("Starter Subscription"),
		Description: stripe.String("$12/Month subscription"),
	}
	starterProduct, _ := sc.V1Products.Create(context.TODO(), productParams)

	priceParams := &stripe.PriceCreateParams{
		Currency: stripe.String(stripe.CurrencyUSD),
		Product:  stripe.String(starterProduct.ID),
		Recurring: &stripe.PriceCreateRecurringParams{
			Interval: stripe.String(stripe.PriceRecurringIntervalMonth),
		},
		UnitAmount: stripe.Int64(1200),
	}
	starterPrice, _ := sc.V1Prices.Create(context.TODO(), priceParams)

	fmt.Println("Success! Here is your starter subscription product id: " + starterProduct.ID)
	fmt.Println("Success! Here is your starter subscription price id: " + starterPrice.ID)
}
```

ファイルを `create_price.go` という名前で保存します。コマンドラインから、保存したファイルが含まれるディレクトリーに `cd` で移動し、以下のコマンドを実行します。

#### create_price.rb

```bash
go run create_price.go
```

すべて正常に機能する場合、コマンドラインに以下のレスポンスが表示されます。実装を構築する際に使用できるように、これらの ID を保存します。

#### bash

```bash
Success! Here is your starter subscription product id: prod_0KxBDl589O8KAxCG1alJgiA6
Success! Here is your starter subscription price id: price_0KxBDm589O8KAxCGMgG7scjb
```

## See also

クイックスタートは以上です。以下のリンクでは、作成した商品の支払いを処理する方法をいくつか紹介しています。

- [決済用のリンクを作成する](https://docs.stripe.com/payment-links.md)
- [Stripe がオンラインで提供するページ](https://docs.stripe.com/checkout/quickstart.md)
- [高度な連携](https://docs.stripe.com/payments/quickstart-checkout-sessions.md)


# Java

> This is a Java for when lang is java. View the full page at https://docs.stripe.com/get-started/development-environment?lang=java.

このクイックスタートでは、[Stripe CLI](https://docs.stripe.com/stripe-cli.md) (Stripe 統合へのコマンドラインアクセスを可能にする重要なツール) をインストールします。また、[Stripe Java サーバーサイド SDK](https://github.com/stripe/stripe-java) を使用して、Java で記述されたアプリケーションから Stripe API にアクセスします。

## 学習内容

このクイックスタートでは以下について説明します。

- コードを記述することなく Stripe API を呼び出す方法
- Maven または Gradle を使用してサードパーティーの依存関係を管理する方法
- 最新の Stripe Java SDK v32.0.0 をインストールする方法
- 最初の SDK リクエストを送信する方法

## 初期セットアップ

まず、[Stripe アカウントを作成する](https://dashboard.stripe.com/register)か[サインイン](https://dashboard.stripe.com/login)します。

## Stripe CLI を設定する

### インストール

コマンドラインから、インストールスクリプトを使用するか、オペレーティングシステムのバージョン管理されたアーカイブファイルをダウンロードして展開し、CLI をインストールします。

#### homebrew

[homebrew](https://brew.sh/) で Stripe CLI をインストールするには、以下を実行します。

```bash
brew install stripe/stripe-cli/stripe
```

このコマンドを Linux バージョンの Homebrew で実行すると失敗しますが、代替手段を使用するか、Linux タブの指示に従ってこれを完了させることは可能です。

```bash
brew install stripe-cli
```

#### apt

> CLI の Debian ビルドは JFrog(https://packages.stripe.dev,) で利用可能ですが、これは Stripe が所有するドメインではありません。この URL にアクセスすると、JFrog アーティファクトリーのリストにリダイレクトされます。

Debian および Ubuntu ベースのディストリビューションに Stripe CLI をインストールする方法は以下のとおりです。

1. Stripe CLI の GPG キーを apt ソースのキーリングに追加します。

```bash
curl -s https://packages.stripe.dev/api/security/keypair/stripe-cli-gpg/public | gpg --dearmor | sudo tee /usr/share/keyrings/stripe.gpg > /dev/null
```

1. CLI の apt リポジトリーを apt ソースリストに追加します。

```bash
echo "deb [signed-by=/usr/share/keyrings/stripe.gpg] https://packages.stripe.dev/stripe-cli-debian-local stable main" | sudo tee -a /etc/apt/sources.list.d/stripe.list
```

1. パッケージリストを更新します。

```bash
sudo apt update
```

1. CLI をインストールします。

```bash
sudo apt install stripe
```

#### yum

> CLI の RPM ビルドは JFrog(https://packages.stripe.dev,) で利用可能ですが、これは Stripe が所有するドメインではありません。この URL にアクセスすると、JFrog アーティファクトリーのリストにリダイレクトされます。

RPM ベースのディストリビューションに Stripe CLI をインストールする方法は以下のとおりです。

1. CLI の yum リポジトリーを yum ソースリストに追加します。

```bash
echo -e "[Stripe]\nname=stripe\nbaseurl=https://packages.stripe.dev/stripe-cli-rpm-local/\nenabled=1\ngpgcheck=0" >> /etc/yum.repos.d/stripe.repo
```

1. CLI をインストールします。

```bash
sudo yum install stripe
```

#### Scoop

[Scoop](https://scoop.sh/) で Stripe CLI をインストールするには、以下を実行します。

```bash
scoop bucket add stripe https://github.com/stripe/scoop-stripe-cli.git
```

```bash
scoop install stripe
```

#### macOS

homebrew なしで Stripe CLI を macOS にインストールする方法は以下のとおりです。

1. [GitHub](https://github.com/stripe/stripe-cli/releases/latest) から、ご使用の cpu アーキテクチャータイプの最新の `mac-os` tar.gz ファイルをダウンロードします。
1. `tar -xvf stripe_[X.X.X]_mac-os_[ARCH_TYPE].tar.gz` を使用して、ファイルを解凍します。

必要に応じて、グローバルに実行できる場所 (`/usr/local/bin` など) にバイナリをインストールします。

#### Linux

Package Manager なしで Stripe CLI を Linux にインストールする方法は以下のとおりです。

1. [GitHub](https://github.com/stripe/stripe-cli/releases/latest) から、最新の `linux` tar.gz ファイルをダウンロードします。
1. `tar -xvf stripe_X.X.X_linux_x86_64.tar.gz` を使用して、ファイルを解凍します。
1. `./stripe` を自身の実行パスに移動します。

#### Windows

Scoop なしで Stripe CLI を Windows にインストールする方法は、以下のとおりです。

1. [GitHub](https://github.com/stripe/stripe-cli/releases/latest) から、最新の `windows` zip ファイルをダウンロードします。
1. `stripe_X.X.X_windows_x86_64.zip` ファイルを解凍します。
1. 解凍した `stripe.exe` ファイルへのパスを `Path` 環境変数に追加します。環境変数の更新方法については、[Microsoft PowerShell のドキュメント](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_environment_variables?view=powershell-7.3#saving-changes-to-environment-variables)を参照してください。

> Windows のアンチウイルススキャナーは、Stripe CLI に「安全ではない」とフラグ付けすることがあります。これは偽陽性である可能性が高いです。詳細については、GitHub リポジトリの [issue #692](https://github.com/stripe/stripe-cli/issues/692) をご覧ください。

1. 解凍した `.exe` ファイルを実行します。

#### Docker

Stripe CLI は、[Docker イメージ](https://hub.docker.com/r/stripe/stripe-cli)としても使用できます。最新バージョンをインストールするには、以下を実行します。

```bash
docker run --rm -it stripe/stripe-cli:latest
```

### 認証

ログインして Stripe ユーザー[アカウント](https://docs.stripe.com/get-started/account/set-up.md)を認証すると、制限付きキーのセットを生成できます。詳細については、[Stripe CLI のキーと権限](https://docs.stripe.com/stripe-cli/keys.md)を参照してください。

```bash
  stripe login
```

キーボードの **Enter** キーを押して、ブラウザーでの認証プロセスを完了します。

```bash
Your pairing code is: enjoy-enough-outwit-win
This pairing code verifies your authentication with Stripe.
Press Enter to open the browser or visit https://dashboard.stripe.com/stripecli/confirm_auth?t=THQdJfL3x12udFkNorJL8OF1iFlN8Az1 (^C to quit)
```

### 設定を確定

CLI のインストールが完了し、[Create a product (商品作成) API](https://docs.stripe.com/api/products/create.md) への単一の API リクエストを作成できるようになりました。

#### bash

```bash
stripe products create \
--name="My First Product" \
--description="Created with the Stripe CLI"
```

レスポンスオブジェクトの `id` 内で商品 ID を探し、次のステップのために保存しておきます。

すべて正常に機能する場合、コマンドラインに以下のレスポンスが表示されます。

#### bash

```json
{
  "id": "prod_LTenIrmp8Q67sa", // ID は次のようになります。
  "object": "product",
  "active": true,
  "attributes": [],
  "created": 1668198126,
  "default_price": null,
  "description": "Created with the Stripe CLI",
  "identifiers": {},
  "images": [],
  "livemode": false,
  "metadata": {},
  "name": "My First Product",
  "package_dimensions": null,
  "price": null,
  "product_class": null,
  "shippable": null,
  "sku": "my-first-product-10",
  "statement_descriptor": null,
  "tax_code": null,
  "type": "service",
  "unit_label": null,
  "updated": 1668198126,
  "url": null
}
```

次に、[Create a price (価格作成) API](https://docs.stripe.com/api/prices/create.md) を呼び出して、30 USD の価格を関連付けます。`product` のプレースホルダーを商品 ID (例: `prod_LTenIrmp8Q67sa`) に入れ替えます。

#### bash

```bash
stripe prices create \
  --unit-amount=3000 \
  --currency=usd \
  --product="{{PRODUCT_ID}}"
```

すべて正常に機能する場合、コマンドラインに以下のレスポンスが表示されます。

#### bash

```json
{
  "id": "price_1KzlAMJJDeE9fu01WMJJr79o", // ID は次のようになります。
  "object": "price",
  "active": true,
  "billing_scheme": "per_unit",
  "created": 1652636348,
  "currency": "usd",
  "livemode": false,
  "lookup_key": null,
  "metadata": {},
  "nickname": null,
  "product": "prod_Lh9iTGZhb2mcBy",
  "recurring": null,
  "tax_behavior": "unspecified",
  "tiers_mode": null,
  "transform_quantity": null,
  "type": "one_time",
  "unit_amount": 3000,
  "unit_amount_decimal": "3000"
}
```

## サードパーティーの依存関係を管理する

サードパーティーの依存関係の管理には、[Maven](https://maven.apache.org/guides/getting-started/index.html) または [Gradle](https://docs.gradle.org) を使用することをお勧めします。これらは、新規ライブラリを追加して、Java プロジェクトに含めるのに役立ちます。

### プロジェクトを初期化する

- **Maven** を使用してプロジェクトを作成する場合は、[How do I make my first Maven project? (最初の Maven プロジェクトの作成方法) (英語)](https://maven.apache.org/guides/getting-started/index.html#How_do_I_make_my_first_Maven_project) を参照してください。
- **Gradle** でプロジェクトを作成する場合は、[Building Java Applications Sample (Java アプリケーションの構築サンプル) (英語)](https://docs.gradle.org/current/samples/sample_building_java_applications.html) を参照してください。

## Java のサーバー側 SDK をインストールする

最新バージョンの Stripe Java サーバー側 SDK は、v32.0.0 です。Java バージョン 1.8 以降をサポートします。

Java バージョンを確認する:

```bash
java -version
```

### ライブラリをインストールする

- **Maven** を使用する場合は、プロジェクトの pom.xml ファイルに以下を配置します。

```xml
<dependency>
  <groupId>com.stripe</groupId>
  <artifactId>stripe-java</artifactId>
  <version>32.0.0</version>
</dependency>
```

- **Gradle** を使用する場合は、build.gradle ファイルの dependencies ブロック内に次の行を貼り付けます。

```groovy
implementation 'com.stripe:stripe-java:32.0.0'
```

### インストールの代替手段

**手動インストール**: 次の JAR を使用して stripe-java を手動でインストールできます。[Stripe JAR (.jar) をダウンロード](https://search.maven.org/remote_content?g=com.stripe&a=stripe-java&v=LATEST)します。

[Google Gson](https://github.com/google/gson) 用の [Gson JAR (.jar) をダウンロード](https://repo1.maven.org/maven2/com/google/code/gson/gson/2.8.9/gson-2.8.9.jar)します。

**Proguard**: ProGuard を使用している場合は、`proguard.cfg` ファイルに以下を追加して、ライブラリを除外するようにしてください。

```proguard
-keep class com.stripe.** { *; }
```

## 最初の SDK リクエストを実行する

これで、Java SDK がインストールされ、サブスクリプションの [Product (商品)](https://docs.stripe.com/api/products/create.md) を作成し、いくつかの API リクエストに [Price (価格)](https://docs.stripe.com/api/prices/create.md) を関連付けられるようになりました。この例では、Product のレスポンスで返された商品 ID を使用して価格を作成しています。

> #### API キーのベストプラクティス
> 
> このサンプルでは、*サンドボックス* (A sandbox is an isolated test environment that allows you to test Stripe functionality in your account without affecting your live integration. Use sandboxes to safely experiment with new features and changes)環境で、Stripe ユーザー[アカウント](https://docs.stripe.com/get-started/account/set-up.md)のデフォルトキーを使用します。これらの値を表示できるのはお客様のみです。キーを安全に管理するため、[ベストプラクティス](https://docs.stripe.com/keys-best-practices.md)に従ってください。

#### 商品と価格を作成する

```java
package com.stripe.sample;

import com.stripe.StripeClient;
import com.stripe.exception.StripeException;
import com.stripe.model.Product;
import com.stripe.param.ProductCreateParams;
import com.stripe.param.PriceCreateParams;
import com.stripe.model.Price;

public class Server {
    public static void main(String[] args) throws StripeException {
        // Don't embed any keys in production code. This is an example.
        // See https://docs.stripe.com/keys-best-practices.
        StripeClient stripeClient = new StripeClient("sk_test_09l3shTSTKHYCzzZZsiLl2vA");

        ProductCreateParams productParams =
            ProductCreateParams.builder()
                .setName("Starter Subscription")
                .setDescription("$12/Month subscription")
                .build();
        Product product = stripeClient.v1().products().create(productParams);
        System.out.println("Success! Here is your starter subscription product id: " + product.getId());

        PriceCreateParams params =
            PriceCreateParams
                .builder()
                .setProduct(product.getId())
                .setCurrency("usd")
                .setUnitAmount(1200L)
                .setRecurring(
                    PriceCreateParams.Recurring
                        .builder()
                        .setInterval(PriceCreateParams.Recurring.Interval.MONTH)
                        .build())
                .build();
        Price price = stripeClient.v1().prices().create(params);
        System.out.println("Success! Here is your starter subscription price id: " + price.getId());
    }
}
```

ファイルを `CreatePrice.java` という名前で保存します。Maven または Gradle の IDE のプロジェクトから、サンプルを実行します。たとえば、`Run 'CreatePrice.main()'` のようにして実行します。

すべて正常に機能する場合、コマンドラインに以下のレスポンスが表示されます。実装を構築する際に使用できるように、これらの ID を保存します。

#### bash

```bash
Success! Here is your starter subscription product id: prod_0KxBDl589O8KAxCG1alJgiA6
Success! Here is your starter subscription price id: price_0KxBDm589O8KAxCGMgG7scjb
```

## See also

クイックスタートは以上です。以下のリンクでは、作成した商品の支払いを処理する方法をいくつか紹介しています。

- [決済用のリンクを作成する](https://docs.stripe.com/payment-links.md)
- [Stripe がオンラインで提供するページ](https://docs.stripe.com/checkout/quickstart.md)
- [高度な連携](https://docs.stripe.com/payments/quickstart-checkout-sessions.md)


# Node.js

> This is a Node.js for when lang is node. View the full page at https://docs.stripe.com/get-started/development-environment?lang=node.

このクイックスタートでは、[Stripe CLI](https://docs.stripe.com/stripe-cli.md) (Stripe 統合へのコマンドラインアクセスを可能にする重要なツール) をインストールします。また、[Stripe Node.js サーバーサイド SDK](https://github.com/stripe/stripe-node) を使用して、Node.js で記述されたアプリケーションから Stripe API にアクセスします。

## 学習内容

このクイックスタートでは以下について説明します。

- コードを記述することなく Stripe API を呼び出す方法
- npm または yarn パッケージマネージャーを使用してサードパーティーの依存関係を管理する方法
- 最新の Stripe Node SDK v21.0.1 をインストールする方法
- 最初の SDK リクエストを送信する方法

## 初期セットアップ

まず、[Stripe アカウントを作成する](https://dashboard.stripe.com/register)か[サインイン](https://dashboard.stripe.com/login)します。

## Stripe CLI を設定する

### インストール

コマンドラインから、インストールスクリプトを使用するか、オペレーティングシステムのバージョン管理されたアーカイブファイルをダウンロードして展開し、CLI をインストールします。

#### homebrew

[homebrew](https://brew.sh/) で Stripe CLI をインストールするには、以下を実行します。

```bash
brew install stripe/stripe-cli/stripe
```

このコマンドを Linux バージョンの Homebrew で実行すると失敗しますが、代替手段を使用するか、Linux タブの指示に従ってこれを完了させることは可能です。

```bash
brew install stripe-cli
```

#### apt

> CLI の Debian ビルドは JFrog(https://packages.stripe.dev,) で利用可能ですが、これは Stripe が所有するドメインではありません。この URL にアクセスすると、JFrog アーティファクトリーのリストにリダイレクトされます。

Debian および Ubuntu ベースのディストリビューションに Stripe CLI をインストールする方法は以下のとおりです。

1. Stripe CLI の GPG キーを apt ソースのキーリングに追加します。

```bash
curl -s https://packages.stripe.dev/api/security/keypair/stripe-cli-gpg/public | gpg --dearmor | sudo tee /usr/share/keyrings/stripe.gpg > /dev/null
```

1. CLI の apt リポジトリーを apt ソースリストに追加します。

```bash
echo "deb [signed-by=/usr/share/keyrings/stripe.gpg] https://packages.stripe.dev/stripe-cli-debian-local stable main" | sudo tee -a /etc/apt/sources.list.d/stripe.list
```

1. パッケージリストを更新します。

```bash
sudo apt update
```

1. CLI をインストールします。

```bash
sudo apt install stripe
```

#### yum

> CLI の RPM ビルドは JFrog(https://packages.stripe.dev,) で利用可能ですが、これは Stripe が所有するドメインではありません。この URL にアクセスすると、JFrog アーティファクトリーのリストにリダイレクトされます。

RPM ベースのディストリビューションに Stripe CLI をインストールする方法は以下のとおりです。

1. CLI の yum リポジトリーを yum ソースリストに追加します。

```bash
echo -e "[Stripe]\nname=stripe\nbaseurl=https://packages.stripe.dev/stripe-cli-rpm-local/\nenabled=1\ngpgcheck=0" >> /etc/yum.repos.d/stripe.repo
```

1. CLI をインストールします。

```bash
sudo yum install stripe
```

#### Scoop

[Scoop](https://scoop.sh/) で Stripe CLI をインストールするには、以下を実行します。

```bash
scoop bucket add stripe https://github.com/stripe/scoop-stripe-cli.git
```

```bash
scoop install stripe
```

#### macOS

homebrew なしで Stripe CLI を macOS にインストールする方法は以下のとおりです。

1. [GitHub](https://github.com/stripe/stripe-cli/releases/latest) から、ご使用の cpu アーキテクチャータイプの最新の `mac-os` tar.gz ファイルをダウンロードします。
1. `tar -xvf stripe_[X.X.X]_mac-os_[ARCH_TYPE].tar.gz` を使用して、ファイルを解凍します。

必要に応じて、グローバルに実行できる場所 (`/usr/local/bin` など) にバイナリをインストールします。

#### Linux

Package Manager なしで Stripe CLI を Linux にインストールする方法は以下のとおりです。

1. [GitHub](https://github.com/stripe/stripe-cli/releases/latest) から、最新の `linux` tar.gz ファイルをダウンロードします。
1. `tar -xvf stripe_X.X.X_linux_x86_64.tar.gz` を使用して、ファイルを解凍します。
1. `./stripe` を自身の実行パスに移動します。

#### Windows

Scoop なしで Stripe CLI を Windows にインストールする方法は、以下のとおりです。

1. [GitHub](https://github.com/stripe/stripe-cli/releases/latest) から、最新の `windows` zip ファイルをダウンロードします。
1. `stripe_X.X.X_windows_x86_64.zip` ファイルを解凍します。
1. 解凍した `stripe.exe` ファイルへのパスを `Path` 環境変数に追加します。環境変数の更新方法については、[Microsoft PowerShell のドキュメント](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_environment_variables?view=powershell-7.3#saving-changes-to-environment-variables)を参照してください。

> Windows のアンチウイルススキャナーは、Stripe CLI に「安全ではない」とフラグ付けすることがあります。これは偽陽性である可能性が高いです。詳細については、GitHub リポジトリの [issue #692](https://github.com/stripe/stripe-cli/issues/692) をご覧ください。

1. 解凍した `.exe` ファイルを実行します。

#### Docker

Stripe CLI は、[Docker イメージ](https://hub.docker.com/r/stripe/stripe-cli)としても使用できます。最新バージョンをインストールするには、以下を実行します。

```bash
docker run --rm -it stripe/stripe-cli:latest
```

### 認証

ログインして Stripe ユーザー[アカウント](https://docs.stripe.com/get-started/account/set-up.md)を認証すると、制限付きキーのセットを生成できます。詳細については、[Stripe CLI のキーと権限](https://docs.stripe.com/stripe-cli/keys.md)を参照してください。

```bash
  stripe login
```

キーボードの **Enter** キーを押して、ブラウザーでの認証プロセスを完了します。

```bash
Your pairing code is: enjoy-enough-outwit-win
This pairing code verifies your authentication with Stripe.
Press Enter to open the browser or visit https://dashboard.stripe.com/stripecli/confirm_auth?t=THQdJfL3x12udFkNorJL8OF1iFlN8Az1 (^C to quit)
```

### 設定を確定

CLI のインストールが完了し、[Create a product (商品作成) API](https://docs.stripe.com/api/products/create.md) への単一の API リクエストを作成できるようになりました。

#### bash

```bash
stripe products create \
--name="My First Product" \
--description="Created with the Stripe CLI"
```

レスポンスオブジェクトの `id` 内で商品 ID を探し、次のステップのために保存しておきます。

すべて正常に機能する場合、コマンドラインに以下のレスポンスが表示されます。

#### bash

```json
{
  "id": "prod_LTenIrmp8Q67sa", // ID は次のようになります。
  "object": "product",
  "active": true,
  "attributes": [],
  "created": 1668198126,
  "default_price": null,
  "description": "Created with the Stripe CLI",
  "identifiers": {},
  "images": [],
  "livemode": false,
  "metadata": {},
  "name": "My First Product",
  "package_dimensions": null,
  "price": null,
  "product_class": null,
  "shippable": null,
  "sku": "my-first-product-10",
  "statement_descriptor": null,
  "tax_code": null,
  "type": "service",
  "unit_label": null,
  "updated": 1668198126,
  "url": null
}
```

次に、[Create a price (価格作成) API](https://docs.stripe.com/api/prices/create.md) を呼び出して、30 USD の価格を関連付けます。`product` のプレースホルダーを商品 ID (例: `prod_LTenIrmp8Q67sa`) に入れ替えます。

#### bash

```bash
stripe prices create \
  --unit-amount=3000 \
  --currency=usd \
  --product="{{PRODUCT_ID}}"
```

すべて正常に機能する場合、コマンドラインに以下のレスポンスが表示されます。

#### bash

```json
{
  "id": "price_1KzlAMJJDeE9fu01WMJJr79o", // ID は次のようになります。
  "object": "price",
  "active": true,
  "billing_scheme": "per_unit",
  "created": 1652636348,
  "currency": "usd",
  "livemode": false,
  "lookup_key": null,
  "metadata": {},
  "nickname": null,
  "product": "prod_Lh9iTGZhb2mcBy",
  "recurring": null,
  "tax_behavior": "unspecified",
  "tiers_mode": null,
  "transform_quantity": null,
  "type": "one_time",
  "unit_amount": 3000,
  "unit_amount_decimal": "3000"
}
```

## Node.js のサーバー側 SDK をインストールする

最新バージョンの Stripe Node.js サーバー側 SDK は、v21.0.1 です。Node.js バージョン 12 以降をサポートします。

Node バージョンを確認する

```bash
node --version
```

### Node を初期化する

#### Node を初期化する

```bash
npm init
```

### ライブラリをインストールする

ライブラリのインストールには、Node のパッケージマネージャーである [npm](https://www.npmjs.com/package/node) を使用します。

```bash
npm install stripe --save
```

npm を使用してライブラリをインストールすると、ライブラリはプロジェクトの package.json ファイルに自動的に依存関係として追加されます。以下に例を示します。

```json
{
  "name": "stripe-node-example",
  "version": "1.0.0",
  "description": "A Stripe demo",
  "main": "index.js",
  "scripts": {
    "node ": "node create_price.js",
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "author": "",
  "license": "ISC",
  "dependencies": {
    "stripe": "^21.0.1"
  }
}
```

### インストールの代替手段

**Yarn**: Node のもう 1 つのパッケージマネージャーである [yarn](https://yarnpkg.com/) を使用してライブラリをインストールできます。

```bash
yarn add stripe
```

## 最初の SDK リクエストを実行する

これで、Node.js SDK がインストールされ、サブスクリプションの [Product (商品)](https://docs.stripe.com/api/products/create.md) を作成し、いくつかの API リクエストに [Price (価格)](https://docs.stripe.com/api/prices/create.md) を関連付けられるようになりました。Node.js SDK は、チェーン可能なコールバックとして使用できる [promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise) を返します。説明のため、この例では Product のレスポンスで返された商品 ID を渡して Price を作成します。

> #### API キーのベストプラクティス
> 
> このサンプルでは、*サンドボックス* (A sandbox is an isolated test environment that allows you to test Stripe functionality in your account without affecting your live integration. Use sandboxes to safely experiment with new features and changes)環境で、Stripe ユーザー[アカウント](https://docs.stripe.com/get-started/account/set-up.md)のデフォルトキーを使用します。これらの値を表示できるのはお客様のみです。キーを安全に管理するため、[ベストプラクティス](https://docs.stripe.com/keys-best-practices.md)に従ってください。

#### 商品と価格を作成する

```node
// Don't embed any keys in production code. This is an example.
// See https://docs.stripe.com/keys-best-practices.
const stripe = require('stripe')('sk_test_09l3shTSTKHYCzzZZsiLl2vA');

stripe.products.create({
  name: 'Starter Subscription',
  description: '$12/Month subscription',
}).then(product => {
  stripe.prices.create({
    unit_amount: 1200,
    currency: 'usd',
    recurring: {
      interval: 'month',
    },
    product: product.id,
  }).then(price => {
    console.log('Success! Here is your starter subscription product id: ' + product.id);
    console.log('Success! Here is your starter subscription price id: ' + price.id);
  });
});
```

ファイルを `create_price.js` という名前で保存します。コマンドラインから、保存したファイルが含まれるディレクトリーに `cd` で移動し、以下のコマンドを実行します。

#### create_price.js

```bash
node create_price.js
```

すべて正常に機能する場合、コマンドラインに以下のレスポンスが表示されます。実装を構築する際に使用できるように、これらの ID を保存します。

#### bash

```bash
Success! Here is your starter subscription product id: prod_0KxBDl589O8KAxCG1alJgiA6
Success! Here is your starter subscription price id: price_0KxBDm589O8KAxCGMgG7scjb
```

## See also

クイックスタートは以上です。以下のリンクでは、作成した商品の支払いを処理する方法をいくつか紹介しています。

- [決済用のリンクを作成する](https://docs.stripe.com/payment-links.md)
- [Stripe がオンラインで提供するページ](https://docs.stripe.com/checkout/quickstart.md)
- [高度な連携](https://docs.stripe.com/payments/quickstart-checkout-sessions.md)


# PHP

> This is a PHP for when lang is php. View the full page at https://docs.stripe.com/get-started/development-environment?lang=php.

このクイックスタートでは、[Stripe CLI](https://docs.stripe.com/stripe-cli.md) (Stripe 統合へのコマンドラインアクセスを可能にする重要なツール) をインストールします。また、[Stripe PHP サーバーサイド SDK](https://github.com/stripe/stripe-php) を使用して、PHP で記述されたアプリケーションから Stripe API にアクセスします。

## 学習内容

このクイックスタートでは以下について説明します。

- コードを記述することなく Stripe API を呼び出す方法
- Composer を使用してサードパーティーの依存関係を管理する方法
- 最新の Stripe PHP SDK v20.0.0 をインストールする方法
- 最初の SDK リクエストを送信する方法

## 初期セットアップ

まず、[Stripe アカウントを作成する](https://dashboard.stripe.com/register)か[サインイン](https://dashboard.stripe.com/login)します。

## Stripe CLI を設定する

### インストール

コマンドラインから、インストールスクリプトを使用するか、オペレーティングシステムのバージョン管理されたアーカイブファイルをダウンロードして展開し、CLI をインストールします。

#### homebrew

[homebrew](https://brew.sh/) で Stripe CLI をインストールするには、以下を実行します。

```bash
brew install stripe/stripe-cli/stripe
```

このコマンドを Linux バージョンの Homebrew で実行すると失敗しますが、代替手段を使用するか、Linux タブの指示に従ってこれを完了させることは可能です。

```bash
brew install stripe-cli
```

#### apt

> CLI の Debian ビルドは JFrog(https://packages.stripe.dev,) で利用可能ですが、これは Stripe が所有するドメインではありません。この URL にアクセスすると、JFrog アーティファクトリーのリストにリダイレクトされます。

Debian および Ubuntu ベースのディストリビューションに Stripe CLI をインストールする方法は以下のとおりです。

1. Stripe CLI の GPG キーを apt ソースのキーリングに追加します。

```bash
curl -s https://packages.stripe.dev/api/security/keypair/stripe-cli-gpg/public | gpg --dearmor | sudo tee /usr/share/keyrings/stripe.gpg > /dev/null
```

1. CLI の apt リポジトリーを apt ソースリストに追加します。

```bash
echo "deb [signed-by=/usr/share/keyrings/stripe.gpg] https://packages.stripe.dev/stripe-cli-debian-local stable main" | sudo tee -a /etc/apt/sources.list.d/stripe.list
```

1. パッケージリストを更新します。

```bash
sudo apt update
```

1. CLI をインストールします。

```bash
sudo apt install stripe
```

#### yum

> CLI の RPM ビルドは JFrog(https://packages.stripe.dev,) で利用可能ですが、これは Stripe が所有するドメインではありません。この URL にアクセスすると、JFrog アーティファクトリーのリストにリダイレクトされます。

RPM ベースのディストリビューションに Stripe CLI をインストールする方法は以下のとおりです。

1. CLI の yum リポジトリーを yum ソースリストに追加します。

```bash
echo -e "[Stripe]\nname=stripe\nbaseurl=https://packages.stripe.dev/stripe-cli-rpm-local/\nenabled=1\ngpgcheck=0" >> /etc/yum.repos.d/stripe.repo
```

1. CLI をインストールします。

```bash
sudo yum install stripe
```

#### Scoop

[Scoop](https://scoop.sh/) で Stripe CLI をインストールするには、以下を実行します。

```bash
scoop bucket add stripe https://github.com/stripe/scoop-stripe-cli.git
```

```bash
scoop install stripe
```

#### macOS

homebrew なしで Stripe CLI を macOS にインストールする方法は以下のとおりです。

1. [GitHub](https://github.com/stripe/stripe-cli/releases/latest) から、ご使用の cpu アーキテクチャータイプの最新の `mac-os` tar.gz ファイルをダウンロードします。
1. `tar -xvf stripe_[X.X.X]_mac-os_[ARCH_TYPE].tar.gz` を使用して、ファイルを解凍します。

必要に応じて、グローバルに実行できる場所 (`/usr/local/bin` など) にバイナリをインストールします。

#### Linux

Package Manager なしで Stripe CLI を Linux にインストールする方法は以下のとおりです。

1. [GitHub](https://github.com/stripe/stripe-cli/releases/latest) から、最新の `linux` tar.gz ファイルをダウンロードします。
1. `tar -xvf stripe_X.X.X_linux_x86_64.tar.gz` を使用して、ファイルを解凍します。
1. `./stripe` を自身の実行パスに移動します。

#### Windows

Scoop なしで Stripe CLI を Windows にインストールする方法は、以下のとおりです。

1. [GitHub](https://github.com/stripe/stripe-cli/releases/latest) から、最新の `windows` zip ファイルをダウンロードします。
1. `stripe_X.X.X_windows_x86_64.zip` ファイルを解凍します。
1. 解凍した `stripe.exe` ファイルへのパスを `Path` 環境変数に追加します。環境変数の更新方法については、[Microsoft PowerShell のドキュメント](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_environment_variables?view=powershell-7.3#saving-changes-to-environment-variables)を参照してください。

> Windows のアンチウイルススキャナーは、Stripe CLI に「安全ではない」とフラグ付けすることがあります。これは偽陽性である可能性が高いです。詳細については、GitHub リポジトリの [issue #692](https://github.com/stripe/stripe-cli/issues/692) をご覧ください。

1. 解凍した `.exe` ファイルを実行します。

#### Docker

Stripe CLI は、[Docker イメージ](https://hub.docker.com/r/stripe/stripe-cli)としても使用できます。最新バージョンをインストールするには、以下を実行します。

```bash
docker run --rm -it stripe/stripe-cli:latest
```

### 認証

ログインして Stripe ユーザー[アカウント](https://docs.stripe.com/get-started/account/set-up.md)を認証すると、制限付きキーのセットを生成できます。詳細については、[Stripe CLI のキーと権限](https://docs.stripe.com/stripe-cli/keys.md)を参照してください。

```bash
  stripe login
```

キーボードの **Enter** キーを押して、ブラウザーでの認証プロセスを完了します。

```bash
Your pairing code is: enjoy-enough-outwit-win
This pairing code verifies your authentication with Stripe.
Press Enter to open the browser or visit https://dashboard.stripe.com/stripecli/confirm_auth?t=THQdJfL3x12udFkNorJL8OF1iFlN8Az1 (^C to quit)
```

### 設定を確定

CLI のインストールが完了し、[Create a product (商品作成) API](https://docs.stripe.com/api/products/create.md) への単一の API リクエストを作成できるようになりました。

#### bash

```bash
stripe products create \
--name="My First Product" \
--description="Created with the Stripe CLI"
```

レスポンスオブジェクトの `id` 内で商品 ID を探し、次のステップのために保存しておきます。

すべて正常に機能する場合、コマンドラインに以下のレスポンスが表示されます。

#### bash

```json
{
  "id": "prod_LTenIrmp8Q67sa", // ID は次のようになります。
  "object": "product",
  "active": true,
  "attributes": [],
  "created": 1668198126,
  "default_price": null,
  "description": "Created with the Stripe CLI",
  "identifiers": {},
  "images": [],
  "livemode": false,
  "metadata": {},
  "name": "My First Product",
  "package_dimensions": null,
  "price": null,
  "product_class": null,
  "shippable": null,
  "sku": "my-first-product-10",
  "statement_descriptor": null,
  "tax_code": null,
  "type": "service",
  "unit_label": null,
  "updated": 1668198126,
  "url": null
}
```

次に、[Create a price (価格作成) API](https://docs.stripe.com/api/prices/create.md) を呼び出して、30 USD の価格を関連付けます。`product` のプレースホルダーを商品 ID (例: `prod_LTenIrmp8Q67sa`) に入れ替えます。

#### bash

```bash
stripe prices create \
  --unit-amount=3000 \
  --currency=usd \
  --product="{{PRODUCT_ID}}"
```

すべて正常に機能する場合、コマンドラインに以下のレスポンスが表示されます。

#### bash

```json
{
  "id": "price_1KzlAMJJDeE9fu01WMJJr79o", // ID は次のようになります。
  "object": "price",
  "active": true,
  "billing_scheme": "per_unit",
  "created": 1652636348,
  "currency": "usd",
  "livemode": false,
  "lookup_key": null,
  "metadata": {},
  "nickname": null,
  "product": "prod_Lh9iTGZhb2mcBy",
  "recurring": null,
  "tax_behavior": "unspecified",
  "tiers_mode": null,
  "transform_quantity": null,
  "type": "one_time",
  "unit_amount": 3000,
  "unit_amount_decimal": "3000"
}
```

## サードパーティーの依存関係を管理する

サードパーティーの依存関係は、[Composer](https://getcomposer.org/download/) を使用して [Packagist](https://packagist.org/) から管理することをお勧めします。これらを使用すると、新規ライブラリを追加し、PHP プロジェクトに含めることができます。

### Composer をインストールする

コマンドラインから、手順に従って [Composer をダウンロードします](https://getcomposer.org/download/)。

## PHP のサーバー側 SDK をインストールする

最新バージョンの Stripe PHP サーバー側 SDK は、v20.0.0 です。PHP バージョン 5.6.0 以降をサポートします。

PHP バージョンを確認する

```bash
php --version
```

### ライブラリをインストールする

PHP のパッケージマネージャーである [Composer](http://getcomposer.org/) でライブラリをインストールします。

```bash
composer require stripe/stripe-php
```

Composer を使用してライブラリをインストールすると、ライブラリはプロジェクトの composer.json ファイルに自動的に依存関係として追加されます。以下に例を示します。

```json
{
    "require": {
        "stripe/stripe-php": "^20.0.0"
    }
}
```

バインディングを使用するには、Composer の [autoload](https://getcomposer.org/doc/01-basic-usage.md#autoloading) を使用します。以下に例を示します。

```php
require_once('vendor/autoload.php');
```

### インストールの代替手段

**手動インストール**

バインディングを使用できるように[最新リリースをダウンロード](https://github.com/stripe/stripe-php/releases)し、以下のように init.php ファイルを含めることができます。

```php
require_once('/path/to/stripe-php/init.php');
```

続いて、次の拡張機能を追加します。[cURL](https://secure.php.net/manual/en/book.curl.php) (または、オプションで curl 以外の独自クライアントを使用します) [json](https://secure.php.net/manual/en/book.json.php) [mbstring](https://secure.php.net/manual/en/book.mbstring.php)

## 最初の SDK リクエストを実行する

これで、PHP SDK がインストールされ、サブスクリプションの [Product (商品)](https://docs.stripe.com/api/products/create.md) を作成し、いくつかの API リクエストに [Price (価格)](https://docs.stripe.com/api/prices/create.md) を関連付けられるようになりました。この例では、Product のレスポンスで返された商品 ID を使用して価格を作成しています。

> #### API キーのベストプラクティス
> 
> このサンプルでは、*サンドボックス* (A sandbox is an isolated test environment that allows you to test Stripe functionality in your account without affecting your live integration. Use sandboxes to safely experiment with new features and changes)環境で、Stripe ユーザー[アカウント](https://docs.stripe.com/get-started/account/set-up.md)のデフォルトキーを使用します。これらの値を表示できるのはお客様のみです。キーを安全に管理するため、[ベストプラクティス](https://docs.stripe.com/keys-best-practices.md)に従ってください。

#### 商品と価格を作成する

```php
<?php
require_once('vendor/autoload.php');

# Don't embed any keys in production code. This is an example.
# See https://docs.stripe.com/keys-best-practices.
$stripe = new \Stripe\StripeClient("sk_test_09l3shTSTKHYCzzZZsiLl2vA");

$product = $stripe->products->create([
  'name' => 'Starter Subscription',
  'description' => '$12/Month subscription',
]);
echo "Success! Here is your starter subscription product id: " . $product->id . "\n";

$price = $stripe->prices->create([
  'unit_amount' => 1200,
  'currency' => 'usd',
  'recurring' => ['interval' => 'month'],
  'product' => $product['id'],
]);
echo "Success! Here is your starter subscription price id: " . $price->id . "\n";

?>
```

ファイルを `create_price.php` という名前で保存します。コマンドラインから、保存したファイルが含まれるディレクトリーに `cd` で移動し、以下のコマンドを実行します。

#### create_price.php

```bash
php create_price.php

```

すべて正常に機能する場合、コマンドラインに以下のレスポンスが表示されます。実装を構築する際に使用できるように、これらの ID を保存します。

#### bash

```bash
Success! Here is your starter subscription product id: price_0KxBDl589O8KAxCG1alJgiA6
Success! Here is your starter subscription price id: price_0KxBDm589O8KAxCGMgG7scjb
```

## See also

クイックスタートは以上です。以下のリンクでは、作成した商品の支払いを処理する方法をいくつか紹介しています。

- [決済用のリンクを作成する](https://docs.stripe.com/payment-links.md)
- [Stripe がオンラインで提供するページ](https://docs.stripe.com/checkout/quickstart.md)
- [高度な連携](https://docs.stripe.com/payments/quickstart-checkout-sessions.md)


# .NET

> This is a .NET for when lang is dotnet. View the full page at https://docs.stripe.com/get-started/development-environment?lang=dotnet.

このクイックスタートでは、[Stripe CLI](https://docs.stripe.com/stripe-cli.md) (Stripe 統合へのコマンドラインアクセスを可能にする重要なツール) をインストールします。また、[Stripe .NET サーバーサイド SDK](https://github.com/stripe/stripe-dotnet) を使用して、C\# で記述されたアプリケーションから Stripe API にアクセスします。

## 学習内容

このクイックスタートでは以下について説明します。

- コードを記述することなく Stripe API を呼び出す方法
- .NET Core CLI、NuGet CLI、またはパッケージマネージャーコンソールを使用してサードパーティーの依存関係を管理する方法
- 最新の Stripe .NET SDK v51.0.0 をインストールする方法
- 最初の SDK リクエストを送信する方法

## 初期セットアップ

まず、[Stripe アカウントを作成する](https://dashboard.stripe.com/register)か[サインイン](https://dashboard.stripe.com/login)します。

## Stripe CLI を設定する

### インストール

コマンドラインから、インストールスクリプトを使用するか、オペレーティングシステムのバージョン管理されたアーカイブファイルをダウンロードして展開し、CLI をインストールします。

#### homebrew

[homebrew](https://brew.sh/) で Stripe CLI をインストールするには、以下を実行します。

```bash
brew install stripe/stripe-cli/stripe
```

このコマンドを Linux バージョンの Homebrew で実行すると失敗しますが、代替手段を使用するか、Linux タブの指示に従ってこれを完了させることは可能です。

```bash
brew install stripe-cli
```

#### apt

> CLI の Debian ビルドは JFrog(https://packages.stripe.dev,) で利用可能ですが、これは Stripe が所有するドメインではありません。この URL にアクセスすると、JFrog アーティファクトリーのリストにリダイレクトされます。

Debian および Ubuntu ベースのディストリビューションに Stripe CLI をインストールする方法は以下のとおりです。

1. Stripe CLI の GPG キーを apt ソースのキーリングに追加します。

```bash
curl -s https://packages.stripe.dev/api/security/keypair/stripe-cli-gpg/public | gpg --dearmor | sudo tee /usr/share/keyrings/stripe.gpg > /dev/null
```

1. CLI の apt リポジトリーを apt ソースリストに追加します。

```bash
echo "deb [signed-by=/usr/share/keyrings/stripe.gpg] https://packages.stripe.dev/stripe-cli-debian-local stable main" | sudo tee -a /etc/apt/sources.list.d/stripe.list
```

1. パッケージリストを更新します。

```bash
sudo apt update
```

1. CLI をインストールします。

```bash
sudo apt install stripe
```

#### yum

> CLI の RPM ビルドは JFrog(https://packages.stripe.dev,) で利用可能ですが、これは Stripe が所有するドメインではありません。この URL にアクセスすると、JFrog アーティファクトリーのリストにリダイレクトされます。

RPM ベースのディストリビューションに Stripe CLI をインストールする方法は以下のとおりです。

1. CLI の yum リポジトリーを yum ソースリストに追加します。

```bash
echo -e "[Stripe]\nname=stripe\nbaseurl=https://packages.stripe.dev/stripe-cli-rpm-local/\nenabled=1\ngpgcheck=0" >> /etc/yum.repos.d/stripe.repo
```

1. CLI をインストールします。

```bash
sudo yum install stripe
```

#### Scoop

[Scoop](https://scoop.sh/) で Stripe CLI をインストールするには、以下を実行します。

```bash
scoop bucket add stripe https://github.com/stripe/scoop-stripe-cli.git
```

```bash
scoop install stripe
```

#### macOS

homebrew なしで Stripe CLI を macOS にインストールする方法は以下のとおりです。

1. [GitHub](https://github.com/stripe/stripe-cli/releases/latest) から、ご使用の cpu アーキテクチャータイプの最新の `mac-os` tar.gz ファイルをダウンロードします。
1. `tar -xvf stripe_[X.X.X]_mac-os_[ARCH_TYPE].tar.gz` を使用して、ファイルを解凍します。

必要に応じて、グローバルに実行できる場所 (`/usr/local/bin` など) にバイナリをインストールします。

#### Linux

Package Manager なしで Stripe CLI を Linux にインストールする方法は以下のとおりです。

1. [GitHub](https://github.com/stripe/stripe-cli/releases/latest) から、最新の `linux` tar.gz ファイルをダウンロードします。
1. `tar -xvf stripe_X.X.X_linux_x86_64.tar.gz` を使用して、ファイルを解凍します。
1. `./stripe` を自身の実行パスに移動します。

#### Windows

Scoop なしで Stripe CLI を Windows にインストールする方法は、以下のとおりです。

1. [GitHub](https://github.com/stripe/stripe-cli/releases/latest) から、最新の `windows` zip ファイルをダウンロードします。
1. `stripe_X.X.X_windows_x86_64.zip` ファイルを解凍します。
1. 解凍した `stripe.exe` ファイルへのパスを `Path` 環境変数に追加します。環境変数の更新方法については、[Microsoft PowerShell のドキュメント](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_environment_variables?view=powershell-7.3#saving-changes-to-environment-variables)を参照してください。

> Windows のアンチウイルススキャナーは、Stripe CLI に「安全ではない」とフラグ付けすることがあります。これは偽陽性である可能性が高いです。詳細については、GitHub リポジトリの [issue #692](https://github.com/stripe/stripe-cli/issues/692) をご覧ください。

1. 解凍した `.exe` ファイルを実行します。

#### Docker

Stripe CLI は、[Docker イメージ](https://hub.docker.com/r/stripe/stripe-cli)としても使用できます。最新バージョンをインストールするには、以下を実行します。

```bash
docker run --rm -it stripe/stripe-cli:latest
```

### 認証

ログインして Stripe ユーザー[アカウント](https://docs.stripe.com/get-started/account/set-up.md)を認証すると、制限付きキーのセットを生成できます。詳細については、[Stripe CLI のキーと権限](https://docs.stripe.com/stripe-cli/keys.md)を参照してください。

```bash
  stripe login
```

キーボードの **Enter** キーを押して、ブラウザーでの認証プロセスを完了します。

```bash
Your pairing code is: enjoy-enough-outwit-win
This pairing code verifies your authentication with Stripe.
Press Enter to open the browser or visit https://dashboard.stripe.com/stripecli/confirm_auth?t=THQdJfL3x12udFkNorJL8OF1iFlN8Az1 (^C to quit)
```

### 設定を確定

CLI のインストールが完了し、[Create a product (商品作成) API](https://docs.stripe.com/api/products/create.md) への単一の API リクエストを作成できるようになりました。

#### bash

```bash
stripe products create \
--name="My First Product" \
--description="Created with the Stripe CLI"
```

レスポンスオブジェクトの `id` 内で商品 ID を探し、次のステップのために保存しておきます。

すべて正常に機能する場合、コマンドラインに以下のレスポンスが表示されます。

#### bash

```json
{
  "id": "prod_LTenIrmp8Q67sa", // ID は次のようになります。
  "object": "product",
  "active": true,
  "attributes": [],
  "created": 1668198126,
  "default_price": null,
  "description": "Created with the Stripe CLI",
  "identifiers": {},
  "images": [],
  "livemode": false,
  "metadata": {},
  "name": "My First Product",
  "package_dimensions": null,
  "price": null,
  "product_class": null,
  "shippable": null,
  "sku": "my-first-product-10",
  "statement_descriptor": null,
  "tax_code": null,
  "type": "service",
  "unit_label": null,
  "updated": 1668198126,
  "url": null
}
```

次に、[Create a price (価格作成) API](https://docs.stripe.com/api/prices/create.md) を呼び出して、30 USD の価格を関連付けます。`product` のプレースホルダーを商品 ID (例: `prod_LTenIrmp8Q67sa`) に入れ替えます。

#### bash

```bash
stripe prices create \
  --unit-amount=3000 \
  --currency=usd \
  --product="{{PRODUCT_ID}}"
```

すべて正常に機能する場合、コマンドラインに以下のレスポンスが表示されます。

#### bash

```json
{
  "id": "price_1KzlAMJJDeE9fu01WMJJr79o", // ID は次のようになります。
  "object": "price",
  "active": true,
  "billing_scheme": "per_unit",
  "created": 1652636348,
  "currency": "usd",
  "livemode": false,
  "lookup_key": null,
  "metadata": {},
  "nickname": null,
  "product": "prod_Lh9iTGZhb2mcBy",
  "recurring": null,
  "tax_behavior": "unspecified",
  "tiers_mode": null,
  "transform_quantity": null,
  "type": "one_time",
  "unit_amount": 3000,
  "unit_amount_decimal": "3000"
}
```

## .NET のサーバー側 SDK をインストールする

最新バージョンの Stripe .NET サーバー側 SDK は、v51.0.0 です。.NET Standard 2.0 以降、.NET Core 2.0 以降、.NET Framework 4.6.1 以降をサポートします。

ご利用の [.NET SDK](https://docs.microsoft.com/en-us/dotnet/core/install/how-to-detect-installed-versions) バージョンを確認します。

```bash
dotnet --list-sdks
```

### ライブラリをインストールする

コマンドラインから新規プロジェクトを作成するには、[.NET Core コマンドラインインターフェイス (CLI)](https://docs.microsoft.com/en-us/dotnet/core/tools/) を使用します。

```bash
dotnet new console
```

ライブラリをインストールするには、以下のコマンドを実行して、プロジェクトファイル (`.csproj`) にパッケージ参照を追加します。

```bash
dotnet add package Stripe.net
```

CLI を使用してライブラリをインストールすると、ライブラリはプロジェクトファイル (`.csproj`) に自動的に依存関係として追加されます。以下に例を示します。

```xml
<Project Sdk="Microsoft.NET.Sdk">

  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net6.0</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="Stripe.net" Version="51.0.0" />
  </ItemGroup>

</Project>
```

### インストールの代替手段

**NuGet コマンドラインインターフェイス (CLI)**: [NuGet CLI](https://docs.microsoft.com/en-us/nuget/tools/nuget-exe-cli-reference) を使用してライブラリをインストールできます。

```bash
nuget install Stripe.net
```

**パッケージマネージャーコンソール (PowerShell)**: [パッケージマネージャーコンソール (PowerShell)](https://docs.microsoft.com/en-us/nuget/tools/package-manager-console) を使用している場合は、以下のコマンドを実行してライブラリをインストールします。

```PowerShell
Install-Package Stripe.net
```

**VisualStudio**: Visual Studio に Stripe.net パッケージを追加するには、次を実行します。ソリューションエクスプローラーを開きます。**Manage NuGet Packages (NuGet パッケージの管理)** をクリックします。**Browse (参照)** タブをクリックして、**Stripe.net** を検索します。**Stripe.net** パッケージをクリックし、タブで適切なバージョンを選択して、**インストール**をクリックします。

## 最初の SDK リクエストを実行する

これで、.NET SDK がインストールされ、サブスクリプションの [Product (商品)](https://docs.stripe.com/api/products/create.md) を作成し、いくつかの API リクエストに [Price (価格)](https://docs.stripe.com/api/prices/create.md) を関連付けられるようになりました。この例では、Product のレスポンスで返された商品 ID を使用して価格を作成しています。

> #### API キーのベストプラクティス
> 
> このサンプルでは、*サンドボックス* (A sandbox is an isolated test environment that allows you to test Stripe functionality in your account without affecting your live integration. Use sandboxes to safely experiment with new features and changes)環境で、Stripe ユーザー[アカウント](https://docs.stripe.com/get-started/account/set-up.md)のデフォルトキーを使用します。これらの値を表示できるのはお客様のみです。キーを安全に管理するため、[ベストプラクティス](https://docs.stripe.com/keys-best-practices.md)に従ってください。

#### 商品と価格を作成する

```dotnet
using System;
using Stripe;

class Program
{
  static void Main(string[] args)
  {
    // Don't embed any keys in production code. This is an example.
    // See https://docs.stripe.com/keys-best-practices.
    var client = new StripeClient("sk_test_09l3shTSTKHYCzzZZsiLl2vA");

    var optionsProduct = new ProductCreateOptions
    {
      Name = "Starter Subscription",
      Description = "$12/Month subscription",
    };
    Product product = client.V1.Products.Create(optionsProduct);
    Console.Write("Success! Here is your starter subscription product id: {0}\n", product.Id);

    var optionsPrice = new PriceCreateOptions
    {
      UnitAmount = 1200,
      Currency = "usd",
      Recurring = new PriceRecurringOptions
      {
          Interval = "month",
      },
      Product = product.Id
    };
    Price price = client.V1.Prices.Create(optionsPrice);
    Console.Write("Success! Here is your starter subscription price id: {0}\n", price.Id);
  }
}
```

コードをプロジェクトの `Program.cs` ファイルに保存します。コマンドラインから、保存したファイルが含まれるディレクトリーに `cd` で移動し、以下のコマンドを実行します。

#### Program.cs

```bash
dotnet run
```

すべて正常に機能する場合、コマンドラインに以下のレスポンスが表示されます。実装を構築する際に使用できるように、これらの ID を保存します。

#### bash

```bash
Success! Here is your starter subscription product id: prod_0KxBDl589O8KAxCG1alJgiA6
Success! Here is your starter subscription price id: price_0KxBDm589O8KAxCGMgG7scjb
```

## See also

クイックスタートは以上です。以下のリンクでは、作成した商品の支払いを処理する方法をいくつか紹介しています。

- [決済用のリンクを作成する](https://docs.stripe.com/payment-links.md)
- [Stripe がオンラインで提供するページ](https://docs.stripe.com/checkout/quickstart.md)
- [高度な連携](https://docs.stripe.com/payments/quickstart-checkout-sessions.md)

