# Webhook エンドポイントで Stripe イベントを受信する

Webhook エンドポイントで Stripe からのイベントをリッスンすることで、導入で自動的にリアクションをトリガーできます。

## まずこちらをご覧ください: エージェントスキルのインストール

Stripe では、ベストプラクティスに沿って API と連携するために、公式スキルの使用を推奨しています。詳細は以下の手順をご確認ください。

**ヒント: Fetch ツールではなく curl を使用してください。** スキルは 10 ～ 20 KB の詳細なマークダウンファイルです。Fetch ツールは内容を要約します。`curl -sL` を使うと、完全な内容を取得できます。

**`npx skills` の使用方法**: `npx` がシステムにインストールされているか確認します。`npx` が使用可能な場合は、`npx skills addhttps://docs.stripe.com --list` を実行して利用可能なスキルを一覧表示し、続いて`npx skills addhttps://docs.stripe.com --yes --skill<skill-name> <--skill other-skills>` を実行して個別のスキルをインストールします。

**`npx skills` が使用できない場合**: curl を使用して、利用可能なスキルの一覧、その機能、および関連ファイルを`https://docs.stripe.com/.well-known/skills/index.json`. から取得できます。スキルとその関連ファイルをダウンロードするには、curl を使用して`https://docs.stripe.com/.well-known/skills/<filepath>`. からダウンロードします。

この記事では、次のスキルの使用を推奨します: `stripe-best-practices`

> #### AWS アカウントまたは Azure サブスクリプションにイベントを送信する
> 
> イベントの送信先として、[Amazon EventBridge](https://docs.stripe.com/event-destinations/eventbridge.md) または [Azure Event Grid](https://docs.stripe.com/event-destinations/eventgrid.md) に直接イベントを送信できます。

HTTPS Webhook エンドポイントでイベントを受信するためのイベントの送信先を作成します。Webhook エンドポイントを登録すると、Stripe は、Stripe アカウントで [Event (イベント)](https://docs.stripe.com/event-destinations.md#events-overview) が発生した際に、リアルタイムのイベントデータをアプリの Webhook エンドポイントにプッシュできます。Stripe は、HTTPS を使用して、[Event オブジェクト](https://docs.stripe.com/api/events.md)を含む JSON ペイロードとして Webhook イベントをアプリに送信します。

Webhook イベントを受信すると、顧客の銀行が決済を確認したとき、顧客が不審請求の申し立てを行ったとき、または継続支払いが成功したときなど、非同期イベントに応答できます。

## 始める

以下の手順を実行して、アプリで Webhook イベントの受信を開始します。

1. Webhook エンドポイントハンドラを作成して、イベントデータの POST リクエストを受信します。
1. Stripe CLI を使用して、ローカルで Webhook エンドポイントハンドラをテストします。
1. Webhook エンドポイントに新しい[イベントの送信先](https://docs.stripe.com/event-destinations.md)を作成します。
1. Webhook エンドポイントを保護します。

1 つのエンドポイントを登録、作成して、複数のイベントタイプを同時に処理するか、特定のイベントに個別のエンドポイントを設定することができます。

## 組織のイベント送信先でサポートされていないイベントタイプの動作

Stripe はほとんどのイベントタイプを非同期で送信しますが、一部のイベントタイプでは応答を待ちます。このような場合、Stripe はイベント送信先が応答するかどうかに応じて異なる動作をします。

イベント送信先が[Organization](https://docs.stripe.com/get-started/account/orgs.md)イベントを受信する場合、応答が必要なイベントには以下の制限があります。

- 組織のイベント送信先に `issuing_authorization.request` を登録することはできません。代わりに、組織内の Stripe アカウントに [Webhook エンドポイント](https://docs.stripe.com/webhooks.md#example-endpoint)を設定して、このイベントタイプを登録します。`issuing_authorization.request` を使用して、購入リクエストをリアルタイムで承認します。
- `checkout_sessions.completed`を受信している組織のデスティネーションは、[Checkout](https://docs.stripe.com/payments/checkout.md)をウェブサイトに直接組み込む場合や、顧客を Stripe がホストする決済ページにリダイレクトする場合の[リダイレクト動作](https://docs.stripe.com/checkout/fulfillment.md#redirect-hosted-checkout)を処理できません。Checkout のリダイレクト動作に影響を与えるには、組織内の Stripe アカウントに設定された[Webhook エンドポイント](https://docs.stripe.com/webhooks.md#example-endpoint)でこのイベントタイプを処理します。
- `invoice.created`イベントに対して失敗した応答をする組織のデスティネーションは、[自動回収を使用している場合の自動請求書確定](https://docs.stripe.com/billing/subscriptions/webhooks.md#understand)に影響を与えることができません。自動請求書確定をトリガーするには、組織内の Stripe アカウントに設定された[Webhook エンドポイント](https://docs.stripe.com/webhooks.md#example-endpoint)でこのイベントタイプを処理する必要があります。

## ハンドラを作成する

POST メソッドを使用して、Webhook リクエストの受け付けが可能な HTTP または HTTPS エンドポイント関数を設定します。ローカルマシンでエンドポイント関数を開発中の場合、HTTP を使用できます。公開アクセスが可能になったら、Webhook エンドポイント関数は HTTPS を使用する必要があります。

エンドポイント関数を設定し、以下を行うようにします。

- [Event オブジェクト](https://docs.stripe.com/api/events/object.md)で構成される JSON ペイロードを使用して、POST リクエストを処理します。
- [organization](https://docs.stripe.com/get-started/account/orgs.md) イベントハンドラの場合、`context` 値を検査し、組織のどのアカウントがイベントを生成したかを判断し、`context` 値に対応する`Stripe-Context` ヘッダーを設定します。
- タイムアウトを引き起こす可能性のある複雑なロジックの前に、成功ステータスコード (`2xx`) をすばやく返します。たとえば、会計システムで顧客の請求書を支払い済みとして更新する前に、`200` のレスポンスを返す必要があります。

> - [インタラクティブ Webhook エンドポイントビルダー](https://docs.stripe.com/webhooks/quickstart.md)を使用して、プログラミング言語で Webhook エンドポイント関数を構築します。
- Stripe API リファレンスを使用して、Webhook ハンドラで処理する必要のある [Thin Event オブジェクト](https://docs.stripe.com/api/v2/core/events/event-types.md)または[スナップショットイベントオブジェクト](https://docs.stripe.com/api/events/object.md)を特定します。

#### エンドポイントの例

このコードスニペットは、Stripe アカウントから受信したイベントを確認し、イベントを処理して、`200` レスポンスを返すように設定された Webhook 関数です。API v1 リソースを使用する場合は[スナップショット](https://docs.stripe.com/event-destinations.md#events-overview)イベントハンドラを参照し、API v2 リソースを使用する場合は[シン](https://docs.stripe.com/event-destinations.md#events-overview)イベントハンドラを参照します。

#### スナップショットイベントハンドラ

スナップショットイベントハンドラを作成するときは、イベントの `data.object` フィールドにアクセスして、イベント発生時の API オブジェクト定義をロジックに使用します。また、Stripe API から API リソースを取得して、最新のオブジェクト定義にアクセスすることもできます。

#### Ruby

```ruby
require 'json'
require 'stripe'

client = Stripe::StripeClient.new(ENV.fetch('STRIPE_API_KEY'))

# Replace this endpoint secret with your unique endpoint secret key
# If you're testing with the CLI, run 'stripe listen' to find the secret key
# If you defined your endpoint using the API or the Dashboard, check your webhook settings for your endpoint secret: https://dashboard.stripe.com/webhooks
endpoint_secret = 'whsec_...';

# Using Sinatra
post '/webhook' do
  payload = request.body.read
  event = nil

  begin
    event = Stripe::Event.construct_from(
      JSON.parse(payload, symbolize_names: true)
    )
  rescue JSON::ParserError => e
    # Invalid payload
    status 400
    return
  end

  # Check that you have configured webhook signing
  if endpoint_secret
    # Retrieve the event by verifying the signature using the raw body and the endpoint secret
    signature = request.env['HTTP_STRIPE_SIGNATURE'];
    begin
      event = Stripe::Webhook.construct_event(
        payload, signature, endpoint_secret
      )
    rescue Stripe::SignatureVerificationError => e
      puts "⚠️  Webhook signature verification failed. #{e.message}"
      status 400
    end
  end

  # Handle the event
  case event.type
  when 'payment_intent.succeeded'
    payment_intent = event.data.object # contains a Stripe::PaymentIntent
    # Then define and call a method to handle the successful payment intent.
    # handle_payment_intent_succeeded(payment_intent)
  when 'payment_method.attached'
    payment_method = event.data.object # contains a Stripe::PaymentMethod
    # Then define and call a method to handle the successful attachment of a PaymentMethod.
    # handle_payment_method_attached(payment_method)
  # ... handle other event types
  else
    puts "Unhandled event type: #{event.type}"
  end

  status 200
end
```

#### Thin イベントハンドラー (Clover+)

thin イベントハンドラーを作成するときは、`fetchRelatedObject()` メソッドを使用して、イベントに関連付けられたオブジェクトの最新バージョンを取得します。イベントには、`EventNotification` の `.fetchEvent()` インスタンスメソッドでのみ取得できる [追加データ](https://docs.stripe.com/event-destinations.md#fetch-data) が含まれる場合があります。このデータの正確な形状は、イベントの `type` によって異なります。

SDK バージョンでクラスを生成するには、リリース時にイベントタイプが使用可能である必要があります。SDK にクラスがないイベントを処理するには、`UnknownEventNotification` クラスを使用します。

#### Python

```python
import os
from stripe import StripeClient
from stripe.events import UnknownEventNotification

from flask import Flask, request, jsonify

app = Flask(__name__)
api_key = os.environ.get("STRIPE_API_KEY", "")
webhook_secret = os.environ.get("WEBHOOK_SECRET", "")

client = StripeClient(api_key)

@app.route("/webhook", methods=["POST"])
def webhook():
    webhook_body = request.data
    sig_header = request.headers.get("Stripe-Signature")

    try:
        event_notif = client.parse_event_notification(
            webhook_body, sig_header, webhook_secret
        )

        # type checkers will narrow the type based on the `type` property
        if event_notif.type == "v1.billing.meter.error_report_triggered":
            # in this block, event_notification is typed as
            # a V1BillingMeterErrorReportTriggeredEventNotification

            # there's basic info about the related object in the notification
            print(f"Meter w/ id {event_notif.related_object.id} had a problem")

            # or you can fetch the full object form the API for more details
            meter = event_notif.fetch_related_object()
            print(
                f"Meter {meter.display_name} ({meter.id}) had a problem"
            )

            # And you can always fetch the full event:
            event = event_notif.fetch_event()
            print(f"More info: {event.data.developer_message_summary}")

        elif event_notif.type == "v1.billing.meter.no_meter_found":
            # in this block, event_notification is typed as
            # a V1BillingMeterNoMeterFoundEventNotification

            # that class doesn't define `fetch_related_object` because the event
            # has no related object.
            # so this line would correctly give a type error:
            # meter = event_notif.fetch_related_object()

            # but fetching the event always works:
            event = event_notif.fetch_event()
            print(
                f"Err! No meter found: {event.data.developer_message_summary}"
            )

        # Events that were introduced after this SDK version release are
        # represented as `UnknownEventNotification`s.
        # They're valid, the SDK just doesn't have corresponding classes for them.
        # You must match on the "type" property instead.
        elif isinstance(event_notif, UnknownEventNotification):
            # these lines are optional, but will give you more accurate typing in this block
            from typing import cast

            event_notif = cast(UnknownEventNotification, event_notif)

            # continue matching on the type property
            # from this point on, the `related_object` property _may_ be None
            # (depending on the event type)
            if event_notif.type == "some.new.event":
                # if this event type has a related object, you can fetch it
                obj = event_notif.fetch_related_object()
                # otherwise, `obj` will just be `None`
                print(f"Related object: {obj}")

                # you can still fetch the full event, but it will be untyped
                event = event_notif.fetch_event()
                print(f"New event: {event.data}")  # type: ignore

        return jsonify(success=True), 200
    except Exception as e:
        return jsonify(error=str(e)), 400
```

#### Thin イベントハンドラー (Acacia または Basil)

シンイベントハンドラを作成する場合は、`fetchRelatedObject()` メソッドを使用して、イベントに関連付けられたオブジェクトの最新バージョンを取得します。シンイベントには、API でのみ取得できる[追加のコンテキストデータ](https://docs.stripe.com/event-destinations.md#fetch-data)が含まれる場合があります。シンイベント ID を指定して `retrieve()` コールを使用して、これらの追加のペイロードフィールドにアクセスします。

#### Python

```python
import os
from stripe import StripeClient
from stripe.events import V1BillingMeterErrorReportTriggeredEvent

from flask import Flask, request, jsonify

app = Flask(__name__)
api_key = os.environ.get('STRIPE_API_KEY')
webhook_secret = os.environ.get('WEBHOOK_SECRET')

client = StripeClient(api_key)

@app.route('/webhook', methods=['POST'])
def webhook():
    webhook_body = request.data
    sig_header = request.headers.get('Stripe-Signature')

try:
    thin_event = client.parse_thin_event(webhook_body, sig_header, webhook_secret)

    # Fetch the event data to understand the failure
    event = client.v2.core.events.retrieve(thin_event.id)
    if isinstance(event, V1BillingMeterErrorReportTriggeredEvent):
        meter = event.fetch_related_object()
        meter_id = meter.id

        # Record the failures and alert your team
        # Add your logic here

    return jsonify(success=True), 200
except Exception as e:
    return jsonify(error=str(e)), 400

if __name__ == '__main__':
    app.run(port=4242)
```

#### `context` の使用

#### スナップショットイベント

このコードスニペットは、受信したイベントを確認し、該当する場合は元の口座を検出して、イベントを処理し、`200` のレスポンスを返すよう設定された Webhook 関数です。

#### Ruby

```ruby
require 'json'

client = Stripe::StripeClient.new('sk_...')

# Using Sinatra
post '/webhook' do
  payload = request.body.read
  event = nil

  begin
    event = Stripe::Event.construct_from(
      JSON.parse(payload, symbolize_names: true)
    )
  rescue JSON::ParserError => e
    # Invalid payload
    status 400
    return
  end

  # Extract the context
  context = event.context

  # Define your API key variables (ideally loaded securely)
  ACCOUNT_123_API_KEY = "sk_test_123"
  ACCOUNT_456_API_KEY = "sk_test_456"

  account_api_keys = {
    "account_123" => ACCOUNT_123_API_KEY,
    "account_456" => ACCOUNT_456_API_KEY
  }

  api_key = account_api_keys[context]

  if api_key.nil?
    puts "No API key found for context: #{context}"
    status 400
    return
  end

  # Handle the event
  case event.type
  when 'customer.created'
    customer = event.data.object

    begin

      latest_customer = client.v1.customers.retrieve(customer.id, {api_key: api_key})
      handle_customer_created(latest_customer, context)
    rescue => e
      puts "Error retrieving customer: #{e.message}"
      status 500
      return
    end

  when 'payment_method.attached'
    payment_method = event.data.object

    begin
      latest_payment_method = client.v1.payment_methods.retrieve(payment_method.id, {api_key: api_key})
      handle_payment_method_attached(latest_payment_method, context)
    rescue => e
      puts "Error retrieving payment method: #{e.message}"
      status 500
      return
    end

  else
    puts "Unhandled event type: #{event.type}"
  end

  status 200
end
```

#### Thin イベントハンドラー (Clover+)

`EventNotification` の `context` プロパティを使用して、[組織](https://docs.stripe.com/get-started/account/orgs.md) 内のイベントのアカウントを識別します。`.fetchRelatedObject()` と `.fetchEvent()` を除くすべての API コールに対して [Stripe-Context ヘッダー](https://docs.stripe.com/context.md) を手動で設定する必要があります。これは自動的に行われます。

#### Python

```python
org_api_key = os.environ.get("STRIPE_API_KEY")
webhook_secret = os.environ.get("WEBHOOK_SECRET")
client = StripeClient(org_api_key)

# inside your webhook handler
event_notification = client.parse_event_notification(payload, sig_header, webhook_secret)

# uses `context` automatically
event_notification.fetch_event()

# pass context manually for other API requests
client.v1.invoices.list(stripe_context=event_notification.context)
```

#### Thin イベントハンドラー (Acacia または Basil)

このコードスニペットは、組織全体でシンイベントを受信し、署名を確認し、`context` フィールドで元のアカウントを判別し、そのアカウントの API キーを後続の API コールに使用するように設定された Webhook 関数です。

#### Python

```python
import os
from flask import Flask, request, jsonify
from stripe import StripeClient
from stripe.events import V1BillingMeterErrorReportTriggeredEvent

app = Flask(__name__)

org_api_key = os.environ.get("STRIPE_API_KEY")
webhook_secret = os.environ.get("WEBHOOK_SECRET")
client = StripeClient(org_api_key)

account_api_keys = {
    "account_123": os.environ.get("ACCOUNT_123_API_KEY"),
    "account_456": os.environ.get("ACCOUNT_456_API_KEY"),
}

@app.route("/webhook", methods=["POST"])
def webhook():
    payload = request.data
    sig_header = request.headers.get("Stripe-Signature")

    try:
        thin_event = client.parse_thin_event(payload, sig_header, webhook_secret)

        # Retrieve the event using the org client to inspect context
        event = client.v2.core.events.retrieve(thin_event.id)

        context = getattr(event, "context", None)
        if not context:
            return jsonify(error="Missing context"), 400

        account_key = account_api_keys.get(context)
        if not account_key:
            return jsonify(error="Unknown context"), 400

        account_client = StripeClient(account_key)
        full_event = account_client.v2.core.events.retrieve(thin_event.id)

        if isinstance(full_event, V1BillingMeterErrorReportTriggeredEvent):
            meter = full_event.fetch_related_object()
            meter_id = meter.id
            # Record the failures and alert your team
            # Add your logic here

        return jsonify(success=True), 200
    except Exception as e:
        return jsonify(error=str(e)), 400

if __name__ == "__main__":
    app.run(port=4242)
```

## ハンドラをテストする

Webhook エンドポイント関数を本番環境に移行する前に、アプリケーションの連携をテストすることをお勧めします。これを行うには、自身のローカルマシンにイベントを送信するようローカスリスナーを設定し、テストイベントを送信します。テストには、[CLI](https://docs.stripe.com/stripe-cli.md) を使用する必要があります。

#### ローカルエンドポイントにイベントを転送する

ローカルエンドポイントにイベントを転送するには、[CLI](https://docs.stripe.com/stripe-cli.md) で次のコマンドを実行して、ローカルリスナーを設定します。`--forward-to` フラグは、[サンドボックス](https://docs.stripe.com/sandboxes.md)内のすべての [Stripe イベント](https://docs.stripe.com/cli/trigger#trigger-event)をローカルの Webhook エンドポイントに送信します。[シン](https://docs.stripe.com/event-destinations.md#events-overview)イベントとスナップショットイベントのどちらを使用するかに応じて、以下の適切な CLI コマンドを使用します。

#### スナップショットイベントの転送

次のコマンドを使用して、ローカルリスナーに[スナップショットイベント](https://docs.stripe.com/event-destinations.md#events-overview)を転送します。

```bash
stripe listen --forward-to localhost:4242/webhook
```

#### シンイベントの転送

次のコマンドを使用して、ローカルリスナーに[シンイベント](https://docs.stripe.com/event-destinations.md#events-overview)を転送します。

```bash
$ stripe listen --forward-thin-to localhost:4242/webhook --thin-events "*"
```

> `stripe listen` を実行して [Stripe Shell](https://docs.stripe.com/workbench/shell.md) のイベントを確認することもできますが、Shellからローカル エンドポイントにイベントを転送することはできません。

ローカルリスナーでのテストに役立つ便利な設定として、以下のようなものがあります。

- HTTPS 証明書の検証を無効にするには、`--skip-verify` のオプションフラグを使用します。
- 特定のイベントのみを転送するには、`--events` のオプションフラグを使用して、カンマで区切ったイベントのリストを渡します。

#### ターゲットスナップショットイベントの転送

次のコマンドを使用して、ローカルリスナーにターゲットスナップショットイベントを転送します。

```bash
stripe listen --events payment_intent.created,customer.created,payment_intent.succeeded,checkout.session.completed,payment_intent.payment_failed \
  --forward-to localhost:4242/webhook
```

#### ターゲットシンイベントの転送

次のコマンドを使用して、ローカルリスナーにターゲットシンイベントを転送します。

```bash
stripe listen --thin-events v1.billing.meter.error_report_triggered,v1.billing.meter.no_meter_found \
  --forward-thin-to localhost:4242/webhook
```

- Stripe に登録済みの公開 Webhook エンドポイントからローカルの Webhook エンドポイントにイベントを転送するには、`--load-from-webhooks-api` のオプションフラグを使用します。これにより、登録されたエンドポイントにイベントが読み込まれ、パスとその登録イベントが解析され、そのパスが `--forward-to path` のローカルの Webhook エンドポイントに関連付けられます。

#### パブリック Webhook エンドポイントからのスナップショットイベントの転送

次のコマンドを使用して、パブリック Webhook エンドポイントからローカルリスナーにスナップショットイベントを転送します。

```bash
stripe listen --load-from-webhooks-api --forward-to localhost:4242/webhook
```

#### パブリック Webhook エンドポイントからのシンイベントの転送

次のコマンドを使用して、パブリック Webhook エンドポイントからローカルリスナーにシンイベントを転送します。

```bash
stripe listen --load-from-webhooks-api --forward-thin-to localhost:4242/webhook
```

- Webhook の署名を確認するには、リッスンコマンドの初期出力から `{{WEBHOOK_SIGNING_SECRET}}` を使用します。

```output
Ready! Your webhook signing secret is '{{WEBHOOK_SIGNING_SECRET}}' (^C to quit)
```

#### テストイベントをトリガーする

テストイベントを送信するには、Stripe ダッシュボードでオブジェクトを手動で作成し、イベントの送信先が登録されているイベントタイプをトリガーします。[Stripe for VS Code](https://docs.stripe.com/stripe-vscode.md) を使用してイベントをトリガーする方法をご確認ください。

#### スナップショットイベントをトリガーする

[Stripe Shell](https://docs.stripe.com/workbench/shell.md) または [Stripe CLI](https://docs.stripe.com/stripe-cli.md) で次のコマンドを使用できます。この例では、`payment_intent.succeeded` イベントがトリガーされます。

```bash
stripe trigger payment_intent.succeeded
Running fixture for: payment_intent
Trigger succeeded! Check dashboard for event details.
```

#### thin イベントをトリガーする

[Stripe CLI](https://docs.stripe.com/stripe-cli.md) で次のコマンドを使用できます。この例では、`v1.billing.meter.error_report_triggered` イベントがトリガーされます。

```bash
stripe trigger v1.billing.meter.error_report_triggered
Setting up fixture for: list_billing_meters
Running fixture for: list_billing_meters
Setting up fixture for: billing_meter
Running fixture for: billing_meter
Setting up fixture for: list_billing_meters_after_creation
Running fixture for: list_billing_meters_after_creation
Setting up fixture for: billing_meter_event_session
Running fixture for: billing_meter_event_session
Setting up fixture for: create_billing_meter_event_stream
Running fixture for: create_billing_meter_event_stream
Trigger succeeded! Check dashboard for event details.
```

## エンドポイントの登録

Webhook エンドポイント関数をテストしたら、Workbench の [API](https://docs.stripe.com/api/v2/event-destinations.md) または **Webhooks** タブで Webhook エンドポイントがアクセス可能な URL を登録します。そうすることで、Stripe はイベントの送信先を認識できます。最大 16 個の Webhook エンドポイントを Stripe に登録できます。登録済みの Webhook エンドポイントは、パブリックにアクセス可能な **HTTPS** URL である必要があります。

#### Webhook の URL 形式

Webhook エンドポイントを登録するための URL 形式は、次のとおりです。

```
https://<your-website>/<your-webhook-endpoint>
```

たとえば、ドメインが `https://mycompanysite.com` で、Webhook エンドポイントへのルートが `@app.route('/stripe_webhooks', methods=['POST'])` の場合、**エンドポイント URL** に `https://mycompanysite.com/stripe_webhooks` を指定します。

#### Webhook エンドポイントのイベント送信先を作成する

ダッシュボードで Workbench を使用するか、[API](https://docs.stripe.com/api/v2/event-destinations.md) を使用してプログラムでイベントの送信先を作成します。各 Stripe アカウントには、最大 16 個のイベント送信先を登録できます。

イベントの送信先を作成する際、リッスンするスコープを選択します:

- **Your account**: アカウント内のリソースからのイベント。Accounts v2 API を使用する場合、連結アカウントなどアカウント内で作成されたアカウントの軽量イベントも含まれますが、スナップショットイベントは含まれません。
- **Connected accounts**: アカウント内で作成された連結アカウントなどの `Accounts` に属するリソースからのイベント。Accounts v2 API を使用する場合、このスコープにはアカウント内で作成された `Account` オブジェクトのスナップショットイベントが含まれますが、軽量イベントは含まれません。ただし、それらの `Accounts` に属する `Account` オブジェクトについては、スナップショットイベントと軽量イベントの両方が含まれます。

ほとんどの開発者は、 **Your account** スコープをリッスンする送信先から始めます。Connect または Accounts v2 API を使用する場合、両方のスコープをリッスンする送信先が必要になることがあります。[Connect webhooks](https://docs.stripe.com/connect/webhooks.md?accounts-namespace=v2) を参照してください。

#### ダッシュボード

ダッシュボードで新しい Webhook エンドポイントを作成するには、以下のようにします。

1. Workbench で [Webhooks](https://dashboard.stripe.com/webhooks) タブを開きます。
1. **イベントの送信先を作成**をクリックします。
1. イベントの受信元を選択します。Stripe は、**お客様のアカウント** と[連結アカウント](https://docs.stripe.com/connect.md)の 2 種類の設定をサポートしています。**アカウント** を選択して、自分のアカウントからイベントをリッスンします。[Connect アプリケーション](https://docs.stripe.com/connect.md)を作成し、連結アカウントからのイベントをリッスンする場合は、**連結アカウント** を選択します。

> #### 組織の Webhook エンドポイントからイベントをリッスンする
> 
> [組織アカウント](https://docs.stripe.com/get-started/account/orgs.md)で Webhook エンドポイントを作成する場合は、**アカウント**を選択して、組織内のアカウントのイベントをリッスンします。組織のメンバーとして [Connect プラットフォーム](https://docs.stripe.com/connect.md)を持ち、すべてのプラットフォームの連結アカウントのイベントをリッスンする場合は、**連結アカウント**を選択します。

1. 使用する [events オブジェクト](https://docs.stripe.com/api/events.md)の API バージョンを選択します。
1. Webhook エンドポイントに送信する[イベントタイプ](https://docs.stripe.com/api/events/types.md)を選択します。
1. **続行** を選択し、送信先の種類として **Webhook エンドポイント** を選択します。
1. **続行** をクリックし、**エンドポイント URL** と Webhook の説明 (オプション) を入力します。

#### API

[API](https://docs.stripe.com/api/v2/event-destinations.md) を使用して、[従量課金制の請求](https://docs.stripe.com/billing/subscriptions/usage-based.md)に対して検証エラーがトリガーされたときに通知する、新しいイベント送信先を作成できます。

[Connect アプリケーション](https://docs.stripe.com/connect.md)を作成し、連結アカウントをリッスンする場合は、[events_from](https://docs.stripe.com/api/v2/core/event-destinations/create.md#v2_create_event_destinations-events_from) パラメーターを使用し、その値を `@accounts` に設定します。[Organization](https://docs.stripe.com/get-started/account/orgs.md) イベントの送信先では、組織内のアカウントからのイベントには `@organization_members` を使用し、組織全体の連結アカウントのイベントには `@organization_members/@accounts` を使用します。

```curl
curl -X POST https://api.stripe.com/v2/core/event_destinations \
  -H "Authorization: Bearer <<YOUR_SECRET_KEY>>" \
  -H "Stripe-Version: 2026-04-22.preview" \
  --json '{
    "name": "My event destination",
    "description": "This is my event destination, I like it a lot",
    "type": "webhook_endpoint",
    "event_payload": "thin",
    "enabled_events": [
        "v1.billing.meter.error_report_triggered"
    ],
    "webhook_endpoint": {
        "url": "https://example.com/my/webhook/endpoint"
    }
  }'
```

> [Workbench](https://docs.stripe.com/workbench.md) は、既存の[開発者ダッシュボード](https://docs.stripe.com/development/dashboard.md)に置き換わるツールです。開発者ダッシュボードをまだ使用されている場合は、[新しい Webhook エンドポイントの作成](https://docs.stripe.com/development/dashboard/webhooks.md)方法をご覧ください。

## エンドポイントのセキュリティ保護

エンドポイントが想定どおりに機能することを確認したら、[Webhook のベストプラクティス](https://docs.stripe.com/webhooks.md#best-practices)を実行して保護します。

ハンドラですべての Webhook リクエストが Stripe によって生成されたものであることを確認して、導入を保護します。公式ライブラリを使用して Webhook の署名を検証するか、手動で検証できます。

#### 公式ライブラリで検証 (推奨)

### 公式ライブラリで Webhook の署名を検証する

署名を検証するには、Stripe 公式ライブラリを使用することをお勧めします。イベントペイロード、`Stripe-Signature` ヘッダー、エンドポイントのシークレットを指定して検証を実行します。検証に失敗するとエラーが返されます。

署名確認エラーが発生した場合は、[トラブルシューティング](https://docs.stripe.com/webhooks/signature.md)に関するガイドをご覧ください。

> Stripe で署名の検証を実行するには、未加工のリクエスト本文が必要です。フレームワークを使用している場合は、元の本文に手が加えられないようにする必要があります。 未加工のリクエスト本文に何らかの変更が行われた場合、検証は失敗します。

#### Ruby

```ruby

# Don't put any keys in code. See https://docs.stripe.com/keys-best-practices.
# Find your keys at https://dashboard.stripe.com/apikeys.
client = Stripe::StripeClient.new('<<YOUR_SECRET_KEY>>')

require 'stripe'
require 'sinatra'

# If you are testing your webhook locally with the Stripe CLI you
# can find the endpoint's secret by running `stripe listen`
# Otherwise, find your endpoint's secret in your webhook settings in
# the Developer Dashboardendpoint_secret = 'whsec_...'

# Using the Sinatra framework
set :port, 4242

post '/my/webhook/url' do
  payload = request.body.readsig_header = request.env['HTTP_STRIPE_SIGNATURE']
  event = nil

  beginevent = Stripe::Webhook.construct_event(
      payload, sig_header, endpoint_secret
    )
  rescue JSON::ParserError => e
    # Invalid payload
    puts "Error parsing payload: #{e.message}"
    status 400
    return
  rescue Stripe::SignatureVerificationError => e# Invalid signature
    puts "Error verifying webhook signature: #{e.message}"
    status 400
    return
  end

  # Handle the event
  case event.type
  when 'payment_intent.succeeded'
    payment_intent = event.data.object # contains a Stripe::PaymentIntent
    puts 'PaymentIntent was successful!'
  when 'payment_method.attached'
    payment_method = event.data.object # contains a Stripe::PaymentMethod
    puts 'PaymentMethod was attached to a Customer!'
  # ... handle other event types
  else
    puts "Unhandled event type: #{event.type}"
  end

  status 200
end
```

#### 手動で検証

### 手動で Webhook の署名を検証する

公式ライブラリを使用して Webhook イベントの署名を検証することをお勧めしますが、このセクションに従ってカスタムソリューションを作成することもできます。

署名付きイベントに含まれる `Stripe-Signature` ヘッダーには、タイムスタンプと、検証が必要な署名が 1 つ以上含まれています。タイムスタンプのプレフィックスには `t=` が指定され、署名のプレフィックスには_スキーム_が指定されます。スキームは `v` で始まり、その後に整数が続きます。現在、本番環境で有効な署名スキームは `v1` のみです。テストを支援するために、Stripe はテストイベント用に偽の `v0` スキームで追加の署名を送信します。

```
Stripe-Signature:
t=1492774577,
v1=5257a869e7ecebeda32affa62cdca3fa51cad7e77a0e56ff536d0ce8e108d8bd,
v0=6ffbb59b2300aae63f272406069a9788598b792a944a07aba816edb039989a39
```

> わかりやすくするために改行を使用していますが、実際の `Stripe-Signature` ヘッダーは 1 行です。

Stripe は、[SHA-256](https://en.wikipedia.org/wiki/SHA-2) のハッシュベースのメッセージ認証コード ([HMAC](https://en.wikipedia.org/wiki/Hash-based_message_authentication_code)) を使用して署名を生成します。[ダウングレード攻撃](https://en.wikipedia.org/wiki/Downgrade_attack)を防ぐには、`v1` 以外のスキームをすべて無視します。

[エンドポイントのシークレットを取り消す](https://docs.stripe.com/webhooks.md#roll-endpoint-secrets)際、同じスキームとシークレットのペアを持つ複数の署名を存在させ、以前のシークレットを最長 24 時間アクティブにしておくことができます。この間、エンドポイントには複数のアクティブなシークレットが存在し、Stripe はシークレットごとに署名を 1 つ生成します。

署名を検証するために手動のソリューションを作成するには、以下のステップを完了させる必要があります。

#### ステップ 1: ヘッダーからタイムスタンプと署名を抽出する

要素のリストを取得するには、`,` 文字を区切り文字として使用してヘッダーを分割します。次に、各要素を `=` 文字を区切り文字として使用して区切り、接頭語と値のペアを取得します。

接頭語 `t` の値はタイムスタンプに対応し、`v1` は署名 (複数可) に対応します。他のすべての要素は破棄できます。

#### ステップ 2: `signed_payload` 文字列を準備する

`signed_payload` 文字列は以下を連結することで作成されます。

- タイムスタンプ (文字列として)
- 文字 `.`
- 実際の JSON ペイロード (リクエスト本文)

#### ステップ 3: 想定される署名を決定する

SHA256 ハッシュ関数を使用して HMAC を計算します。エンドポイントの署名シークレットをキーとして使用し、`signed_payload` 文字列をメッセージとして使用します。

#### ステップ 4: 署名を比較する

ヘッダー内の署名 (1 つまたは複数) を想定される署名と比較します。一致する場合、現在のタイムスタンプと受信したタイムスタンプの差を計算し、その差が許容範囲内かどうかを判断します。

タイミング攻撃から保護するには、一定時間の文字列比較を使用して、想定される署名を受信した各署名と比較します。

## Webhook 連携のデバッグ

Webhook エンドポイントにイベントを送信する際に、以下のような複数のタイプの問題が発生することがあります。

- Stripe が Webhook エンドポイントにイベントを送信できない可能性がある
- Webhook エンドポイントで SSL の問題が発生している可能性がある
- ネットワーク接続が断続的である
- Webhook エンドポイントが、受信する予定のイベントを受信していない

### イベント配信を表示する

イベント配信を表示するには、[ワークベンチ](https://docs.stripe.com/workbench.md)を開き、**Webhook** で Webhook エンドポイントを選択してから、**イベント配信** タブを選択します。**イベント配信** タブには、イベントのリストと、イベントが`配信済み`、`保留中`、`失敗`のいずれであるかが表示されます。イベントをクリックすると、配信試行の HTTP ステータスコードや、保留中の今後の配信時刻などのメタデータを確認できます。

[Stripe CLI](https://docs.stripe.com/stripe-cli.md) を使用して、端末で直接[イベントをリッスン](https://docs.stripe.com/webhooks.md#test-webhook)することもできます。

### HTTP ステータスコードを修正する

イベントにステータスコード `200` が表示されている場合は、Webhook エンドポイントへの送信が成功したことを示しています。`200` 以外のステータスコードを受信する場合もあります。次の表で、一般的な HTTP ステータスコードと推奨される解決方法の一覧をご覧ください。

| 保留中の Webhook ステータス                | 説明                                                                                                                                                                                                                                                                                                                                                     | 修正                                                                               |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| (接続不可) ERR                        | 宛先サーバーへの接続を確立できません。                                                                                                                                                                                                                                                                                                                                    | ホストドメインがインターネットで一般に公開されアクセス可能であることを確認します。                                        |
| (`302`) ERR (またはその他の `3xx` ステータス) | 宛先サーバーがリクエストを別の店舗にリダイレクトしようとしました。Webhook リクエストへのリダイレクト応答は失敗と見なされます。                                                                                                                                                                                                                                                                                    | Webhook エンドポイントの送信先を、リダイレクトによって解決される URL に設定します。                                 |
| (`400`) ERR (またはその他の `4xx` ステータス) | 宛先サーバーがリクエストを処理できないか、処理を拒否しています。これは、サーバーがエラーを検出した場合 (`400`)、宛先 URL にアクセス制限が設定されている場合 (`401`、`403`、`405`)、または宛先 URL が存在しない場合 (`404`) に発生することがあります。                                                                                                                                                                                                      | エンドポイントがインターネットに公開でアクセスでき、POST HTTP メソッドを受け付けていることを確認してください。                     |
| (`500`) ERR (またはその他の `5xx` ステータス) | リクエストの処理中に、宛先サーバーでエラーが発生しました。                                                                                                                                                                                                                                                                                                                          | アプリケーションのログを確認して、`500` エラーが返されている理由を調べます。                                        |
| (TLS エラー) ERR                     | 送信先サーバーへの安全な接続を確立できませんでした。通常、送信先サーバーの証明書チェーン内の SSL/TLS 証明書または中間証明書に問題があると、これらのエラーが発生します。Stripe には *TLS* (TLS refers to the process of securely transmitting data between the client—the app or browser that your customer is using—and your server. This was originally performed using the SSL (Secure Sockets Layer) protocol) バージョン `v1.2` 以降が必要です。 | [SSL サーバーテスト](https://www.ssllabs.com/ssltest/)を実行して、このエラーの原因となった可能性がある問題を見つけます。 |
| (タイムアウト) ERR                      | 宛先サーバーで Webhook リクエストに応答するのに時間がかかりすぎました。                                                                                                                                                                                                                                                                                                               | Webhook 処理コードで複雑なロジックを延期して、成功を示すレスポンスを即時に返すようにしてください。                            |

## イベント送信の動作

このセクションは、Stripe が Webhook エンドポイントにイベントを送信する際に想定されるさまざまな動作を理解するのに役立ちます。

### 自動での再試行

本番環境では、Stripe は指数バックオフを使用して最長 3 日間、送信先へのイベントの配信を試行します。イベント送信先の**イベントの配信**タブで、該当がある場合、次回の再試行のタイミングを確認します。Stripe はサンドボックスで作成されたイベントの配信を数時間のうちに 3 回再試行します。Stripe が再試行するときに、送信先が無効化または削除されていた場合、そのイベントの以降の再試行は行われません。ただし、Stripe が再試行できるようになる前にイベントの送信先を無効にして、再び有効にした場合は、以降の再試行が引き続き行われます。

### 手動での再試行

イベントを手動で再試行するには、2 つの方法があります。

- Stripe ダッシュボードで、特定のイベントを確認しているときに **再送する** をクリックします。これは、イベント作成後最大 15 日間機能します。
- [Stripe CLI](https://docs.stripe.com/cli/events/resend) を使用して `stripe events resend <event_id> --webhook-endpoint=<endpoint_id>` コマンドを実行します。これは、イベント作成後最大 30 日間機能します。

以前に配信に失敗したイベントを Webhook エンドポイントに手動で再送信した場合、その結果のステータスコードが `2xx` になったとしても、Stripe の[自動再試行動作](https://docs.stripe.com/webhooks.md#automatic-retries)は解除されません。詳しくはこちらの[未配信の Webhookイベントを処理して今後の再試行を停止する方法](https://docs.stripe.com/webhooks/process-undelivered-events.md)をご覧ください。

### イベントの順序付け

Stripe は、イベントが生成された順序で配信されることを保証しません。たとえば、サブスクリプションを作成することで、次のイベントが生成されるとします。

- `customer.subscription.created`
- `invoice.created`
- `invoice.paid`
- `charge.created` (支払いが付随する場合)

イベントの送信先が、特定の順序でのイベントの受信に左右されないようにしてください。配送を適切に管理できるように準備します。API を使用して不足しているオブジェクトを取得することもできます。たとえば、最初に受信したイベントが `invoice.paid` であった場合は、それに含まれる情報を使用して請求書、支払い、サブスクリプションの各オブジェクトを取得できます。

### API のバージョン管理

イベント発生時のアカウント設定の API バージョンによって API バージョンが決まり、さらに送信先に送られる [Event (イベント)](https://docs.stripe.com/api/events.md) の構造が決まります。たとえば、アカウントで 2015-02-16 など、以前の API バージョンが設定されている場合、[バージョン管理](https://docs.stripe.com/api.md#versioning)を使用して特定のリクエストの API バージョンを変更しても、生成され送信先に送られる [Event (イベント)](https://docs.stripe.com/api/events.md) オブジェクトは、2015-02-16 の API バージョンに基づくものになります。[Event (イベント)](https://docs.stripe.com/api/events.md) オブジェクトは、作成後に変更することはできません。たとえば、支払いを更新しても、元の支払いイベントは変更されません。そのため、アカウントの API バージョンを後から更新しても、既存の [Event (イベント)](https://docs.stripe.com/api/events.md) オブジェクトがさかのぼって変更されることはありません。新しい API バージョンを使用して `/v1/events` を呼び出すことで以前の [Event (イベント)](https://docs.stripe.com/api/events.md) を取得しても、受信したイベントの構造には影響しません。テストイベントの送信先は、デフォルトの API バージョンか、最新の API バージョンのいずれかに設定できます。送信先に送られる [Event (イベント)](https://docs.stripe.com/api/events.md) は、イベントの送信先で指定されているバージョンに従って構造化されます。

## Webhook 使用のベストプラクティス

これらのベストプラクティスを見直し、Webhook エンドポイントがセキュリティで保護され、システムで適切に機能することを確認してください。

### 重複するイベントを処理する

Webhook エンドポイントは、同じイベントを複数回受信する可能性があります。処理した[イベント ID](https://docs.stripe.com/api/events/object.md#event_object-id) をログに記録し、すでにログに記録したイベントを処理しないようにすることで、重複するイベントの受信に対処することができます。

場合によっては、2 つの Event オブジェクトが個別に生成・送信されます。これらの重複を識別するには、`data.object` のオブジェクト ID と `event.type` を使用します。

### 構築済みのシステムに必要なイベントタイプのみをリッスンする

Webhook エンドポイントは、お客様の実装で必要なイベントのタイプのみを受信するように設定します。その他のイベント (またはすべてのイベント) をリッスンすると、お客様のサーバーに過度の負荷がかかるため、お勧めしません。

ダッシュボードまたは API で、Webhook エンドポイントが受信する[イベントを変更](https://docs.stripe.com/api/webhook_endpoints/update.md#update_webhook_endpoint-enabled_events)できます。

### イベントを非同期で処理する

非同期キューで受信したイベントを処理するようにハンドラを設定します。非同期でイベントを処理することを選択した場合は、拡張性の問題が発生する可能性があります。Webhook の配信が急増すると (たとえば、すべてのサブスクリプションが更新される月初など)、エンドポイントホストが対処不可能になる場合があります。

非同期キューを使用することで、同時に発生するイベントをシステムが対応できる速度で処理できるようになります。

### Webhook ルートを CSRF 保護から除外する

Rails、Django、その他のウェブフレームワークを使用している場合、貴社のサイトでは、すべての POST リクエストに 「CSRF トークン」が含まれていることを自動的に確認している可能性があります。これは、貴社とそのユーザーを[クロスサイトリクエストフォージェリ](https://www.owasp.org/index.php/Cross-Site_Request_Forgery_\(CSRF\)) の試行から保護するための重要なセキュリティ機能です。ただし、このセキュリティ対策は貴社サイトにおける正当なイベントの処理を妨げる可能性があります。この場合は、Webhook ルートを CSRF 保護から除外しなければならない可能性があります。

#### Rails

```ruby
class StripeController < ApplicationController
  # If your controller accepts requests other than Stripe webhooks,
  # you'll probably want to use `protect_from_forgery` to add CSRF
  # protection for your application. But don't forget to exempt
  # your webhook route!
  protect_from_forgery except: :webhook

  def webhook
    # Process webhook data in `params`
  end
end
```

### HTTPS サーバーでイベントを受信する

Webhook エンドポイント (本番環境で必要) に HTTPS URL を使用する場合、Stripe は Webhook データを送信する前に、お客様のサーバーへの接続が安全であることを確認します。これを機能させるには、お客様のサーバーが、有効なサーバー証明書で HTTPS をサポートするように正しく設定されている必要があります。Stripe の Webhook は、*TLS* (TLS refers to the process of securely transmitting data between the client—the app or browser that your customer is using—and your server. This was originally performed using the SSL (Secure Sockets Layer) protocol) バージョン v1.2 および v1.3 のみサポートしています。

### エンドポイントの署名シークレットを定期的に取り消す

イベントが Stripe から送信されたことを確認するためのシークレットは、Workbench の **Webhook** タブで変更できます。シークレットを安全に保つために、定期的またはシークレットの侵害が疑われる場合にローテーション (変更) することをお勧めします。

シークレットを取り消すには、以下を行います。

1. Workbench の **Webhook** タブで、シークレットをローテーションするエンドポイントをクリックします。
1. オーバーフローメニュー (⋯) にアクセスし、**シークレットの更新**をクリックします。現在のシークレットキーをただちに有効期限切れにすることも、有効期限を最大 24 時間延長して、自社のサーバーの検証コードをご自身で更新する時間を確保することもできます。この間は、エンドポイントに対して複数のシークレットキーがアクティブになります。Stripe は、有効期限までシークレットキーごとに 1 つの署名を生成します。

### イベントが Stripe から送信されたことを検証する

認証を行わないと、攻撃者が偽の webhook イベントをエンドポイントに送信して、注文の処理、アカウントアクセスの許可、レコードの変更などを不正に実行される可能性があります。Webhook イベントを処理する前に、必ず Stripe から発信されたイベントであることを確認してください。

次の両方の保護を使用します。

- **IP の許可リスト**: Stripe は webhook イベントを特定の [IP アドレス](https://docs.stripe.com/ips.md)から送信します。サーバーやファイアウォールを設定して、これらのアドレスからのリクエストのみ受け入れるようにします。
- **署名の確認**: Stripe は、`Stripe-Signature` ヘッダーに署名を含めることで、すべての Webhook イベントに署名します。この署名を[公式ライブラリ](https://docs.stripe.com/webhooks.md#verify-official-libraries)または[手動](https://docs.stripe.com/webhooks.md#verify-manually)で検証し、イベントが第三者によって送信・改ざんされていないことを確認します。

次のセクションでは、Webhook の署名を検証する方法を説明します。

1. エンドポイントのシークレットを取得します。
1. 署名を検証します。

#### エンドポイントのシークレットを取得する

ワークベンチを使用して**Webhook**タブに進み、すべてのエンドポイントを表示します。シークレットを取得するエンドポイントを選択し、**クリックして表示**をクリックします。

Stripe は、エンドポイントごとに一意のシークレットキーを生成します。[テスト API キーと本番 API キー](https://docs.stripe.com/keys.md#test-live-modes)の両方に同じエンドポイントを使用する場合、シークレットはそれぞれ異なります。さらに、複数のエンドポイントを使用する場合は、署名を検証するエンドポイントごとにシークレットを取得する必要があります。この設定後、Stripe はエンドポイントに送信する各 Webhook への署名を開始します。

### リプレイ攻撃を防止する

[リプレイ攻撃](https://en.wikipedia.org/wiki/Replay_attack)とは、攻撃者が有効なペイロードとその署名を傍受し、それを再送信することを言います。そのような攻撃を低減するために、Stripe は `Stripe-Signature` ヘッダーにタイムスタンプを含めています。このタイムスタンプは署名されたペイロードの一部であるため、署名によっても検証され、攻撃者は署名を無効にしなければタイムスタンプを変更できません。署名が有効でもタイムスタンプが古すぎる場合は、アプリケーションにペイロードを拒否させることができます。

Stripe のライブラリには、タイムスタンプと現在時刻の間に 5 分のデフォルトの許容範囲があります。この許容範囲は、署名を検証する際に追加のパラメーターを指定することで変更できます。ネットワークタイムプロトコル ([NTP](https://en.wikipedia.org/wiki/Network_Time_Protocol)) を使用して、サーバーのクロックが正確であり、Stripe のサーバーの時間と同期していることを確認します。

> 許容値 `0` は使用しないでください。許容値 `0` を使用すると、最新性チェックが完全に無効になります。

Stripe は、イベントをエンドポイントに送信するたびにタイムスタンプと署名を生成します。Stripe がイベントを再試行する場合 (たとえば、その前にエンドポイントが `2xx` 以外のステータスコードで応答した場合)、新しい配信試行に対して新しい署名とタイムスタンプを生成します。

### 2xx レスポンスを素早く返す

[エンドポイント](https://docs.stripe.com/webhooks.md#example-endpoint)は、タイムアウトの原因となる複雑なロジックを実行する前に、成功を示すステータスコード (`2xx`) を速やかに返す必要があります。たとえば、会計システムで顧客の請求書を支払い済みとして更新する前に、`200` のレスポンスを返さなければなりません。

## See also

- [Amazon EventBridge にイベントを送信](https://docs.stripe.com/event-destinations/eventbridge.md)
- [Azure Event Grid にイベントを送信する](https://docs.stripe.com/event-destinations/eventgrid.md)
- [thin イベントタイプの一覧](https://docs.stripe.com/api/v2/core/events/event-types.md)
- [スナップショットイベントタイプの一覧](https://docs.stripe.com/api/events/.md)
- [インタラクティブな Webhook エンドポイントビルダー](https://docs.stripe.com/webhooks/quickstart.md)
