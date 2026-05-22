 <!DOCTYPE html>
		<html
			class="layout layout-holy-grail   show-table-of-contents conceptual show-breadcrumb default-focus"
			lang="en-us"
			dir="ltr"
			data-authenticated="false"
			data-auth-status-determined="false"
			data-target="docs"
			x-ms-format-detection="none"
		>
			
		<head>
			<title>Authentication and authorization basics - Microsoft Graph | Microsoft Learn</title>
			<meta charset="utf-8" />
			<meta name="viewport" content="width=device-width, initial-scale=1.0" />
			<meta name="color-scheme" content="light dark" />

			<meta name="description" content="To call Microsoft Graph, you must register your app with the Microsoft identity platform, request permissions, and acquire an access token." />
			<link rel="canonical" href="https://learn.microsoft.com/en-us/graph/auth/auth-concepts" /> 

			<!-- Non-customizable open graph and sharing-related metadata -->
			<meta name="twitter:card" content="summary_large_image" />
			<meta name="twitter:site" content="@MicrosoftLearn" />
			<meta property="og:type" content="website" />
			<meta property="og:image:alt" content="Microsoft Learn" />
			<meta property="og:image" content="https://learn.microsoft.com/en-us/media/open-graph-image.png" />
			<!-- Page specific open graph and sharing-related metadata -->
			<meta property="og:title" content="Authentication and authorization basics - Microsoft Graph" />
			<meta property="og:url" content="https://learn.microsoft.com/en-us/graph/auth/auth-concepts" />
			<meta property="og:description" content="To call Microsoft Graph, you must register your app with the Microsoft identity platform, request permissions, and acquire an access token." />
			<meta name="platform_id" content="7c07c663-475c-9273-df13-b2bf4e47abad" /> <meta name="scope" content="graph" />
			<meta name="locale" content="en-us" />
			 
			<meta name="uhfHeaderId" content="MSDocsHeader-MSGraph" />

			<meta name="page_type" content="conceptual" />

			<!--page specific meta tags-->
			

			<!-- custom meta tags -->
			
		<meta name="feedback_system" content="Standard" />
	
		<meta name="feedback_product_url" content="https://developer.microsoft.com/graph/support" />
	
		<meta name="breadcrumb_path" content="/graph/concepts/breadcrumb/toc.json" />
	
		<meta name="author" content="FaithOmbongi" />
	
		<meta name="ms.author" content="ombongifaith" />
	
		<meta name="ms.suite" content="microsoft-graph" />
	
		<meta name="ms.subservice" content="entra-applications" />
	
		<meta name="toc_preview" content="true" />
	
		<meta name="recommendations" content="false" />
	
		<meta name="ms.service" content="microsoft-graph" />
	
		<meta name="ms.topic" content="concept-article" />
	
		<meta name="ms.reviewer" content="jackson.woods" />
	
		<meta name="ms.localizationpriority" content="high" />
	
		<meta name="ms.custom" content="graphiamtop20" />
	
		<meta name="ms.date" content="2024-12-19T00:00:00Z" />
	
		<meta name="document_id" content="99744fa1-3662-8ff5-646b-8be06d43b066" />
	
		<meta name="document_version_independent_id" content="bfc9d00c-c96f-afcc-bb8f-15c2d8601c3b" />
	
		<meta name="updated_at" content="2025-08-06T00:47:00Z" />
	
		<meta name="original_content_git_url" content="https://github.com/microsoftgraph/microsoft-graph-docs/blob/live/concepts/auth/auth-concepts.md" />
	
		<meta name="gitcommit" content="https://github.com/microsoftgraph/microsoft-graph-docs/blob/54311e7fa888a1b92c87bfc991b8da0e0bf15a15/concepts/auth/auth-concepts.md" />
	
		<meta name="git_commit_id" content="54311e7fa888a1b92c87bfc991b8da0e0bf15a15" />
	
		<meta name="site_name" content="Docs" />
	
		<meta name="depot_name" content="MSDN.microsoft-graph-docs" />
	
		<meta name="schema" content="Conceptual" />
	
		<meta name="toc_rel" content="../toc.json" />
	
		<meta name="feedback_help_link_type" content="" />
	
		<meta name="feedback_help_link_url" content="" />
	
		<meta name="word_count" content="1533" />
	
		<meta name="asset_id" content="auth/auth-concepts" />
	
		<meta name="moniker_range_name" content="" />
	
		<meta name="item_type" content="Content" />
	
		<meta name="source_path" content="concepts/auth/auth-concepts.md" />
	
		<meta name="previous_tlsh_hash" content="A2EEF312410E5B377D8B6D197D27FB1227E0F08B6E71EA541C2C42C555800E679B2595ABFB97E7854B73836312A73E5D8AE0B32E906E36E3CA5C5428825C22632EC93373D4" />
	
		<meta name="github_feedback_content_git_url" content="https://github.com/microsoftgraph/microsoft-graph-docs-contrib/blob/main/concepts/auth/auth-concepts.md" />
	
		<meta name="markdown_url" content="https://learn.microsoft.com/en-us/graph/auth/auth-concepts?accept=text/markdown" />
	 
		<meta name="cmProducts" content="https://authoring-docs-microsoft.poolparty.biz/devrel/5fc61396-d075-4560-aece-fdbda73d243f" data-source="generated" />
	
		<meta name="spProducts" content="https://authoring-docs-microsoft.poolparty.biz/devrel/ad9437c1-8cda-4537-ad69-b4b263652e13" data-source="generated" />
	

			<!-- assets and js globals -->
			
			<link rel="stylesheet" href="/static/assets/0.4.03427.7856-752ce836/styles/site.css" />
			
			<script src="https://wcpstatic.microsoft.com/mscc/lib/v2/wcp-consent.js"></script>
			<script src="https://js.monitor.azure.com/scripts/c/ms.jsll-4.min.js"></script>
			<script src="/_themes/docs.theme/master/en-us/_themes/global/deprecation.js"></script>

			<!-- msdocs global object -->
			<script id="msdocs-script">
		var msDocs = {
  "environment": {
    "accessLevel": "online",
    "azurePortalHostname": "portal.azure.com",
    "reviewFeatures": false,
    "supportLevel": "production",
    "systemContent": true,
    "siteName": "learn",
    "legacyHosting": false
  },
  "data": {
    "contentLocale": "en-us",
    "contentDir": "ltr",
    "userLocale": "en-us",
    "userDir": "ltr",
    "pageTemplate": "Conceptual",
    "brand": "",
    "context": {},
    "standardFeedback": true,
    "showFeedbackReport": false,
    "feedbackHelpLinkType": "",
    "feedbackHelpLinkUrl": "",
    "feedbackSystem": "Standard",
    "feedbackGitHubRepo": "microsoftgraph/microsoft-graph-docs-contrib",
    "feedbackProductUrl": "https://developer.microsoft.com/graph/support",
    "extendBreadcrumb": false,
    "isEditDisplayable": true,
    "isPrivateUnauthorized": false,
    "hideViewSource": false,
    "isPermissioned": false,
    "hasRecommendations": true,
    "contributors": [
      {
        "name": "FaithOmbongi",
        "url": "https://github.com/FaithOmbongi"
      },
      {
        "name": "Copilot",
        "url": "https://github.com/Copilot"
      },
      {
        "name": "batkaevruslan",
        "url": "https://github.com/batkaevruslan"
      },
      {
        "name": "RetYn",
        "url": "https://github.com/RetYn"
      },
      {
        "name": "Lauragra",
        "url": "https://github.com/Lauragra"
      },
      {
        "name": "alexbuckgit",
        "url": "https://github.com/alexbuckgit"
      },
      {
        "name": "halter73",
        "url": "https://github.com/halter73"
      },
      {
        "name": "MelanieHom",
        "url": "https://github.com/MelanieHom"
      },
      {
        "name": "jasonjoh",
        "url": "https://github.com/jasonjoh"
      },
      {
        "name": "angelgolfer-ms",
        "url": "https://github.com/angelgolfer-ms"
      },
      {
        "name": "DCtheGeek",
        "url": "https://github.com/DCtheGeek"
      },
      {
        "name": "cnotin",
        "url": "https://github.com/cnotin"
      },
      {
        "name": "psignoret",
        "url": "https://github.com/psignoret"
      },
      {
        "name": "rwike77",
        "url": "https://github.com/rwike77"
      },
      {
        "name": "CelesteDG",
        "url": "https://github.com/CelesteDG"
      },
      {
        "name": "Jackson-Woods",
        "url": "https://github.com/Jackson-Woods"
      }
    ]
  },
  "functions": {}
};;
	</script>

			<!-- base scripts, msdocs global should be before this -->
			<script src="/static/assets/0.4.03427.7856-752ce836/scripts/en-us/index-docs.js"></script>
			

			<!-- json-ld -->
			
		</head>
	
			<body
				id="body"
				data-bi-name="body"
				class="layout-body "
				lang="en-us"
				dir="ltr"
			>
				<header class="layout-body-header background-color-body-medium">
		<div class="header-holder has-default-focus">
			
		<a
			href="#main"
			
			style="z-index: 1070"
			class="outline-color-text visually-hidden-until-focused position-fixed inner-focus focus-visible top-0 left-0 right-0 padding-xs text-align-center background-color-body"
			
		>
			Skip to main content
		</a>
	
		<a
			href="#"
			data-skip-to-ask-learn
			style="z-index: 1070"
			class="outline-color-text visually-hidden-until-focused position-fixed inner-focus focus-visible top-0 left-0 right-0 padding-xs text-align-center background-color-body"
			hidden
		>
			Skip to Ask Learn chat experience
		</a>
	

			<div hidden id="cookie-consent-holder" data-test-id="cookie-consent-container"></div>
			<!-- Unsupported browser warning -->
			<div
				id="unsupported-browser"
				style="background-color: white; color: black; padding: 16px; border-bottom: 1px solid grey;"
				hidden
			>
				<div style="max-width: 800px; margin: 0 auto;">
					<p style="font-size: 24px">This browser is no longer supported.</p>
					<p style="font-size: 16px; margin-top: 16px;">
						Upgrade to Microsoft Edge to take advantage of the latest features, security updates, and technical support.
					</p>
					<div style="margin-top: 12px;">
						<a
							href="https://go.microsoft.com/fwlink/p/?LinkID=2092881 "
							style="background-color: #0078d4; border: 1px solid #0078d4; color: white; padding: 6px 12px; border-radius: 2px; display: inline-block;"
						>
							Download Microsoft Edge
						</a>
						<a
							href="https://learn.microsoft.com/en-us/lifecycle/faq/internet-explorer-microsoft-edge"
							style="background-color: white; padding: 6px 12px; border: 1px solid #505050; color: #171717; border-radius: 2px; display: inline-block;"
						>
							More info about Internet Explorer and Microsoft Edge
						</a>
					</div>
				</div>
			</div>
			<!-- site header -->
			<div
				id="ms--site-header"
				data-test-id="site-header-wrapper"
				itemscope="itemscope"
				itemtype="http://schema.org/Organization"
			>
				<div
					id="ms--mobile-nav"
					class="site-header display-none-tablet padding-inline-none gap-none"
					data-bi-name="mobile-header"
					data-test-id="mobile-header"
				></div>
				<div
					id="ms--primary-nav"
					class="site-header display-none display-flex-tablet"
					data-bi-name="L1-header"
					data-test-id="primary-header"
				></div>
				<div
					id="ms--secondary-nav"
					class="site-header display-none display-flex-tablet"
					data-bi-name="L2-header"
					data-test-id="secondary-header"
					
				></div>
			</div>
			
		<!-- banner -->
		<div data-banner>
			<div id="disclaimer-holder"></div>
			
		</div>
		<!-- banner end -->
	
		</div>
	</header>
				 <section
					id="layout-body-menu"
					class="layout-body-menu border-right display-flex background-color-body-medium"
					data-bi-name="menu"
			  >
					
		<div
			id="left-container"
			class="left-container display-none padding-none display-block-tablet width-full"
			data-toc-container="true"
		>
			<div
				id="ms--toc-content"
				class="padding-left-sm padding-right-none padding-bottom-sm height-full"
			>
				<nav
					id="affixed-left-container"
					class="margin-top-xxs-tablet position-sticky display-flex flex-direction-column width-full"
					aria-label="Primary"
					data-bi-name="left-toc"
					role="navigation"
				>
					<div
						id="ms--collapsible-toc-header"
						class="display-flex flex-direction-row-reverse justify-content-center align-items-center margin-bottom-xxs margin-right-xxs"
					>
						<button
							type="button"
							class="button button-clear inner-focus"
							data-collapsible-toc-toggle
							aria-expanded="true"
							aria-controls="ms--toc-content"
							aria-label="Table of contents"
						>
							<span class="icon icon-mirrored-rtl font-size-md" aria-hidden="true">
								<span class="docon docon-panel-left-contract"></span>
							</span>
						</button>
						<div
							id="ms--collapsible-toc-moniker-slot"
							class="flex-grow-1 display-none-layout-menu-collapsed"
						></div>
					</div>
				</nav>
			</div>
		</div>
	
			  </section>

				<main
					id="main"
					role="main"
					class="layout-body-main "
					data-bi-name="content"
					lang="en-us"
					dir="ltr"
				>
					
			<div
		id="ms--content-header"
		class="content-header default-focus border-bottom-none"
		data-bi-name="content-header"
	>
		<div class="content-header-controls margin-xxs margin-inline-sm-tablet">
			<button
				type="button"
				class="contents-button button button-sm margin-right-xxs"
				data-bi-name="contents-expand"
				aria-haspopup="true"
				data-contents-button
			>
				<span class="icon" aria-hidden="true"><span class="docon docon-menu"></span></span>
				<span class="contents-expand-title"> Table of contents </span>
			</button>
			<button
				type="button"
				class="ap-collapse-behavior ap-expanded button button-sm"
				data-bi-name="ap-collapse"
				aria-controls="action-panel"
			>
				<span class="icon" aria-hidden="true"><span class="docon docon-exit-mode"></span></span>
				<span>Exit editor mode</span>
			</button>
		</div>
	</div>
			<div
				data-main-column
				class="reading-width margin-inline-auto layout-padding padding-top-none padding-top-sm-tablet padding-bottom-sm"
			>
				<div>
					
		<div id="article-header" class="background-color-body margin-bottom-xs display-none-print">
			<div class="display-flex align-items-center justify-content-space-between">
				
		<details
			id="article-header-breadcrumbs-overflow-popover"
			class="popover popover-left"
			data-for="article-header-breadcrumbs"
		>
			<summary
				class="button button-clear button-primary button-sm inner-focus"
				aria-label="All breadcrumbs"
			>
				<span class="icon" aria-hidden="true">
					<span class="docon docon-more"></span>
				</span>
			</summary>
			<div id="article-header-breadcrumbs-overflow" class="popover-content"></div>
		</details>

		<bread-crumbs
			id="article-header-breadcrumbs"
			role="group"
			aria-label="Breadcrumbs"
			data-test-id="article-header-breadcrumbs"
			class="overflow-hidden flex-grow-1 margin-right-sm margin-right-md-tablet margin-right-lg-desktop margin-left-negative-xxs padding-left-xxs"
		></bread-crumbs>
	 
		<div
			id="article-header-page-actions"
			class="opacity-none margin-left-auto display-flex flex-wrap-no-wrap align-items-stretch"
		>
			
		<button
			class="button button-sm border-none inner-focus display-none-tablet flex-shrink-0 "
			data-bi-name="ask-learn-assistant-entry"
			data-test-id="ask-learn-assistant-modal-entry-mobile"
			data-ask-learn-modal-entry
			
			type="button"
			style="min-width: max-content;"
			aria-expanded="false"
			aria-label="Ask Learn"
			hidden
		>
			<span class="icon font-size-lg" aria-hidden="true">
				<span class="docon docon-chat-sparkle-fill gradient-ask-learn-logo"></span>
			</span>
		</button>
		<button
			class="button button-sm display-none display-inline-flex-tablet display-none-desktop flex-shrink-0 margin-right-xxs border-color-ask-learn "
			data-bi-name="ask-learn-assistant-entry"
			
			data-test-id="ask-learn-assistant-modal-entry-tablet"
			data-ask-learn-modal-entry
			type="button"
			style="min-width: max-content;"
			aria-expanded="false"
			hidden
		>
			<span class="icon font-size-lg" aria-hidden="true">
				<span class="docon docon-chat-sparkle-fill gradient-ask-learn-logo"></span>
			</span>
			<span>Ask Learn</span>
		</button>
		<button
			class="button button-sm display-none flex-shrink-0 display-inline-flex-desktop margin-right-xxs border-color-ask-learn "
			data-bi-name="ask-learn-assistant-entry"
			
			data-test-id="ask-learn-assistant-flyout-entry"
			data-ask-learn-flyout-entry
			data-flyout-button="toggle"
			type="button"
			style="min-width: max-content;"
			aria-expanded="false"
			aria-controls="ask-learn-flyout"
			hidden
		>
			<span class="icon font-size-lg" aria-hidden="true">
				<span class="docon docon-chat-sparkle-fill gradient-ask-learn-logo"></span>
			</span>
			<span>Ask Learn</span>
		</button>
	 

			<details class="popover popover-right" id="article-header-page-actions-overflow">
				<summary
					class="justify-content-flex-start button button-clear button-sm button-primary inner-focus"
					aria-label="More actions"
					title="More actions"
				>
					<span class="icon" aria-hidden="true">
						<span class="docon docon-more-vertical"></span>
					</span>
				</summary>
				<div class="popover-content">
					
		<button
			type="button"
			id="ms--focus-mode-button"
			data-focus-mode
			data-bi-name="focus-mode-entry"
			data-page-action-item="overflow-all"
			data-popover-close
			class="button button-clear button-sm button-block justify-content-flex-start text-align-left inner-focus display-none display-inline-flex-tablet"
		>
			<span class="icon" aria-hidden="true">
				<span class="docon docon-glasses"></span>
			</span>
			<span>Reading mode</span>
		</button>
	 
		<button
			data-page-action-item="overflow-mobile"
			type="button"
			class="button-block button-sm inner-focus button button-clear display-none-tablet justify-content-flex-start text-align-left"
			data-bi-name="contents-expand"
			data-contents-button
			data-popover-close
		>
			<span class="icon" aria-hidden="true"
				><span class="docon docon-editor-list-bullet"></span
			></span>
			<span class="contents-expand-title">Table of contents</span>
		</button>
	 
		<a
			id="lang-link-overflow"
			class="button-sm inner-focus button button-clear button-block justify-content-flex-start text-align-left"
			data-bi-name="language-toggle"
			data-page-action-item="overflow-all"
			data-check-hidden="true"
			data-read-in-link
			href="#"
			hidden
		>
			<span class="icon" aria-hidden="true" data-read-in-link-icon>
				<span class="docon docon-locale-globe"></span>
			</span>
			<span data-read-in-link-text>Read in English</span>
		</a>
	
					
		<button
			type="button"
			class="collection button button-clear button-sm button-block justify-content-flex-start text-align-left inner-focus"
			data-list-type="collection"
			data-bi-name="collection"
			data-page-action-item="overflow-all"
			data-check-hidden="true"
			data-popover-close
		>
			<span class="icon" aria-hidden="true">
				<span class="docon docon-circle-addition"></span>
			</span>
			<span class="collection-status">Add</span>
		</button>
	 
		<button
			type="button"
			class="collection button button-block button-clear button-sm justify-content-flex-start text-align-left inner-focus"
			data-list-type="plan"
			data-bi-name="plan"
			data-page-action-item="overflow-all"
			data-check-hidden="true"
			data-popover-close
			hidden
		>
			<span class="icon" aria-hidden="true">
				<span class="docon docon-circle-addition"></span>
			</span>
			<span class="plan-status">Add to plan</span>
		</button>
	 
					
		<a
			data-contenteditbtn
			class="button button-clear button-block button-sm inner-focus justify-content-flex-start text-align-left text-decoration-none"
			data-bi-name="edit"
			data-page-action-item="overflow-all"
			data-check-hidden="true"
			
			href="https://github.com/microsoftgraph/microsoft-graph-docs-contrib/blob/main/concepts/auth/auth-concepts.md"
			data-original_content_git_url="https://github.com/microsoftgraph/microsoft-graph-docs/blob/live/concepts/auth/auth-concepts.md"
			data-original_content_git_url_template="{repo}/blob/{branch}/concepts/auth/auth-concepts.md"
			data-pr_repo=""
			data-pr_branch=""
		>
			<span class="icon" aria-hidden="true">
				<span class="docon docon-edit-outline"></span>
			</span>
			<span>Edit</span>
		</a>
	  
		<hr class="margin-block-xxs" />
		
				<button
					class="button button-block button-clear button-sm justify-content-flex-start text-align-left inner-focus"
					type="button"
					data-bi-name="copy-markdown"
					data-page-action-item="overflow-all"
					data-copy-markdown
					data-copy-state="idle"
					data-check-hidden="true"
				>
					<span class="icon color-primary" aria-hidden="true">
						<span data-show-when="idle" class="docon docon-code-lang"></span>
						<span data-show-when="loading" class="loader" hidden></span>
						<span data-show-when="success" class="docon docon-check-mark" hidden></span>
					</span>
					<span>Copy Markdown</span>
				</button>
		   
				<button
					class="button button-block button-clear button-sm justify-content-flex-start text-align-left inner-focus"
					type="button"
					data-bi-name="print"
					data-page-action-item="overflow-all"
					data-popover-close
					data-print-page
					data-check-hidden="true"
				>
					<span class="icon color-primary" aria-hidden="true">
						<span class="docon docon-print"></span>
					</span>
					<span>Print</span>
				</button>
		  
	
				</div>
			</details>
		</div>
	
			</div>
		</div>
	  
		<!-- privateUnauthorizedTemplate is hidden by default -->
		<div unauthorized-private-section data-bi-name="permission-content-unauthorized-private" hidden>
			<hr class="hr margin-top-xs margin-bottom-sm" />
			<div class="notification notification-info">
				<div class="notification-content">
					<p class="margin-top-none notification-title">
						<span class="icon" aria-hidden="true"
							><span class="docon docon-exclamation-circle-solid"></span
						></span>
						<span>Note</span>
					</p>
					<p class="margin-top-none authentication-determined not-authenticated">
						Access to this page requires authorization. You can try <a class="docs-sign-in" href="#" data-bi-name="permission-content-sign-in">signing in</a> or <a  class="docs-change-directory" data-bi-name="permisson-content-change-directory">changing directories</a>.
					</p>
					<p class="margin-top-none authentication-determined authenticated">
						Access to this page requires authorization. You can try <a class="docs-change-directory" data-bi-name="permisson-content-change-directory">changing directories</a>.
					</p>
				</div>
			</div>
		</div>
	
					<div class="content"><h1 id="authentication-and-authorization-basics">Authentication and authorization basics</h1></div>
					
		<div
			id="article-metadata"
			data-bi-name="article-metadata"
			data-test-id="article-metadata"
			class="page-metadata-container display-flex gap-xxs justify-content-space-between align-items-center flex-wrap-wrap"
		>
			 
				<div
					id="user-feedback"
					class="margin-block-xxs display-none display-none-print"
					hidden
					data-hide-on-archived
				>
					
		<button
			id="user-feedback-button"
			data-test-id="conceptual-feedback-button"
			class="button button-sm button-clear button-primary display-none"
			type="button"
			data-bi-name="user-feedback-button"
			data-user-feedback-button
			hidden
		>
			<span class="icon" aria-hidden="true">
				<span class="docon docon-like"></span>
			</span>
			<span>Feedback</span>
		</button>
	
				</div>
		  
		</div>
	 
		<div data-id="ai-summary" class="display-none-print">
			<div id="ms--ai-summary-cta" class="margin-top-xs display-flex align-items-center">
				<span class="icon" aria-hidden="true">
					<span class="docon docon-sparkle-fill gradient-text-vivid"></span>
				</span>
				<button
					id="ms--ai-summary"
					type="button"
					class="tag tag-sm tag-suggestion margin-left-xxs"
					data-test-id="ai-summary-cta"
					data-bi-name="ai-summary-cta"
					data-an="ai-summary"
				>
					<span class="ai-summary-cta-text">
						Summarize this article for me
					</span>
				</button>
			</div>
			<!-- Slot where the client will render the summary card after the user clicks the CTA -->
			<div id="ms--ai-summary-header" class="margin-top-xs"></div>
		</div>
	 
		<nav
			id="center-doc-outline"
			class="doc-outline display-none-desktop display-none-print margin-bottom-sm"
			data-bi-name="intopic toc"
			aria-label="In this article"
		>
			<h2 id="ms--in-this-article" class="title is-6 margin-block-xs">
				In this article
			</h2>
		</nav>
	
					<div class="content"><p>Microsoft Graph is a protected API gateway for accessing data in Microsoft cloud services like Microsoft Entra ID and Microsoft 365. It's protected by the <a href="/en-us/entra/identity-platform/v2-overview" data-linktype="absolute-path">Microsoft identity platform</a>, which authorizes and verifies that an app is authorized to call Microsoft Graph.</p>
<p>This article provides an overview of the requirements for an app to be authorized to access data via any Microsoft Graph API. If you're already familiar with how authentication and authorization works, explore <a href="/en-us/entra/identity-platform/sample-v2-code" data-linktype="absolute-path">Microsoft identity platform code samples</a> or <a href="/en-us/graph/tutorials" data-linktype="absolute-path">Microsoft Graph tutorials</a> for apps that are built using different Microsoft Graph SDKs and that call Microsoft Graph APIs.</p>
<h2 id="register-the-application">Register the application</h2>
<p>Before your app can be authorized to call any Microsoft Graph API, the Microsoft identity platform must first be aware of it. This process doesn't involve uploading your application code to the platform. Rather, it involves registering the app in the <a href="https://entra.microsoft.com/" data-linktype="external">Microsoft Entra admin center</a> to establish its configuration information including the following core parameters:</p>
<ul>
<li><strong>Application ID</strong>: A unique identifier assigned by the Microsoft identity platform.</li>
<li><strong>Redirect URI/URL</strong>: One or more endpoints at which your app receives responses from the Microsoft identity platform. The Microsoft identity platform assigns the URI to native and mobile apps.</li>
<li><strong>Credential</strong>: Can be a client secret (a string or password), a certificate, or a federated identity credential. Your app uses the credential to authenticate with the Microsoft identity platform. This property is only required for confidential client applications; It isn't required for public clients like native, mobile, and single page applications. For more information, see <a href="/en-us/entra/identity-platform/msal-client-applications" data-linktype="absolute-path">Public client and confidential client applications</a>.</li>
</ul>
<p>You then add this information back to your code once, and the app uses the information every time it needs to prove its identity during an authentication process, before it can be authorized to access your data.</p>
<p>For more information, see <a href="../auth-register-app-v2" data-linktype="relative-path">Register an application with the Microsoft identity platform</a>.</p>
<h2 id="access-scenarios">Access scenarios</h2>
<p>An app can access data in one of two ways as illustrated in the following image.</p>
<ul>
<li><strong>Delegated access</strong>, an app acting on behalf of a signed-in user.</li>
<li><strong>App-only access</strong>, an app acting with its own identity.</li>
</ul>
<p><span class="mx-imgBorder">
<img src="../images/access-scenarios.png" alt="Illustration of delegated and app-only access scenarios in the Microsoft identity platform." data-linktype="relative-path">
</span>
</p>
<h3 id="delegated-access-access-on-behalf-of-a-user">Delegated access (access on behalf of a user)</h3>
<p>In this access scenario, a user signs into a client application which calls Microsoft Graph on their behalf. <em>Both the client app and the user must be authorized to make the request</em>.</p>
<p>For the client app to be authorized to access the data on behalf of the signed-in user, it must have the required permissions, which it receives through a combination of two factors:</p>
<ul>
<li><em>Delegated permissions</em>, also referred to as <em>scopes</em>: The permissions exposed by Microsoft Graph and that represent the operations that the app can perform on behalf of the signed-in user. The app is allowed to perform an operation on behalf of the signed in user but not another.</li>
<li><em>User permissions</em>: The permissions that the signed-in user has to the resource. The user can be the owner of the resource, the resource can be shared with them, or they can be assigned permissions through a role-based access control system (RBAC) such as <a href="/en-us/entra/identity/role-based-access-control/permissions-reference?toc=%2Fgraph%2Ftoc.json" data-linktype="absolute-path">Microsoft Entra RBAC</a>.</li>
</ul>
<h4 id="sample-scenario-delegated-access-in-microsoft-graph">Sample scenario: Delegated access in Microsoft Graph</h4>
<p>The <code>https://graph.microsoft.com/v1.0/me</code> endpoint is the access point to the signed-in user's information, which represents a resource that's protected by the Microsoft identity platform. For delegated access, the two factors are fulfilled as follows:</p>
<ul>
<li>The app must be granted a supported Microsoft Graph delegated permission, for example, the <em>User.Read</em> delegated permission, on behalf of the signed-in user.</li>
<li>The signed-in user in this scenario is the owner of the data.</li>
</ul>
<div class="NOTE">
<p>Note</p>
<p>Endpoints and APIs with the <code>/me</code> alias operate on the signed-in user only and are therefore called in delegated access scenarios.</p>
<p>As an alternative to Microsoft Graph delegated permissions, an app can also be assigned permissions through a role-based access control system such as <a href="/en-us/entra/identity/role-based-access-control/permissions-reference?toc=%2Fgraph%2Ftoc.json" data-linktype="absolute-path">Microsoft Entra RBAC</a>.</p>
</div>
<h3 id="app-only-access-access-without-a-user">App-only access (access without a user)</h3>
<p>In this access scenario, the application can interact with data on its own, without a signed in user. <em>App-only</em> access is used in scenarios such as automation and backup, and is mostly used by apps that run as background services or daemons. It's suitable when it's undesirable to have a user signed in, or when the data required can't be scoped to a single user.</p>
<p>For a client app to be authorized to access the data with their own identity, it must have the required permissions, which it receives through one of the following ways:</p>
<ul>
<li>The app is assigned supported Microsoft Graph <em>application permissions</em>, also called <em>app roles</em></li>
<li>The app is assigned ownership of the resource that it intends to manage</li>
</ul>
<div class="NOTE">
<p>Note</p>
<p>As an alternative to Microsoft Graph application permissions, an app can also be assigned permissions through a role-based access control system such as <a href="/en-us/entra/identity/role-based-access-control/permissions-reference?toc=%2Fgraph%2Ftoc.json" data-linktype="absolute-path">Microsoft Entra RBAC</a>.</p>
</div>
<h4 id="sample-scenario-app-only-access-in-microsoft-graph">Sample scenario: App-only access in Microsoft Graph</h4>
<p>The <code>https://graph.microsoft.com/v1.0/users/delta</code> endpoint allows you to poll changes to user data. In app-only access, the app must be granted a supported permission, for example, the <em>User.Read.All</em> Microsoft Graph application permission to be allowed to successfully query and receive changes in user data.</p>
<h2 id="microsoft-graph-permissions">Microsoft Graph permissions</h2>
<p>As mentioned earlier, an app must have permissions to access the data that it wants to access, regardless of the access scenario.</p>
<p><a href="../permissions-reference" data-linktype="relative-path">Microsoft Graph exposes granular permissions</a> that control access to Microsoft Graph resources, like users, groups, and mail. Two types of permissions are available for the supported <a href="#access-scenarios" data-linktype="self-bookmark">access scenarios</a>:</p>
<ul>
<li><em>Delegated permissions</em>: Also called <em>scopes</em>, allow the application to act on behalf of the signed-in user.</li>
<li><em>Application permissions</em>: Also called <em>app roles</em>, allow the app to access data on its own, without a signed-in user.</li>
</ul>
<p>As a developer, you decide which Microsoft Graph permissions to request for your app based on the access scenario and the operations you want to perform. When a user signs in to an app, the app must specify the permissions that it needs to be included in the access token. These permissions:</p>
<ul>
<li>May be preauthorized for the application by an administrator.</li>
<li>May be consented by the user directly.</li>
<li>If not preauthorized, requires administrator privileges to grant consent. For example, for permissions with a greater potential security impact.</li>
</ul>
<p>For more information about permissions and consent, see <a href="/en-us/azure/active-directory/develop/permissions-consent-overview#consent" data-linktype="absolute-path">Introduction to permissions and consent</a>.</p>
<p>For more information about Microsoft Graph permissions and how to use them, see the <a href="../permissions-overview" data-linktype="relative-path">Overview of Microsoft Graph permissions</a>.</p>
<!-- markdownlint-disable MD041-->
<div class="NOTE">
<p>Note</p>
<p>As a best practice, request the least privileged permissions that your app needs in order to access data and function correctly. Requesting permissions with more than the necessary privileges is poor security practice, which may cause users to refrain from consenting and affect your app's usage.</p>
</div>
<h2 id="access-tokens">Access tokens</h2>
<p>To access a protected resource, an application must prove that it's authorized to do so by submitting a valid access token. The application gets this access token when it makes an authentication request to the Microsoft identity platform which in turn uses the access token to verify that the app is authorized to call Microsoft Graph.</p>
<p>Access tokens that the Microsoft identity platform issues contain <em>claims</em> which are details about the application and in delegated access scenarios, the signed-in user. Web APIs such as Microsoft Graph that are secured by the Microsoft identity platform use the claims to validate the caller and to ensure that the caller is authorized to perform the operation they're requesting. For delegated access scenarios, the permissions of both the calling user and the app are part of the claims. For application scenarios the permissions of the app are part of the claims. For more information about the pieces that constitute access tokens, see <a href="/en-us/entra/identity-platform/access-token-claims-reference" data-linktype="absolute-path">Access token claims reference</a>.</p>
<p>To call Microsoft Graph, the app makes an authorization request by attaching the access token as a <strong>Bearer</strong> token to the <strong>Authorization</strong> header in an HTTP request. For example, the following call that returns the profile information of the signed-in user (the access token has been shortened for readability):</p>
<pre><code class="lang-http">GET https://graph.microsoft.com/v1.0/me/ HTTP/1.1
Host: graph.microsoft.com
Authorization: Bearer EwAoA8l6BAAU ... 7PqHGsykYj7A0XqHCjbKKgWSkcAg==
</code></pre>
<p>To learn more about Microsoft identity platform access tokens, see <a href="/en-us/entra/identity-platform/id-tokens" data-linktype="absolute-path">ID tokens in the Microsoft identity platform</a>.</p>
<h3 id="get-an-access-token">Get an access token</h3>
<p>We recommend that you use authentication libraries to manage your token interactions with the Microsoft identity platform. Authentication libraries abstract many protocol details like validation, cookie handling, token caching, and maintaining secure connections, that lets you focus your development on your app's functionality. Microsoft publishes open-source client libraries and server middleware.</p>
<p>For the Microsoft identity platform endpoint:</p>
<ul>
<li>Microsoft Authentication Library (MSAL) client libraries are available for various frameworks including for .NET, JavaScript, Android, and iOS. All platforms are in production-supported preview, and, in the event breaking changes are introduced, Microsoft guarantees a path to upgrade.</li>
<li>Server middleware from Microsoft is available for .NET core and ASP.NET (OWIN OpenID Connect and OAuth) and for Node.js (Microsoft identity platform Passport.js).</li>
<li>The Microsoft identity platform is also compatible with many third-party authentication libraries.</li>
</ul>
<p>For a complete list of Microsoft client libraries, Microsoft server middleware, and compatible third-party libraries, see <a href="/en-us/entra/identity-platform/" data-linktype="absolute-path">Microsoft identity platform documentation</a>.</p>
<p>You can alternatively use the Microsoft identity platform endpoints directly without the help of an authentication library. For more information, see the following articles:</p>
<ul>
<li><a href="../auth-v2-user" data-linktype="relative-path">Get access on behalf of a user</a></li>
<li><a href="../auth-v2-service" data-linktype="relative-path">Get access without a user</a></li>
</ul>
<h2 id="related-content">Related content</h2>
<ul>
<li><a href="/en-us/entra/identity-platform/" data-linktype="absolute-path">Microsoft identity platform documentation</a></li>
<li><a href="/en-us/graph/permissions-overview" data-linktype="absolute-path">Overview of Microsoft Graph permissions</a></li>
<li><a href="/en-us/graph/tutorials" data-linktype="absolute-path">Microsoft Graph tutorials</a></li>
</ul>
</div>
					
		<div
			id="ms--inline-notifications"
			class="margin-block-xs"
			data-bi-name="inline-notification"
		></div>
	 
		<div
			id="assertive-live-region"
			role="alert"
			aria-live="assertive"
			class="visually-hidden"
			aria-relevant="additions"
			aria-atomic="true"
		></div>
		<div
			id="polite-live-region"
			role="status"
			aria-live="polite"
			class="visually-hidden"
			aria-relevant="additions"
			aria-atomic="true"
		></div>
	
					
		<!-- feedback section -->
		<section
			id="site-user-feedback-footer"
			class="font-size-sm margin-top-md display-none-print display-none-desktop"
			data-test-id="site-user-feedback-footer"
			data-bi-name="site-feedback-section"
		>
			<hr class="hr" />
			<h2 id="ms--feedback" class="title is-3">Feedback</h2>
			<div class="display-flex flex-wrap-wrap align-items-center">
				<p class="font-weight-semibold margin-xxs margin-left-none">
					Was this page helpful?
				</p>
				<div class="buttons">
					<button
						class="thumb-rating-button like button button-primary button-sm"
						data-test-id="footer-rating-yes"
						data-binary-rating-response="rating-yes"
						type="button"
						title="This article is helpful"
						data-bi-name="button-rating-yes"
						aria-pressed="false"
					>
						<span class="icon" aria-hidden="true">
							<span class="docon docon-like"></span>
						</span>
						<span>Yes</span>
					</button>
					<button
						class="thumb-rating-button dislike button button-primary button-sm"
						id="standard-rating-no-button"
						hidden
						data-test-id="footer-rating-no"
						data-binary-rating-response="rating-no"
						type="button"
						title="This article is not helpful"
						data-bi-name="button-rating-no"
						aria-pressed="false"
					>
						<span class="icon" aria-hidden="true">
							<span class="docon docon-dislike"></span>
						</span>
						<span>No</span>
					</button>
					<details
						class="popover popover-top"
						id="mobile-help-popover"
						data-test-id="footer-feedback-popover"
					>
						<summary
							class="thumb-rating-button dislike button button-primary button-sm"
							data-test-id="details-footer-rating-no"
							data-binary-rating-response="rating-no"
							title="This article is not helpful"
							data-bi-name="button-rating-no"
							aria-pressed="false"
							data-bi-an="feedback-unhelpful-popover"
						>
							<span class="icon" aria-hidden="true">
								<span class="docon docon-dislike"></span>
							</span>
							<span>No</span>
						</summary>
						<div
							class="popover-content width-200 width-300-tablet"
							role="dialog"
							aria-labelledby="popover-heading"
							aria-describedby="popover-description"
						>
							<p id="popover-heading" class="font-size-lg margin-bottom-xxs font-weight-semibold">
								Need help with this topic?
							</p>
							<p id="popover-description" class="font-size-sm margin-bottom-xs">
								Want to try using Ask Learn to clarify or guide you through this topic?
							</p>
							
		<div class="buttons flex-direction-row flex-wrap justify-content-center gap-xxs">
			<div>
		<button
			class="button button-sm border inner-focus display-none margin-right-xxs"
			data-bi-name="ask-learn-assistant-entry-troubleshoot"
			data-test-id="ask-learn-assistant-modal-entry-mobile-feedback"
			data-ask-learn-modal-entry-feedback
			data-bi-an=feedback-unhelpful-popover
			type="button"
			style="min-width: max-content;"
			aria-expanded="false"
			aria-label="Ask Learn"
			hidden
		>
			<span class="icon font-size-lg" aria-hidden="true">
				<span class="docon docon-chat-sparkle-fill gradient-ask-learn-logo"></span>
			</span>
		</button>
		<button
			class="button button-sm display-inline-flex display-none-desktop flex-shrink-0 margin-right-xxs border-color-ask-learn margin-right-xxs"
			data-bi-name="ask-learn-assistant-entry-troubleshoot"
			data-bi-an=feedback-unhelpful-popover
			data-test-id="ask-learn-assistant-modal-entry-tablet-feedback"
			data-ask-learn-modal-entry-feedback
			type="button"
			style="min-width: max-content;"
			aria-expanded="false"
			hidden
		>
			<span class="icon font-size-lg" aria-hidden="true">
				<span class="docon docon-chat-sparkle-fill gradient-ask-learn-logo"></span>
			</span>
			<span>Ask Learn</span>
		</button>
		<button
			class="button button-sm display-none flex-shrink-0 display-inline-flex-desktop margin-right-xxs border-color-ask-learn margin-right-xxs"
			data-bi-name="ask-learn-assistant-entry-troubleshoot"
			data-bi-an=feedback-unhelpful-popover
			data-test-id="ask-learn-assistant-flyout-entry-feedback"
			data-ask-learn-flyout-entry-show-only
			data-flyout-button="toggle"
			type="button"
			style="min-width: max-content;"
			aria-expanded="false"
			aria-controls="ask-learn-flyout"
			hidden
		>
			<span class="icon font-size-lg" aria-hidden="true">
				<span class="docon docon-chat-sparkle-fill gradient-ask-learn-logo"></span>
			</span>
			<span>Ask Learn</span>
		</button>
	</div>
			<button
				type="button"
				class="button button-sm margin-right-xxs"
				data-help-option="suggest-fix"
				data-bi-name="feedback-suggest"
				data-bi-an="feedback-unhelpful-popover"
				data-test-id="suggest-fix"
			>
				<span class="icon" aria-hidden="true">
					<span class="docon docon-feedback"></span>
				</span>
				<span> Suggest a fix? </span>
			</button>
		</div>
	
						</div>
					</details>
				</div>
			</div>
		</section>
		<!-- end feedback section -->
	
				</div>
				
		<div id="ms--additional-resources-mobile" class="display-none-print">
			<hr class="hr" hidden />
			<h2 id="ms--additional-resources-mobile-heading" class="title is-3" hidden>
				Additional resources
			</h2>
			
		<section
			id="right-rail-recommendations-mobile"
			class=""
			data-bi-name="recommendations"
			hidden
		></section>
	 
		<section
			id="right-rail-training-mobile"
			class=""
			data-bi-name="learning-resource-card"
			hidden
		></section>
	 
		<section
			id="right-rail-events-mobile"
			class=""
			data-bi-name="events-card"
			hidden
		></section>
	
		</div>
	 
		<div
			id="article-metadata-footer"
			data-bi-name="article-metadata-footer"
			data-test-id="article-metadata-footer"
			class="page-metadata-container"
		>
			<hr class="hr" />
			<ul class="metadata page-metadata" data-bi-name="page info" lang="en-us" dir="ltr">
				<li class="visibility-hidden-visual-diff">
			<span class="badge badge-sm text-wrap-pretty">
				<span>Last updated on <local-time format="twoDigitNumeric"
		datetime="2024-12-23T15:18:00.000Z"
		data-article-date-source="calculated"
		class="is-invisible"
	>
		2024-12-23
	</local-time></span>
			</span>
		</li>
			</ul>
		</div>
	
			</div>
			
		<div
			id="action-panel"
			role="region"
			aria-label="Action Panel"
			class="action-panel"
			tabindex="-1"
		></div>
	
		
				</main>
				<aside
					id="layout-body-aside"
					class="layout-body-aside  "
					data-bi-name="aside"
					aria-label="Additional resources"
			  >
					
		<div
			id="ms--additional-resources"
			class="right-container padding-sm display-none display-block-desktop height-full"
			data-bi-name="pageactions"
		>
			<div id="affixed-right-container" data-bi-name="right-column">
				
		<nav
			id="side-doc-outline"
			class="doc-outline border-bottom padding-bottom-xs margin-bottom-xs scrollbar-width-thin"
			data-bi-name="intopic toc"
			aria-label="In this article"
		>
			<h3>In this article</h3>
		</nav>
	
				<!-- Feedback -->
				
		<section
			id="ms--site-user-feedback-right-rail"
			class="font-size-sm display-none-print"
			data-test-id="site-user-feedback-right-rail"
			data-bi-name="site-feedback-right-rail"
		>
			<div class="display-flex flex-wrap-wrap align-items-center">
				<p class="font-weight-semibold margin-xxs margin-left-none">
					Was this page helpful?
				</p>
				<div class="display-flex flex-wrap-nowrap">
					<button
						class="thumb-rating-button like inner-focus"
						data-test-id="right-rail-rating-yes"
						data-binary-rating-response="rating-yes"
						type="button"
						title="This article is helpful"
						aria-label="This article is helpful"
						data-bi-name="button-rating-yes"
						aria-pressed="false"
					>
						<span class="icon" aria-hidden="true">
							<span class="docon docon-like"></span>
						</span>
					</button>
					<button
						class="thumb-rating-button dislike inner-focus"
						id="right-rail-no-button"
						hidden
						data-test-id="right-rail-rating-no"
						data-binary-rating-response="rating-no"
						type="button"
						title="This article is not helpful"
						aria-label="This article is not helpful"
						data-bi-name="button-rating-no"
						aria-pressed="false"
					>
						<span class="icon" aria-hidden="true">
							<span class="docon docon-dislike"></span>
						</span>
					</button>
					<details class="popover popover-right" id="help-popover" data-test-id="feedback-popover">
						<summary
							tabindex="0"
							class="thumb-rating-button dislike inner-focus"
							data-test-id="details-right-rail-rating-no"
							data-binary-rating-response="rating-no"
							title="This article is not helpful"
							aria-label="This article is not helpful"
							data-bi-name="button-rating-no"
							aria-pressed="false"
							data-bi-an="feedback-unhelpful-popover"
						>
							<span class="icon" aria-hidden="true">
								<span class="docon docon-dislike"></span>
							</span>
						</summary>
						<div
							class="popover-content width-200 width-300-tablet"
							role="dialog"
							aria-labelledby="popover-heading-right-rail"
							aria-describedby="popover-description-right-rail"
						>
							<p
								id="popover-heading-right-rail"
								class="font-size-lg margin-bottom-xxs font-weight-semibold"
							>
								Need help with this topic?
							</p>
							<p id="popover-description-right-rail" class="font-size-sm margin-bottom-xs">
								Want to try using Ask Learn to clarify or guide you through this topic?
							</p>
							
		<div class="buttons flex-direction-row flex-wrap justify-content-center gap-xxs">
			<div>
		<button
			class="button button-sm border inner-focus display-none margin-right-xxs"
			data-bi-name="ask-learn-assistant-entry-troubleshoot"
			data-test-id="ask-learn-assistant-modal-entry-mobile-feedback"
			data-ask-learn-modal-entry-feedback
			data-bi-an=feedback-unhelpful-popover
			type="button"
			style="min-width: max-content;"
			aria-expanded="false"
			aria-label="Ask Learn"
			hidden
		>
			<span class="icon font-size-lg" aria-hidden="true">
				<span class="docon docon-chat-sparkle-fill gradient-ask-learn-logo"></span>
			</span>
		</button>
		<button
			class="button button-sm display-inline-flex display-none-desktop flex-shrink-0 margin-right-xxs border-color-ask-learn margin-right-xxs"
			data-bi-name="ask-learn-assistant-entry-troubleshoot"
			data-bi-an=feedback-unhelpful-popover
			data-test-id="ask-learn-assistant-modal-entry-tablet-feedback"
			data-ask-learn-modal-entry-feedback
			type="button"
			style="min-width: max-content;"
			aria-expanded="false"
			hidden
		>
			<span class="icon font-size-lg" aria-hidden="true">
				<span class="docon docon-chat-sparkle-fill gradient-ask-learn-logo"></span>
			</span>
			<span>Ask Learn</span>
		</button>
		<button
			class="button button-sm display-none flex-shrink-0 display-inline-flex-desktop margin-right-xxs border-color-ask-learn margin-right-xxs"
			data-bi-name="ask-learn-assistant-entry-troubleshoot"
			data-bi-an=feedback-unhelpful-popover
			data-test-id="ask-learn-assistant-flyout-entry-feedback"
			data-ask-learn-flyout-entry-show-only
			data-flyout-button="toggle"
			type="button"
			style="min-width: max-content;"
			aria-expanded="false"
			aria-controls="ask-learn-flyout"
			hidden
		>
			<span class="icon font-size-lg" aria-hidden="true">
				<span class="docon docon-chat-sparkle-fill gradient-ask-learn-logo"></span>
			</span>
			<span>Ask Learn</span>
		</button>
	</div>
			<button
				type="button"
				class="button button-sm margin-right-xxs"
				data-help-option="suggest-fix"
				data-bi-name="feedback-suggest"
				data-bi-an="feedback-unhelpful-popover"
				data-test-id="suggest-fix"
			>
				<span class="icon" aria-hidden="true">
					<span class="docon docon-feedback"></span>
				</span>
				<span> Suggest a fix? </span>
			</button>
		</div>
	
						</div>
					</details>
				</div>
			</div>
		</section>
	
			</div>
		</div>
	
			  </aside> <section
					id="layout-body-flyout"
					class="layout-body-flyout "
					data-bi-name="flyout"
			  >
					 <div
	class="height-full border-left background-color-body-medium"
	id="ask-learn-flyout"
></div>
			  </section> <div class="layout-body-footer " data-bi-name="layout-footer">
		<footer
			id="footer"
			data-test-id="footer"
			data-bi-name="footer"
			class="footer-layout padding-xs padding-sm-desktop has-default-focus border-top"
			role="contentinfo"
		>
			<div class="display-flex gap-xs flex-wrap-wrap is-full-height padding-right-lg-desktop">
				
		<a
			data-mscc-ic="false"
			href="#"
			data-bi-name="select-locale"
			class="locale-selector-link flex-shrink-0 button button-sm button-clear external-link-indicator"
			id=""
			title=""
			><span class="icon" aria-hidden="true"
				><span class="docon docon-world"></span></span
			><span class="local-selector-link-text">en-us</span></a
		>
	 <div class="ccpa-privacy-link" data-ccpa-privacy-link hidden>
		
		<a
			data-mscc-ic="false"
			href="https://aka.ms/yourcaliforniaprivacychoices"
			data-bi-name="your-privacy-choices"
			class="button button-sm button-clear flex-shrink-0 external-link-indicator"
			id=""
			title=""
			>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 30 14"
			xml:space="preserve"
			height="16"
			width="43"
			aria-hidden="true"
			focusable="false"
		>
			<path
				d="M7.4 12.8h6.8l3.1-11.6H7.4C4.2 1.2 1.6 3.8 1.6 7s2.6 5.8 5.8 5.8z"
				style="fill-rule:evenodd;clip-rule:evenodd;fill:#fff"
			></path>
			<path
				d="M22.6 0H7.4c-3.9 0-7 3.1-7 7s3.1 7 7 7h15.2c3.9 0 7-3.1 7-7s-3.2-7-7-7zm-21 7c0-3.2 2.6-5.8 5.8-5.8h9.9l-3.1 11.6H7.4c-3.2 0-5.8-2.6-5.8-5.8z"
				style="fill-rule:evenodd;clip-rule:evenodd;fill:#06f"
			></path>
			<path
				d="M24.6 4c.2.2.2.6 0 .8L22.5 7l2.2 2.2c.2.2.2.6 0 .8-.2.2-.6.2-.8 0l-2.2-2.2-2.2 2.2c-.2.2-.6.2-.8 0-.2-.2-.2-.6 0-.8L20.8 7l-2.2-2.2c-.2-.2-.2-.6 0-.8.2-.2.6-.2.8 0l2.2 2.2L23.8 4c.2-.2.6-.2.8 0z"
				style="fill:#fff"
			></path>
			<path
				d="M12.7 4.1c.2.2.3.6.1.8L8.6 9.8c-.1.1-.2.2-.3.2-.2.1-.5.1-.7-.1L5.4 7.7c-.2-.2-.2-.6 0-.8.2-.2.6-.2.8 0L8 8.6l3.8-4.5c.2-.2.6-.2.9 0z"
				style="fill:#06f"
			></path>
		</svg>
	
			<span>Your Privacy Choices</span></a
		>
	
	</div>
				<div class="flex-shrink-0">
		<div class="dropdown has-caret-up">
			<button
				data-test-id="theme-selector-button"
				class="dropdown-trigger button button-clear button-sm inner-focus theme-dropdown-trigger"
				aria-controls="{{ themeMenuId }}"
				aria-expanded="false"
				title="Theme"
				data-bi-name="theme"
			>
				<span class="icon" aria-hidden="true"><span class="docon docon-sun"></span></span>
				<span>Theme</span>
				<span class="icon expanded-indicator" aria-hidden="true">
					<span class="docon docon-chevron-down-light"></span>
				</span>
			</button>
			<div class="dropdown-menu" id="{{ themeMenuId }}" role="menu">
				<ul class="theme-selector padding-xxs" data-test-id="theme-dropdown-menu">
					<li class="theme display-block">
						<button
							class="button button-clear button-sm theme-control button-block justify-content-flex-start text-align-left"
							data-theme-to="light"
						>
							<span class="theme-light margin-right-xxs">
								<span
									class="theme-selector-icon border display-inline-block has-body-background"
									aria-hidden="true"
								>
									<svg class="svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 22 14">
										<rect width="22" height="14" class="has-fill-body-background" />
										<rect x="5" y="5" width="12" height="4" class="has-fill-secondary" />
										<rect x="5" y="2" width="2" height="1" class="has-fill-secondary" />
										<rect x="8" y="2" width="2" height="1" class="has-fill-secondary" />
										<rect x="11" y="2" width="3" height="1" class="has-fill-secondary" />
										<rect x="1" y="1" width="2" height="2" class="has-fill-secondary" />
										<rect x="5" y="10" width="7" height="2" rx="0.3" class="has-fill-primary" />
										<rect x="19" y="1" width="2" height="2" rx="1" class="has-fill-secondary" />
									</svg>
								</span>
							</span>
							<span role="menuitem"> Light </span>
						</button>
					</li>
					<li class="theme display-block">
						<button
							class="button button-clear button-sm theme-control button-block justify-content-flex-start text-align-left"
							data-theme-to="dark"
						>
							<span class="theme-dark margin-right-xxs">
								<span
									class="border theme-selector-icon display-inline-block has-body-background"
									aria-hidden="true"
								>
									<svg class="svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 22 14">
										<rect width="22" height="14" class="has-fill-body-background" />
										<rect x="5" y="5" width="12" height="4" class="has-fill-secondary" />
										<rect x="5" y="2" width="2" height="1" class="has-fill-secondary" />
										<rect x="8" y="2" width="2" height="1" class="has-fill-secondary" />
										<rect x="11" y="2" width="3" height="1" class="has-fill-secondary" />
										<rect x="1" y="1" width="2" height="2" class="has-fill-secondary" />
										<rect x="5" y="10" width="7" height="2" rx="0.3" class="has-fill-primary" />
										<rect x="19" y="1" width="2" height="2" rx="1" class="has-fill-secondary" />
									</svg>
								</span>
							</span>
							<span role="menuitem"> Dark </span>
						</button>
					</li>
					<li class="theme display-block">
						<button
							class="button button-clear button-sm theme-control button-block justify-content-flex-start text-align-left"
							data-theme-to="high-contrast"
						>
							<span class="theme-high-contrast margin-right-xxs">
								<span
									class="border theme-selector-icon display-inline-block has-body-background"
									aria-hidden="true"
								>
									<svg class="svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 22 14">
										<rect width="22" height="14" class="has-fill-body-background" />
										<rect x="5" y="5" width="12" height="4" class="has-fill-secondary" />
										<rect x="5" y="2" width="2" height="1" class="has-fill-secondary" />
										<rect x="8" y="2" width="2" height="1" class="has-fill-secondary" />
										<rect x="11" y="2" width="3" height="1" class="has-fill-secondary" />
										<rect x="1" y="1" width="2" height="2" class="has-fill-secondary" />
										<rect x="5" y="10" width="7" height="2" rx="0.3" class="has-fill-primary" />
										<rect x="19" y="1" width="2" height="2" rx="1" class="has-fill-secondary" />
									</svg>
								</span>
							</span>
							<span role="menuitem"> High contrast </span>
						</button>
					</li>
				</ul>
			</div>
		</div>
	</div>
			</div>
			<ul class="links" data-bi-name="footerlinks">
				<li class="manage-cookies-holder" hidden=""></li>
				<li>
		
		<a
			data-mscc-ic="false"
			href="https://learn.microsoft.com/en-us/principles-for-ai-generated-content"
			data-bi-name="aiDisclaimer"
			class=" external-link-indicator"
			id=""
			title=""
			>AI Disclaimer</a
		>
	
	</li><li>
		
		<a
			data-mscc-ic="false"
			href="https://learn.microsoft.com/en-us/previous-versions/"
			data-bi-name="archivelink"
			class=" external-link-indicator"
			id=""
			title=""
			>Previous Versions</a
		>
	
	</li> <li>
		
		<a
			data-mscc-ic="false"
			href="https://techcommunity.microsoft.com/t5/microsoft-learn-blog/bg-p/MicrosoftLearnBlog"
			data-bi-name="bloglink"
			class=" external-link-indicator"
			id=""
			title=""
			>Blog</a
		>
	
	</li> <li>
		
		<a
			data-mscc-ic="false"
			href="https://learn.microsoft.com/en-us/contribute"
			data-bi-name="contributorGuide"
			class=" external-link-indicator"
			id=""
			title=""
			>Contribute</a
		>
	
	</li><li>
		
		<a
			data-mscc-ic="false"
			href="https://go.microsoft.com/fwlink/?LinkId=521839"
			data-bi-name="privacy"
			class=" external-link-indicator"
			id=""
			title=""
			>Privacy</a
		>
	
	</li><li>
		
		<a
			data-mscc-ic="false"
			href="https://go.microsoft.com/fwlink/?linkid=2259814"
			data-bi-name="consumer-health-privacy"
			class=" external-link-indicator"
			id=""
			title=""
			>Consumer Health Privacy</a
		>
	
	</li><li>
		
		<a
			data-mscc-ic="false"
			href="https://learn.microsoft.com/en-us/legal/termsofuse"
			data-bi-name="termsofuse"
			class=" external-link-indicator"
			id=""
			title=""
			>Terms of Use</a
		>
	
	</li><li>
		
		<a
			data-mscc-ic="false"
			href="https://www.microsoft.com/legal/intellectualproperty/Trademarks/"
			data-bi-name="trademarks"
			class=" external-link-indicator"
			id=""
			title=""
			>Trademarks</a
		>
	
	</li>
				<li>&copy; Microsoft 2026</li>
			</ul>
		</footer>
	</footer>
			</body>
		</html>