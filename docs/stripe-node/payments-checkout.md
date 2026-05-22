# 決済画面の構築

Checkout Sessions API を使用して、構築済みの UI で決済画面を作成します。

## ウェブサイトで決済を受け付ける

125 種類を超える国内主要決済手段で、1 回限りの決済とサブスクリプション決済を受け付けられます。
[決済の導入を始める](https://docs.stripe.com/checkout/quickstart.md)
## Stripe Checkout

[Checkout Sessions API](https://docs.stripe.com/api/checkout/sessions.md) では、3 つの異なるタイプの決済 UI を使用できます。次の画像は、各オプションにおける決済 UI のうち Stripe がホストする部分を示しています。
![フルページ](https://b.stripecdn.com/docs-statics-srv/assets/checkout-hosted-hover.6ee5a154986ffc216c034a47b7b0d65e.png)

[フルページ](https://docs.stripe.com/checkout/quickstart.md)顧客は、サイトに埋め込まれた、またはStripe 上の決済画面へのリダイレクトで表示される高機能な決済画面で、決済情報を入力します。
![埋め込みフォーム](https://b.stripecdn.com/docs-statics-srv/assets/checkout-form-hover.31c41716c4857e5e01f77978530fc573.png)

[Embedded form](https://docs.stripe.com/payments/checkout/how-checkout-works.md?payment-ui=checkout-form) Customers enter their payment details in an embedded form on your site without redirection.
![Elements](https://b.stripecdn.com/docs-statics-srv/assets/checkout-elements-hover.28148f5be39600e85ef4784ab9e873e7.png)

[Elements](https://docs.stripe.com/payments/quickstart-checkout-sessions.md) Elements を使用して、完全にカスタマイズ可能な決済画面を構築

| &nbsp;            | [FULL PAGE](https://docs.stripe.com/payments/accept-a-payment.md?payment-ui=checkout&ui=stripe-hosted) (Recommended) | [EMBEDDED FORM](https://docs.stripe.com/payments/checkout/how-checkout-works.md?payment-ui=checkout-form) (プライベートプレビュー) | [ELEMENTS](https://docs.stripe.com/payments/accept-a-payment.md?payment-ui=elements&api-integration=checkout) |
| ----------------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **API**           | [Checkout Sessions](https://docs.stripe.com/api/checkout/sessions.md)                                                | [Checkout Sessions](https://docs.stripe.com/api/checkout/sessions.md)                                                   | [Checkout Sessions](https://docs.stripe.com/api/checkout/sessions.md)                                         |
| **機能リスト**         | Billing、Tax、Adaptive Pricing、Stripe Managed Payments、Link、動的な決済手段、追加手数料、支払い方法の分割に対応する UI を標準搭載                       | Billing、Tax、Adaptive Pricing、Stripe Managed Payments、Link、動的な決済手段、追加手数料に対応する UI を標準搭載                                   | Adaptive Pricing、Link、動的な決済手段に対応する UI を標準搭載                                                                   |
| **注文概要**          | 小計 (税金と配送料を含む)、クロスセルとアップセル、無料トライアル、割引、プロモーションコードを含む、完全な注文概要を提供                                                       | 小計 (税金と配送料を含む)、割引、プロモーションコードを含む、限定された注文概要                                                                               | 注文概要はありません                                                                                                    |
| **継続的なメンテナンスが必要** |                                                                                                                      |                                                                                                                         |                                                                                                               |
| **ホスティング**        | ホスト型または埋め込み型                                                                                                         | 埋め込み型                                                                                                                   | 埋め込み型                                                                                                         |
| **複雑度**           | 低                                                                                                                    | ある程度                                                                                                                    | ほとんど                                                                                                          |
| **カスタマイズ**        | ブランド設定で 15 項目の設定が可能                                                                                                  | Appearance API で 70 項目の設定が可能                                                                                            | Appearance API による CSS の完全なカスタマイズが可能                                                                          |

## 決済をカスタマイズする

[デザインをカスタマイズする](https://docs.stripe.com/payments/checkout/customization.md): 決済フローのデザインと動作をカスタマイズします。

[追加情報を収集する](https://docs.stripe.com/payments/checkout/collect-additional-info.md): 決済中に配送先の詳細やその他の顧客情報を収集する。

[税金を徴収する](https://docs.stripe.com/payments/checkout/taxes.md): Stripe Checkout で 1 回限りの決済の税金を徴収する。

[決済フローを動的に更新](https://docs.stripe.com/payments/checkout/dynamic-updates.md): 顧客が決済する際に更新します。

[カスタムコンポーネントで決済を拡張](https://docs.stripe.com/payments/checkout/custom-components.md): 決済フォームにカスタムコンポーネントを追加できます。

[トライアル、割引、アップセルを追加する](https://docs.stripe.com/payments/checkout/promotions.md): トライアル、割引、オプションアイテムなどのプロモーションを追加します。

## 決済を収集するタイミングと方法を変更する

[サブスクリプションを設定する](https://docs.stripe.com/payments/subscriptions.md): 顧客の継続決済でサブスクリプションを作成します。

[支払いの事前設定](https://docs.stripe.com/payments/checkout/save-and-reuse.md): 決済詳細を保存し、後で顧客に請求します。

[決済時に決済の詳細を保存する](https://docs.stripe.com/payments/checkout/save-during-payment.md): 決済を受け付け、将来の購入に備えて顧客の決済詳細を保存します。

[顧客が現地通貨で決済できるようにする](https://docs.stripe.com/payments/currencies/localize-prices/adaptive-pricing.md): Adaptive Pricing を使用して、顧客が現地通貨で支払えるようにします。

[Managed Payments を設定する](https://docs.stripe.com/payments/managed-payments/how-it-works.md): 顧客サポートを含む 80 カ国以上での売上税と VAT 法令遵守、不正利用や不審請求の申し立てへの対応は、Stripe にお任せください。

## 業務を管理する

[商品カタログを管理する](https://docs.stripe.com/payments/checkout/product-catalog.md): Checkout を使用して在庫とフルフィルメントを処理します。

[ダッシュボードに決済手段を移行](https://docs.stripe.com/payments/dashboard-payment-methods.md): 決済手段の管理をダッシュボードに移行します。

[決済後](https://docs.stripe.com/payments/checkout/after-the-payment.md): 決済後の決済プロセスをカスタマイズします。

## サンプルプロジェクト

[1 回限りの支払い](https://github.com/stripe-samples/checkout-one-time-payments)

[サブスクリプション](https://github.com/stripe-samples/checkout-single-subscription)
