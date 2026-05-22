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
			<title>Create subscription - Microsoft Graph v1.0 | Microsoft Learn</title>
			<meta charset="utf-8" />
			<meta name="viewport" content="width=device-width, initial-scale=1.0" />
			<meta name="color-scheme" content="light dark" />

			<meta name="description" content="Subscribes a listener application to receive change notifications when data on the Microsoft Graph changes." />
			<link rel="canonical" href="https://learn.microsoft.com/en-us/graph/api/subscription-post-subscriptions?view=graph-rest-1.0" /> 

			<!-- Non-customizable open graph and sharing-related metadata -->
			<meta name="twitter:card" content="summary_large_image" />
			<meta name="twitter:site" content="@MicrosoftLearn" />
			<meta property="og:type" content="website" />
			<meta property="og:image:alt" content="Microsoft Learn" />
			<meta property="og:image" content="https://learn.microsoft.com/en-us/media/open-graph-image.png" />
			<!-- Page specific open graph and sharing-related metadata -->
			<meta property="og:title" content="Create subscription - Microsoft Graph v1.0" />
			<meta property="og:url" content="https://learn.microsoft.com/en-us/graph/api/subscription-post-subscriptions?view=graph-rest-1.0" />
			<meta property="og:description" content="Subscribes a listener application to receive change notifications when data on the Microsoft Graph changes." />
			<meta name="platform_id" content="2f513d94-dff3-65be-6829-596fc072586b" /> <meta name="scope" content="graph" />
			<meta name="locale" content="en-us" />
			 
			<meta name="uhfHeaderId" content="MSDocsHeader-MSGraph" />

			<meta name="page_type" content="conceptual" />

			<!--page specific meta tags-->
			

			<!-- custom meta tags -->
			
		<meta name="feedback_system" content="Standard" />
	
		<meta name="feedback_product_url" content="https://developer.microsoft.com/graph/support" />
	
		<meta name="author" content="jessieli-ad" />
	
		<meta name="ms.author" content="MSGraphDocsVteam" />
	
		<meta name="ms.suite" content="microsoft-graph" />
	
		<meta name="ms.subservice" content="change-notifications" />
	
		<meta name="toc_preview" content="true" />
	
		<meta name="recommendations" content="false" />
	
		<meta name="breadcrumb_path" content="/graph/ref-breadcrumb/toc.json" />
	
		<meta name="monikerRange" content="graph-rest-1.0" />
	
		<meta name="ms.service" content="microsoft-graph" />
	
		<meta name="ms.topic" content="reference" />
	
		<meta name="ms.localizationpriority" content="high" />
	
		<meta name="doc_type" content="apiPageType" />
	
		<meta name="ms.date" content="2024-10-28T00:00:00Z" />
	
		<meta name="document_id" content="2f20de46-dc28-3cde-642a-4a7fb7b2f454" />
	
		<meta name="document_version_independent_id" content="be834d56-fb0c-0f16-31f8-287221ba6cc4" />
	
		<meta name="updated_at" content="2026-04-07T22:18:00Z" />
	
		<meta name="original_content_git_url" content="https://github.com/microsoftgraph/microsoft-graph-docs/blob/live/api-reference/v1.0/api/subscription-post-subscriptions.md" />
	
		<meta name="gitcommit" content="https://github.com/microsoftgraph/microsoft-graph-docs/blob/21697e2b8a5734da63402b5298de0ee1d7230641/api-reference/v1.0/api/subscription-post-subscriptions.md" />
	
		<meta name="git_commit_id" content="21697e2b8a5734da63402b5298de0ee1d7230641" />
	
		<meta name="monikers" content="graph-rest-1.0" />
	
		<meta name="default_moniker" content="graph-rest-1.0" />
	
		<meta name="site_name" content="Docs" />
	
		<meta name="depot_name" content="MSDN.microsoft-graph-ref" />
	
		<meta name="schema" content="Conceptual" />
	
		<meta name="toc_rel" content="toc.json" />
	
		<meta name="feedback_help_link_type" content="" />
	
		<meta name="feedback_help_link_url" content="" />
	
		<meta name="word_count" content="2258" />
	
		<meta name="config_moniker_range" content="&gt;= graph-rest-1.0" />
	
		<meta name="asset_id" content="api/subscription-post-subscriptions" />
	
		<meta name="moniker_range_name" content="107bf06837724705de50667b407c0197" />
	
		<meta name="item_type" content="Content" />
	
		<meta name="source_path" content="api-reference/v1.0/api/subscription-post-subscriptions.md" />
	
		<meta name="previous_tlsh_hash" content="3BF50072A6C6EA00F9B36B162413C06030E583995DF89BD909BE05F6E1492C762E6B7DF6DB7BBD44EA35518700E37D09DCCF7B79B1B9A2826539DBE54206A2423CCD7A3720" />
	
		<meta name="github_feedback_content_git_url" content="https://github.com/microsoftgraph/microsoft-graph-docs-contrib/blob/main/api-reference/v1.0/api/subscription-post-subscriptions.md" />
	
		<meta name="markdown_url" content="https://learn.microsoft.com/en-us/graph/api/subscription-post-subscriptions?view=graph-rest-1.0&amp;accept=text/markdown" />
	 
		<meta name="cmProducts" content="https://authoring-docs-microsoft.poolparty.biz/devrel/63959238-cb90-4871-a33d-4a5519097e47" data-source="generated" />
	
		<meta name="cmProducts" content="https://authoring-docs-microsoft.poolparty.biz/devrel/5fc61396-d075-4560-aece-fdbda73d243f" data-source="generated" />
	
		<meta name="cmProducts" content="https://microsoft-devrel.poolparty.biz/DevRelOfferingOntology/46e3c7c4-fe77-4a6e-b40a-44c569819fa5" data-source="generated" />
	
		<meta name="spProducts" content="https://authoring-docs-microsoft.poolparty.biz/devrel/78d87f42-5582-4a6b-90be-7db2f12b34e6" data-source="generated" />
	
		<meta name="spProducts" content="https://authoring-docs-microsoft.poolparty.biz/devrel/ad9437c1-8cda-4537-ad69-b4b263652e13" data-source="generated" />
	
		<meta name="spProducts" content="https://microsoft-devrel.poolparty.biz/DevRelOfferingOntology/d0c6fab8-2d7d-4bb0-bf40-589e08d7c132" data-source="generated" />
	

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
    "hasRecommendations": false,
    "contributors": [
      {
        "name": "jessieli-ad",
        "url": "https://github.com/jessieli-ad"
      },
      {
        "name": "FaithOmbongi",
        "url": "https://github.com/FaithOmbongi"
      },
      {
        "name": "jasonjoh",
        "url": "https://github.com/jasonjoh"
      },
      {
        "name": "openpublishbuild",
        "url": "https://github.com/openpublishbuild"
      },
      {
        "name": "Danielabom",
        "url": "https://github.com/Danielabom"
      },
      {
        "name": "KirtiJha-MSFT",
        "url": "https://github.com/KirtiJha-MSFT"
      },
      {
        "name": "garchiro7",
        "url": "https://github.com/garchiro7"
      },
      {
        "name": "Saisang",
        "url": "https://github.com/Saisang"
      },
      {
        "name": "patrick-rodgers",
        "url": "https://github.com/patrick-rodgers"
      },
      {
        "name": "mnorman-ms",
        "url": "https://github.com/mnorman-ms"
      },
      {
        "name": "JarbasHorst",
        "url": "https://github.com/JarbasHorst"
      },
      {
        "name": "Lana-Chin",
        "url": "https://github.com/Lana-Chin"
      },
      {
        "name": "MichaelNorman",
        "url": "https://github.com/MichaelNorman"
      },
      {
        "name": "Lauragra",
        "url": "https://github.com/Lauragra"
      },
      {
        "name": "Anjali-Patle",
        "url": "https://github.com/Anjali-Patle"
      },
      {
        "name": "eddie-lee-msft",
        "url": "https://github.com/eddie-lee-msft"
      },
      {
        "name": "benlee-msft",
        "url": "https://github.com/benlee-msft"
      },
      {
        "name": "v-sdhakshina",
        "url": "https://github.com/v-sdhakshina"
      },
      {
        "name": "bcage29",
        "url": "https://github.com/bcage29"
      },
      {
        "name": "keylimesoda",
        "url": "https://github.com/keylimesoda"
      },
      {
        "name": "abheek-das",
        "url": "https://github.com/abheek-das"
      },
      {
        "name": "abshar-teams",
        "url": "https://github.com/abshar-teams"
      },
      {
        "name": "angelgolfer-ms",
        "url": "https://github.com/angelgolfer-ms"
      },
      {
        "name": "jumasure",
        "url": "https://github.com/jumasure"
      },
      {
        "name": "avijityadav",
        "url": "https://github.com/avijityadav"
      },
      {
        "name": "jecha-ms",
        "url": "https://github.com/jecha-ms"
      },
      {
        "name": "elvinyang-msft",
        "url": "https://github.com/elvinyang-msft"
      },
      {
        "name": "baywet",
        "url": "https://github.com/baywet"
      },
      {
        "name": "JeremyKelley",
        "url": "https://github.com/JeremyKelley"
      },
      {
        "name": "davidmu1",
        "url": "https://github.com/davidmu1"
      },
      {
        "name": "Jumaodhiss",
        "url": "https://github.com/Jumaodhiss"
      },
      {
        "name": "RamjotSingh",
        "url": "https://github.com/RamjotSingh"
      },
      {
        "name": "nkramer",
        "url": "https://github.com/nkramer"
      },
      {
        "name": "laujan",
        "url": "https://github.com/laujan"
      },
      {
        "name": "BakkerJan",
        "url": "https://github.com/BakkerJan"
      },
      {
        "name": "GageAmes",
        "url": "https://github.com/GageAmes"
      },
      {
        "name": "learafa",
        "url": "https://github.com/learafa"
      },
      {
        "name": "jthake",
        "url": "https://github.com/jthake"
      },
      {
        "name": "millicentachieng",
        "url": "https://github.com/millicentachieng"
      },
      {
        "name": "andrueastman",
        "url": "https://github.com/andrueastman"
      },
      {
        "name": "OfficeGSX",
        "url": "https://github.com/OfficeGSX"
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
			
			href="https://github.com/microsoftgraph/microsoft-graph-docs-contrib/blob/main/api-reference/v1.0/api/subscription-post-subscriptions.md"
			data-original_content_git_url="https://github.com/microsoftgraph/microsoft-graph-docs/blob/live/api-reference/v1.0/api/subscription-post-subscriptions.md"
			data-original_content_git_url_template="{repo}/blob/{branch}/api-reference/v1.0/api/subscription-post-subscriptions.md"
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
	
					<div class="content"><h1 id="create-subscription">Create subscription</h1></div>
					
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
	
					<div class="content"><p>Namespace: microsoft.graph</p>
<p>Subscribes a listener application to receive change notifications when the requested type of changes occur to the specified resource in Microsoft Graph.</p>
<p>To identify the resources for which you can create subscriptions and the limitations on subscriptions, see <a href="/en-us/graph/change-notifications-overview#supported-resources" data-linktype="absolute-path">Set up notifications for changes in resource data: Supported resources</a>.</p>
<p>Some resources support rich notifications, that is, notifications that include resource data. For more information about these resources, see <a href="/en-us/graph/change-notifications-with-resource-data#supported-resources" data-linktype="absolute-path">Set up change notifications that include resource data: Supported resources</a>.</p>
<!-- markdownlint-disable MD041-->
<p>This API is available in the following <a href="/en-us/graph/deployments" data-linktype="absolute-path">national cloud deployments</a>.</p>
<table>
<thead>
<tr>
<th>Global service</th>
<th>US Government L4</th>
<th>US Government L5 (DOD)</th>
<th>China operated by 21Vianet</th>
</tr>
</thead>
<tbody>
<tr>
<td>✅</td>
<td>✅</td>
<td>✅</td>
<td>✅</td>
</tr>
</tbody>
</table>
<h2 id="permissions">Permissions</h2>
<p>To create a subscription, your app must have read permissions for the resource. For example, to get change notifications for messages, your app needs the <code>Mail.Read</code> permission.</p>
<p>Depending on the resource and the permission type (delegated or application) requested, the permission specified in the following table is the least privileged required to call this API. To learn more, including <a href="/en-us/graph/auth/auth-concepts#best-practices-for-requesting-permissions" data-linktype="absolute-path">taking caution</a> before choosing the permissions, search for the following permissions in <a href="/en-us/graph/permissions-reference" data-linktype="absolute-path">Permissions</a>.</p>
<table>
<thead>
<tr>
<th style="text-align: left;">Supported resource</th>
<th style="text-align: left;">Delegated (work or school account)</th>
<th style="text-align: left;">Delegated (personal Microsoft account)</th>
<th style="text-align: left;">Application</th>
</tr>
</thead>
<tbody>
<tr>
<td style="text-align: left;"><a href="/en-us/microsoft-365-copilot/extensibility/api/ai-services/interaction-export/resources/aiinteraction" data-linktype="absolute-path">aiInteraction</a>  <br> <code>copilot/users/{userId}/interactionHistory/getAllEnterpriseInteractions</code>  <br> Copilot AI interactions that a particular user is part of.</td>
<td style="text-align: left;">AiEnterpriseInteraction.Read</td>
<td style="text-align: left;">Not supported.</td>
<td style="text-align: left;">AiEnterpriseInteraction.Read.All, AiEnterpriseInteraction.Read.User</td>
</tr>
<tr>
<td style="text-align: left;"><a href="/en-us/microsoft-365-copilot/extensibility/api/ai-services/interaction-export/resources/aiinteraction" data-linktype="absolute-path">aiInteraction</a>  <br> <code>copilot/interactionHistory/getAllEnterpriseInteractions</code>  <br> Copilot AI interactions in an organization.</td>
<td style="text-align: left;">Not supported.</td>
<td style="text-align: left;">Not supported.</td>
<td style="text-align: left;">AiEnterpriseInteraction.Read.All</td>
</tr>
<tr>
<td style="text-align: left;"><a href="resources/callrecords-callrecord?view=graph-rest-1.0" data-linktype="relative-path">callRecord</a> (/communications/callRecords)</td>
<td style="text-align: left;">Not supported</td>
<td style="text-align: left;">Not supported</td>
<td style="text-align: left;">CallRecords.Read.All</td>
</tr>
<tr>
<td style="text-align: left;"><a href="resources/callrecording?view=graph-rest-1.0" data-linktype="relative-path">callRecording</a> <br> <code>communications/onlineMeetings/getAllRecordings</code> <br> All recordings in an organization.</td>
<td style="text-align: left;">Not supported.</td>
<td style="text-align: left;">Not supported.</td>
<td style="text-align: left;">OnlineMeetingRecording.Read.All</td>
</tr>
<tr>
<td style="text-align: left;"><a href="resources/callrecording?view=graph-rest-1.0" data-linktype="relative-path">callRecording</a> <br> <code>communications/onlineMeetings/{onlineMeetingId}/recordings</code> <br> All recordings for a specific meeting.</td>
<td style="text-align: left;">OnlineMeetingRecording.Read.All</td>
<td style="text-align: left;">Not supported.</td>
<td style="text-align: left;">OnlineMeetingRecording.Read.All</td>
</tr>
<tr>
<td style="text-align: left;"><a href="resources/callrecording?view=graph-rest-1.0" data-linktype="relative-path">callRecording</a> <br> <code>users/{userId}/onlineMeetings/getAllRecordings</code>  <br> A call recording that becomes available in a meeting organized by a specific user.</td>
<td style="text-align: left;">OnlineMeetingRecording.Read.All</td>
<td style="text-align: left;">Not supported.</td>
<td style="text-align: left;">OnlineMeetingRecording.Read.All</td>
</tr>
<tr>
<td style="text-align: left;"><a href="resources/calltranscript?view=graph-rest-1.0" data-linktype="relative-path">callTranscript</a> <br> <code>communications/onlineMeetings/getAllTranscripts</code> <br> All transcripts in an organization.</td>
<td style="text-align: left;">Not supported.</td>
<td style="text-align: left;">Not supported.</td>
<td style="text-align: left;">OnlineMeetingTranscript.Read.All</td>
</tr>
<tr>
<td style="text-align: left;"><a href="resources/calltranscript?view=graph-rest-1.0" data-linktype="relative-path">callTranscript</a> <br> <code>communications/onlineMeetings/{onlineMeetingId}/transcripts</code> <br> All transcripts for a specific meeting.</td>
<td style="text-align: left;">OnlineMeetingTranscript.Read.All</td>
<td style="text-align: left;">Not supported.</td>
<td style="text-align: left;">OnlineMeetingTranscript.Read.All</td>
</tr>
<tr>
<td style="text-align: left;"><a href="resources/calltranscript?view=graph-rest-1.0" data-linktype="relative-path">callTranscript</a> <br> <code>users/{userId}/onlineMeetings/getAllTranscripts</code> <br> A call transcript that becomes available in a meeting organized by a specific user.</td>
<td style="text-align: left;">OnlineMeetingTranscript.Read.All</td>
<td style="text-align: left;">Not supported.</td>
<td style="text-align: left;">OnlineMeetingTranscript.Read.All</td>
</tr>
<tr>
<td style="text-align: left;"><a href="resources/channel?view=graph-rest-1.0" data-linktype="relative-path">channel</a> (/teams/getAllChannels – all channels in an organization)</td>
<td style="text-align: left;">Not supported</td>
<td style="text-align: left;">Not supported</td>
<td style="text-align: left;">Channel.ReadBasic.All, ChannelSettings.Read.All</td>
</tr>
<tr>
<td style="text-align: left;"><a href="resources/channel?view=graph-rest-1.0" data-linktype="relative-path">channel</a> (/teams/{id}/channels)</td>
<td style="text-align: left;">Channel.ReadBasic.All, ChannelSettings.Read.All</td>
<td style="text-align: left;">Not supported</td>
<td style="text-align: left;">Channel.ReadBasic.All, ChannelSettings.Read.All</td>
</tr>
<tr>
<td style="text-align: left;"><a href="resources/chat?view=graph-rest-1.0" data-linktype="relative-path">chat</a> (/chats – all chats in an organization)</td>
<td style="text-align: left;">Not supported</td>
<td style="text-align: left;">Not supported</td>
<td style="text-align: left;">Chat.ReadBasic.All, Chat.Read.All, Chat.ReadWrite.All</td>
</tr>
<tr>
<td style="text-align: left;"><a href="resources/chat?view=graph-rest-1.0" data-linktype="relative-path">chat</a> (/chats/{id})</td>
<td style="text-align: left;">Chat.ReadBasic, Chat.Read, Chat.ReadWrite</td>
<td style="text-align: left;">Not supported</td>
<td style="text-align: left;">ChatSettings.Read.Chat*, ChatSettings.ReadWrite.Chat*, Chat.Manage.Chat*, Chat.ReadBasic.All, Chat.Read.All, Chat.ReadWrite.All</td>
</tr>
<tr>
<td style="text-align: left;"><a href="resources/chat?view=graph-rest-1.0" data-linktype="relative-path">chat</a> <br>/appCatalogs/teamsApps/{id}/installedToChats <br>All chats in an organization where a particular Teams app is installed.</td>
<td style="text-align: left;">Not supported</td>
<td style="text-align: left;">Not supported</td>
<td style="text-align: left;">Chat.ReadBasic.WhereInstalled, Chat.Read.WhereInstalled, Chat.ReadWrite.WhereInstalled</td>
</tr>
<tr>
<td style="text-align: left;"><a href="resources/chat?view=graph-rest-1.0" data-linktype="relative-path">chat</a> <br><code>/users/{id}/chats</code> <br> All chats that a particular user is part of.</td>
<td style="text-align: left;">Chat.ReadBasic, Chat.Read, Chat.ReadWrite</td>
<td style="text-align: left;">Not supported.</td>
<td style="text-align: left;">Chat.ReadBasic.All, Chat.Read.All, Chat.ReadWrite.All</td>
</tr>
<tr>
<td style="text-align: left;"><a href="resources/chatmessage?view=graph-rest-1.0" data-linktype="relative-path">chatMessage</a> (/teams/{id}/channels/{id}/messages)</td>
<td style="text-align: left;">ChannelMessage.Read.All</td>
<td style="text-align: left;">Not supported</td>
<td style="text-align: left;">ChannelMessage.Read.Group*, ChannelMessage.Read.All</td>
</tr>
<tr>
<td style="text-align: left;"><a href="resources/chatmessage?view=graph-rest-1.0" data-linktype="relative-path">chatMessage</a> (/teams/getAllMessages -- all channel messages in organization)</td>
<td style="text-align: left;">Not supported</td>
<td style="text-align: left;">Not supported</td>
<td style="text-align: left;">ChannelMessage.Read.All</td>
</tr>
<tr>
<td style="text-align: left;"><a href="resources/chatmessage?view=graph-rest-1.0" data-linktype="relative-path">chatMessage</a> (/chats/{id}/messages)</td>
<td style="text-align: left;">Chat.Read, Chat.ReadWrite</td>
<td style="text-align: left;">Not supported</td>
<td style="text-align: left;">Chat.Read.All</td>
</tr>
<tr>
<td style="text-align: left;"><a href="resources/chatmessage?view=graph-rest-1.0" data-linktype="relative-path">chatMessage</a> (/chats/getAllMessages -- all chat messages in organization)</td>
<td style="text-align: left;">Not supported</td>
<td style="text-align: left;">Not supported</td>
<td style="text-align: left;">Chat.Read.All</td>
</tr>
<tr>
<td style="text-align: left;"><a href="resources/chatmessage?view=graph-rest-1.0" data-linktype="relative-path">chatMessage</a> (/users/{id}/chats/getAllMessages -- chat messages for all chats a particular user is part of)</td>
<td style="text-align: left;">Chat.Read, Chat.ReadWrite</td>
<td style="text-align: left;">Not supported</td>
<td style="text-align: left;">Chat.Read.All, Chat.ReadWrite.All</td>
</tr>
<tr>
<td style="text-align: left;"><a href="resources/chatmessage?view=graph-rest-1.0" data-linktype="relative-path">chatMessage</a> <br>/appCatalogs/teamsApps/{id}/installedToChats/getAllMessages <br>Chat messages for all chats in an organization where a particular Teams app is installed.</td>
<td style="text-align: left;">Not supported</td>
<td style="text-align: left;">Not supported</td>
<td style="text-align: left;">Chat.Read.WhereInstalled, Chat.ReadWrite.WhereInstalled</td>
</tr>
<tr>
<td style="text-align: left;"><a href="resources/contact?view=graph-rest-1.0" data-linktype="relative-path">contact</a></td>
<td style="text-align: left;">Contacts.Read</td>
<td style="text-align: left;">Contacts.Read</td>
<td style="text-align: left;">Contacts.Read</td>
</tr>
<tr>
<td style="text-align: left;"><a href="resources/conversationmember?view=graph-rest-1.0" data-linktype="relative-path">conversationMember</a> (/chats/getAllMembers)</td>
<td style="text-align: left;">Not supported</td>
<td style="text-align: left;">Not supported</td>
<td style="text-align: left;">ChatMember.Read.All, ChatMember.ReadWrite.All, Chat.ReadBasic.All, Chat.Read.All, Chat.ReadWrite.All</td>
</tr>
<tr>
<td style="text-align: left;"><a href="resources/conversationmember?view=graph-rest-1.0" data-linktype="relative-path">conversationMember</a> (/chats/{id}/members)</td>
<td style="text-align: left;">ChatMember.Read, ChatMember.ReadWrite, Chat.ReadBasic, Chat.Read, Chat.ReadWrite</td>
<td style="text-align: left;">Not supported</td>
<td style="text-align: left;">ChatMember.Read.Chat*, Chat.Manage.Chat*, ChatMember.Read.All, ChatMember.ReadWrite.All, Chat.ReadBasic.All, Chat.Read.All, Chat.ReadWrite.All</td>
</tr>
<tr>
<td style="text-align: left;"><a href="resources/conversationmember?view=graph-rest-1.0" data-linktype="relative-path">conversationMember</a> <br>/appCatalogs/teamsApps/{id}/installedToChats/getAllMembers <br>Chat members for all chats in an organization where a particular Teams app is installed.</td>
<td style="text-align: left;">Not supported.</td>
<td style="text-align: left;">Not supported.</td>
<td style="text-align: left;">ChatMember.Read.WhereInstalled, ChatMember.ReadWrite.WhereInstalled, Chat.ReadBasic.WhereInstalled, Chat.Read.WhereInstalled, Chat.ReadWrite.WhereInstalled</td>
</tr>
<tr>
<td style="text-align: left;"><a href="resources/conversationmember?view=graph-rest-1.0" data-linktype="relative-path">conversationMember</a> (/teams/{id}/members)</td>
<td style="text-align: left;">TeamMember.Read.All</td>
<td style="text-align: left;">Not supported</td>
<td style="text-align: left;">TeamMember.Read.All</td>
</tr>
<tr>
<td style="text-align: left;"><a href="resources/conversationmember?view=graph-rest-1.0" data-linktype="relative-path">conversationMember</a> (/teams/{id}/channels/getAllMembers)</td>
<td style="text-align: left;">Not supported</td>
<td style="text-align: left;">Not supported</td>
<td style="text-align: left;">ChannelMember.Read.All</td>
</tr>
<tr>
<td style="text-align: left;"><a href="resources/driveitem?view=graph-rest-1.0" data-linktype="relative-path">driveItem</a> (user's personal OneDrive)</td>
<td style="text-align: left;">Not supported</td>
<td style="text-align: left;">Files.Read</td>
<td style="text-align: left;">Not supported</td>
</tr>
<tr>
<td style="text-align: left;"><a href="resources/driveitem?view=graph-rest-1.0" data-linktype="relative-path">driveItem</a> (OneDrive for Business)</td>
<td style="text-align: left;">Files.Read.All</td>
<td style="text-align: left;">Not supported</td>
<td style="text-align: left;">Files.Read.All</td>
</tr>
<tr>
<td style="text-align: left;"><a href="resources/event?view=graph-rest-1.0" data-linktype="relative-path">event</a></td>
<td style="text-align: left;">Calendars.Read</td>
<td style="text-align: left;">Calendars.Read</td>
<td style="text-align: left;">Calendars.Read</td>
</tr>
<tr>
<td style="text-align: left;"><a href="resources/group?view=graph-rest-1.0" data-linktype="relative-path">group</a></td>
<td style="text-align: left;">Group.Read.All</td>
<td style="text-align: left;">Not supported</td>
<td style="text-align: left;">Group.Read.All</td>
</tr>
<tr>
<td style="text-align: left;"><a href="resources/conversation?view=graph-rest-1.0" data-linktype="relative-path">group conversation</a></td>
<td style="text-align: left;">Group.Read.All</td>
<td style="text-align: left;">Not supported</td>
<td style="text-align: left;">Not supported</td>
</tr>
<tr>
<td style="text-align: left;"><a href="resources/list?view=graph-rest-1.0" data-linktype="relative-path">list</a></td>
<td style="text-align: left;">Sites.Read.All</td>
<td style="text-align: left;">Not supported</td>
<td style="text-align: left;">Sites.Read.All</td>
</tr>
<tr>
<td style="text-align: left;"><a href="resources/message?view=graph-rest-1.0" data-linktype="relative-path">message</a></td>
<td style="text-align: left;">Mail.ReadBasic, Mail.Read</td>
<td style="text-align: left;">Mail.ReadBasic, Mail.Read</td>
<td style="text-align: left;">Mail.Read</td>
</tr>
<tr>
<td style="text-align: left;"><a href="resources/offershiftrequest?view=graph-rest-1.0" data-linktype="relative-path">offerShiftRequest</a><br>(/teams/{id}/schedule/offerShiftRequests)<br>Changes to any offer shift request in a team.</td>
<td style="text-align: left;">Schedule.Read.All, Schedule.ReadWrite.All</td>
<td style="text-align: left;">Not supported.</td>
<td style="text-align: left;">Schedule.Read.All, Schedule.ReadWrite.All</td>
</tr>
<tr>
<td style="text-align: left;"><a href="resources/openshiftchangerequest?view=graph-rest-1.0" data-linktype="relative-path">openShiftChangeRequest</a><br>(/teams/{id}/schedule/openShiftChangeRequests)<br>Changes to any open shift request in a team.</td>
<td style="text-align: left;">Schedule.Read.All, Schedule.ReadWrite.All</td>
<td style="text-align: left;">Not supported.</td>
<td style="text-align: left;">Schedule.Read.All, Schedule.ReadWrite.All</td>
</tr>
<tr>
<td style="text-align: left;"><a href="resources/presence?view=graph-rest-1.0" data-linktype="relative-path">presence</a></td>
<td style="text-align: left;">Presence.Read.All</td>
<td style="text-align: left;">Not supported</td>
<td style="text-align: left;">Not supported</td>
</tr>
<tr>
<td style="text-align: left;"><a href="resources/printer?view=graph-rest-1.0" data-linktype="relative-path">printer</a></td>
<td style="text-align: left;">Not supported</td>
<td style="text-align: left;">Not supported</td>
<td style="text-align: left;">Printer.Read.All, Printer.ReadWrite.All</td>
</tr>
<tr>
<td style="text-align: left;"><a href="resources/printtaskdefinition?view=graph-rest-1.0" data-linktype="relative-path">printTaskDefinition</a></td>
<td style="text-align: left;">Not supported</td>
<td style="text-align: left;">Not supported</td>
<td style="text-align: left;">PrintTaskDefinition.ReadWrite.All</td>
</tr>
<tr>
<td style="text-align: left;"><a href="resources/alert?view=graph-rest-1.0" data-linktype="relative-path">security alert</a></td>
<td style="text-align: left;">SecurityEvents.ReadWrite.All</td>
<td style="text-align: left;">Not supported</td>
<td style="text-align: left;">SecurityEvents.ReadWrite.All</td>
</tr>
<tr>
<td style="text-align: left;"><a href="resources/shift?view=graph-rest-1.0" data-linktype="relative-path">shift</a><br>(/teams/{id}/schedule/shifts)<br>Changes to any shift in a team.</td>
<td style="text-align: left;">Schedule.Read.All, Schedule.ReadWrite.All</td>
<td style="text-align: left;">Not supported.</td>
<td style="text-align: left;">Schedule.Read.All, Schedule.ReadWrite.All</td>
</tr>
<tr>
<td style="text-align: left;"><a href="resources/swapshiftschangerequest?view=graph-rest-1.0" data-linktype="relative-path">swapShiftsChangeRequest</a><br>(/teams/{id}/schedule/swapShiftsChangeRequests) <br>Changes to any swap shift request in a team.</td>
<td style="text-align: left;">Schedule.Read.All, Schedule.ReadWrite.All</td>
<td style="text-align: left;">Not supported.</td>
<td style="text-align: left;">Schedule.Read.All, Schedule.ReadWrite.All</td>
</tr>
<tr>
<td style="text-align: left;"><a href="resources/team?view=graph-rest-1.0" data-linktype="relative-path">team</a> (/teams – all teams in an organization)</td>
<td style="text-align: left;">Not supported</td>
<td style="text-align: left;">Not supported</td>
<td style="text-align: left;">Team.ReadBasic.All, TeamSettings.Read.All</td>
</tr>
<tr>
<td style="text-align: left;"><a href="resources/team?view=graph-rest-1.0" data-linktype="relative-path">team</a> (/teams/{id})</td>
<td style="text-align: left;">Team.ReadBasic.All, TeamSettings.Read.All</td>
<td style="text-align: left;">Not supported</td>
<td style="text-align: left;">Team.ReadBasic.All, TeamSettings.Read.All</td>
</tr>
<tr>
<td style="text-align: left;"><a href="resources/timeoffrequest?view=graph-rest-1.0" data-linktype="relative-path">timeOffRequest</a><br>(/teams/{id}/schedule/timeOffRequests)<br>Changes to any time off request in a team.</td>
<td style="text-align: left;">Schedule.Read.All, Schedule.ReadWrite.All</td>
<td style="text-align: left;">Not supported.</td>
<td style="text-align: left;">Schedule.Read.All, Schedule.ReadWrite.All</td>
</tr>
<tr>
<td style="text-align: left;"><a href="resources/todotask?view=graph-rest-1.0" data-linktype="relative-path">todoTask</a></td>
<td style="text-align: left;">Tasks.ReadWrite</td>
<td style="text-align: left;">Tasks.ReadWrite</td>
<td style="text-align: left;">Tasks.ReadWrite.All</td>
</tr>
<tr>
<td style="text-align: left;"><a href="resources/user?view=graph-rest-1.0" data-linktype="relative-path">user</a></td>
<td style="text-align: left;">User.Read.All</td>
<td style="text-align: left;">User.Read.All</td>
<td style="text-align: left;">User.Read.All</td>
</tr>
<tr>
<td style="text-align: left;"><a href="resources/virtualeventwebinar?view=graph-rest-1.0" data-linktype="relative-path">virtualEventWebinar</a></td>
<td style="text-align: left;">VirtualEvent.Read</td>
<td style="text-align: left;">Not supported.</td>
<td style="text-align: left;">VirtualEvent.Read.All</td>
</tr>
<tr>
<td style="text-align: left;"><a href="resources/virtualeventtownhall?view=graph-rest-1.0" data-linktype="relative-path">virtualEventTownhall</a></td>
<td style="text-align: left;">VirtualEvent.Read</td>
<td style="text-align: left;">Not supported.</td>
<td style="text-align: left;">VirtualEvent.Read.All</td>
</tr>
</tbody>
</table>
<p>We recommend that you use the permissions as documented in the previous table. Due to security restrictions, Microsoft Graph subscriptions don't support write access permissions when only read access permissions are needed.</p>
<blockquote>
<p><strong>Note</strong>: Permissions marked with * use <a href="/en-us/microsoftteams/platform/graph-api/rsc/resource-specific-consent" data-linktype="absolute-path">resource-specific consent</a>.</p>
</blockquote>
<!-- markdownlint-disable MD041-->
<h3 id="chatmessage">chatMessage</h3>
<p><strong>chatMessage</strong> subscriptions can be specified to include resource data (<strong>includeResourceData</strong> set to <code>true</code>). In that case, encryption is required and the subscription creation fails if an <strong>encryptionCertificate</strong> isn't specified for such subscriptions.</p>
<p>Use the <code>Prefer: include-unknown-enum-members</code> request header to get the following values in <strong>chatMessage</strong> <strong>messageType</strong> <a href="/en-us/graph/best-practices-concept#handling-future-members-in-evolvable-enumerations" data-linktype="absolute-path">evolvable enum</a>: <code>systemEventMessage</code> for <code>/teams/{id}/channels/{id}/messages</code> and <code>/chats/{id}/messages</code> resource.</p>
<h3 id="conversationmember">conversationMember</h3>
<p><strong>conversationMember</strong> subscriptions can be specified to include resource data (<strong>includeResourceData</strong> set to <code>true</code>). In that case, encryption is required and the subscription creation fails if an <strong>encryptionCertificate</strong> isn't specified for such subscriptions.</p>
<h3 id="team-channel-and-chat">team, channel, and chat</h3>
<p><strong>team</strong>, <strong>channel</strong>, and <strong>chat</strong> subscriptions can be specified to include resource data (<strong>includeResourceData</strong> set to <code>true</code>). In that case, encryption is required and the subscription creation fails if an <strong>encryptionCertificate</strong> isn't specified for such subscriptions.</p>
<p>You can use the <strong>notifyOnUserSpecificProperties</strong> query string parameter when you subscribe to changes in a particular chat or at user level. When you set the query string parameter <strong>notifyOnUserSpecificProperties</strong> to <code>true</code> during subscription creation, two types of payloads are sent to the subscriber. One type contains user-specific properties, and the other is sent without them. For more information, see <a href="/en-us/graph/teams-changenotifications-chat" data-linktype="absolute-path">Get change notifications for chats using Microsoft Graph</a>.</p>
<!-- ### aiInteraction -->
<!-- markdownlint-disable MD041-->
<h3 id="aiinteraction">aiInteraction</h3>
<p>Subscriptions on Copilot AI interactions require a valid Copilot license that includes the following Copilot service plan:</p>
<ul>
<li><strong>Microsoft 365 Copilot Chat</strong>: 3f30311c-6b1e-48a4-ab79-725b469da960</li>
</ul>
<p>For subscriptions that target Copilot AI interactions that a particular user is part of, the user in the resource path must have the previous service plans assigned to them in a valid state.</p>
<p>For subscriptions that target Copilot AI interactions for the entire tenant, the tenant must have valid licenses provisioned that include all previous Copilot service plans.</p>
<h3 id="driveitem">driveItem</h3>
<p>Additional limitations apply for subscriptions on OneDrive items. The limitations apply to creating as well as managing (getting, updating, and deleting) subscriptions.</p>
<p>On a personal OneDrive, you can subscribe to the root folder or any subfolder in that drive. On OneDrive for Business, you can subscribe to only the root folder. Change notifications are sent for the requested types of changes on the subscribed folder, or any file, folder, or other <strong>driveItem</strong> instances in its hierarchy. You can't subscribe to <strong>drive</strong> or <strong>driveItem</strong> instances that aren't folders, such as individual files.</p>
<p>OneDrive for Business and SharePoint support sending your application notifications of security events that occur on a <strong>driveItem</strong>. To subscribe to these events, add the <code>prefer:includesecuritywebhooks</code> header to your request to create a subscription. After the subscription is created, you will receive notifications when the permissions on an item change. This header is applicable to SharePoint and OneDrive for Business but not consumer OneDrive accounts.</p>
<h3 id="contact-event-and-message">contact, event, and message</h3>
<p>You can subscribe to changes in Outlook <strong>contact</strong>, <strong>event</strong>, or <strong>message</strong> resources.</p>
<!-- markdownlint-disable MD041-->
<p>Creating and managing (getting, updating, and deleting) a subscription requires a read scope to the resource. For example, to get change notifications on messages, your app needs the Mail.Read permission. Outlook change notifications support delegated and application permission scopes. Note the following limitations:</p>
<ul>
<li><p>Delegated permission supports subscribing to items in folders in only the signed-in user's mailbox. For example, you can't use the delegated permission Calendars.Read to subscribe to events in another user’s mailbox.</p>
</li>
<li><p>To subscribe to change notifications of Outlook contacts, events, or messages in <em>shared or delegated</em> folders:</p>
<ul>
<li>Use the corresponding application permission to subscribe to changes of items in a folder or mailbox of <em>any</em> user in the tenant.</li>
<li>Don't use the Outlook sharing permissions (Contacts.Read.Shared, Calendars.Read.Shared, Mail.Read.Shared, and their read/write counterparts), as they do <strong>not</strong> support subscribing to change notifications on items in shared or delegated folders.</li>
</ul>
</li>
</ul>
<h3 id="presence">presence</h3>
<p>Subscriptions on <strong>presence</strong> require any resource data included in a change notification to be encrypted. Always specify the <strong>encryptionCertificate</strong> parameter when <a href="/en-us/graph/change-notifications-with-resource-data#creating-a-subscription" data-linktype="absolute-path">creating a subscription</a> to avoid failure. See more information about <a href="/en-us/graph/change-notifications-with-resource-data" data-linktype="absolute-path">setting up change notifications to include resource data</a>.</p>
<h3 id="virtualeventwebinar-and-virtualeventtownhall">virtualEventWebinar and virtualEventTownhall</h3>
<p>Subscriptions on virtual events support only basic notifications and are limited to a few entities of a virtual event. For more information about the supported subscription types, see <a href="/en-us/graph/changenotifications-for-virtualevent" data-linktype="absolute-path">Get change notifications for Microsoft Teams virtual event updates</a>.</p>
<h2 id="http-request">HTTP request</h2>
<!-- { "blockType": "ignored" } -->
<pre><code class="lang-http">POST /subscriptions
</code></pre>
<h2 id="request-headers">Request headers</h2>
<table>
<thead>
<tr>
<th style="text-align: left;">Name</th>
<th style="text-align: left;">Type</th>
<th style="text-align: left;">Description</th>
</tr>
</thead>
<tbody>
<tr>
<td style="text-align: left;">Authorization</td>
<td style="text-align: left;">string</td>
<td style="text-align: left;">Bearer {token}. Required. Learn more about <a href="/en-us/graph/auth/auth-concepts" data-linktype="absolute-path">authentication and authorization</a>.</td>
</tr>
</tbody>
</table>
<h2 id="request-body">Request body</h2>
<p>In the request body, supply a JSON representation of <a href="resources/subscription?view=graph-rest-1.0" data-linktype="relative-path">subscription</a> object.</p>
<h2 id="response">Response</h2>
<p>If successful, this method returns <code>201 Created</code> response code and a <a href="resources/subscription?view=graph-rest-1.0" data-linktype="relative-path">subscription</a> object in the response body.
For details about how errors are returned, see <a href="/en-us/graph/errors" data-linktype="absolute-path">Error responses</a>.</p>
<h2 id="example">Example</h2>
<h3 id="request">Request</h3>
<p>The following example shows a request to send a change notification when the user receives a new mail.</p>
<div class="tabGroup" id="tabgroup_1">
<ul role="tablist">
<li role="presentation">
<a href="#tabpanel_1_http" role="tab" aria-controls="tabpanel_1_http" data-tab="http" tabindex="0" aria-selected="true" data-linktype="self-bookmark">HTTP</a>
</li>
<li role="presentation">
<a href="#tabpanel_1_csharp" role="tab" aria-controls="tabpanel_1_csharp" data-tab="csharp" tabindex="-1" data-linktype="self-bookmark">C#</a>
</li>
<li role="presentation">
<a href="#tabpanel_1_go" role="tab" aria-controls="tabpanel_1_go" data-tab="go" tabindex="-1" data-linktype="self-bookmark">Go</a>
</li>
<li role="presentation">
<a href="#tabpanel_1_java" role="tab" aria-controls="tabpanel_1_java" data-tab="java" tabindex="-1" data-linktype="self-bookmark">Java</a>
</li>
<li role="presentation">
<a href="#tabpanel_1_javascript" role="tab" aria-controls="tabpanel_1_javascript" data-tab="javascript" tabindex="-1" data-linktype="self-bookmark">JavaScript</a>
</li>
<li role="presentation">
<a href="#tabpanel_1_php" role="tab" aria-controls="tabpanel_1_php" data-tab="php" tabindex="-1" data-linktype="self-bookmark">PHP</a>
</li>
<li role="presentation">
<a href="#tabpanel_1_powershell" role="tab" aria-controls="tabpanel_1_powershell" data-tab="powershell" tabindex="-1" data-linktype="self-bookmark">PowerShell</a>
</li>
<li role="presentation">
<a href="#tabpanel_1_python" role="tab" aria-controls="tabpanel_1_python" data-tab="python" tabindex="-1" data-linktype="self-bookmark">Python</a>
</li>
</ul>
<section id="tabpanel_1_http" role="tabpanel" data-tab="http">
<!-- {
  "blockType": "request",
  "name": "create_subscription_from_subscriptions"
}-->
<pre><code class="lang-http">POST https://graph.microsoft.com/v1.0/subscriptions
Content-type: application/json

{
   "changeType": "created",
   "notificationUrl": "https://webhook.azurewebsites.net/api/send/myNotifyClient",
   "resource": "me/mailFolders('Inbox')/messages",
   "expirationDateTime":"2016-11-20T18:23:45.9356913Z",
   "clientState": "secretClientValue",
   "latestSupportedTlsVersion": "v1_2"
}
</code></pre>
</section>
<section id="tabpanel_1_csharp" role="tabpanel" data-tab="csharp" aria-hidden="true" hidden="hidden">

<pre><code class="lang-csharp">
// Code snippets are only available for the latest version. Current version is 5.x

// Dependencies
using Microsoft.Graph.Models;

var requestBody = new Subscription
{
	ChangeType = "created",
	NotificationUrl = "https://webhook.azurewebsites.net/api/send/myNotifyClient",
	Resource = "me/mailFolders('Inbox')/messages",
	ExpirationDateTime = DateTimeOffset.Parse("2016-11-20T18:23:45.9356913Z"),
	ClientState = "secretClientValue",
	LatestSupportedTlsVersion = "v1_2",
};

// To initialize your graphClient, see https://learn.microsoft.com/en-us/graph/sdks/create-client?from=snippets&amp;tabs=csharp
var result = await graphClient.Subscriptions.PostAsync(requestBody);


</code></pre>
<!-- markdownlint-disable MD041-->
<blockquote>
<p>For details about how to <a href="/en-us/graph/sdks/sdk-installation" data-linktype="absolute-path">add the SDK</a> to your project and <a href="/en-us/graph/sdks/choose-authentication-providers" data-linktype="absolute-path">create an authProvider</a> instance, see the <a href="/en-us/graph/sdks/sdks-overview" data-linktype="absolute-path">SDK documentation</a>.</p>
</blockquote>
</section>
<section id="tabpanel_1_go" role="tabpanel" data-tab="go" aria-hidden="true" hidden="hidden">

<pre><code class="lang-go">

// Code snippets are only available for the latest major version. Current major version is $v1.*

// Dependencies
import (
	  "context"
	  "time"
	  msgraphsdk "github.com/microsoftgraph/msgraph-sdk-go"
	  graphmodels "github.com/microsoftgraph/msgraph-sdk-go/models"
	  //other-imports
)

requestBody := graphmodels.NewSubscription()
changeType := "created"
requestBody.SetChangeType(&amp;changeType) 
notificationUrl := "https://webhook.azurewebsites.net/api/send/myNotifyClient"
requestBody.SetNotificationUrl(&amp;notificationUrl) 
resource := "me/mailFolders('Inbox')/messages"
requestBody.SetResource(&amp;resource) 
expirationDateTime , err := time.Parse(time.RFC3339, "2016-11-20T18:23:45.9356913Z")
requestBody.SetExpirationDateTime(&amp;expirationDateTime) 
clientState := "secretClientValue"
requestBody.SetClientState(&amp;clientState) 
latestSupportedTlsVersion := "v1_2"
requestBody.SetLatestSupportedTlsVersion(&amp;latestSupportedTlsVersion) 

// To initialize your graphClient, see https://learn.microsoft.com/en-us/graph/sdks/create-client?from=snippets&amp;tabs=go
subscriptions, err := graphClient.Subscriptions().Post(context.Background(), requestBody, nil)


</code></pre>
<!-- markdownlint-disable MD041-->
<blockquote>
<p>For details about how to <a href="/en-us/graph/sdks/sdk-installation" data-linktype="absolute-path">add the SDK</a> to your project and <a href="/en-us/graph/sdks/choose-authentication-providers" data-linktype="absolute-path">create an authProvider</a> instance, see the <a href="/en-us/graph/sdks/sdks-overview" data-linktype="absolute-path">SDK documentation</a>.</p>
</blockquote>
</section>
<section id="tabpanel_1_java" role="tabpanel" data-tab="java" aria-hidden="true" hidden="hidden">

<pre><code class="lang-java">
// Code snippets are only available for the latest version. Current version is 6.x

GraphServiceClient graphClient = new GraphServiceClient(requestAdapter);

Subscription subscription = new Subscription();
subscription.setChangeType("created");
subscription.setNotificationUrl("https://webhook.azurewebsites.net/api/send/myNotifyClient");
subscription.setResource("me/mailFolders('Inbox')/messages");
OffsetDateTime expirationDateTime = OffsetDateTime.parse("2016-11-20T18:23:45.9356913Z");
subscription.setExpirationDateTime(expirationDateTime);
subscription.setClientState("secretClientValue");
subscription.setLatestSupportedTlsVersion("v1_2");
Subscription result = graphClient.subscriptions().post(subscription);


</code></pre>
<!-- markdownlint-disable MD041-->
<blockquote>
<p>For details about how to <a href="/en-us/graph/sdks/sdk-installation" data-linktype="absolute-path">add the SDK</a> to your project and <a href="/en-us/graph/sdks/choose-authentication-providers" data-linktype="absolute-path">create an authProvider</a> instance, see the <a href="/en-us/graph/sdks/sdks-overview" data-linktype="absolute-path">SDK documentation</a>.</p>
</blockquote>
</section>
<section id="tabpanel_1_javascript" role="tabpanel" data-tab="javascript" aria-hidden="true" hidden="hidden">

<pre><code class="lang-javascript">
const options = {
	authProvider,
};

const client = Client.init(options);

const subscription = {
   changeType: 'created',
   notificationUrl: 'https://webhook.azurewebsites.net/api/send/myNotifyClient',
   resource: 'me/mailFolders(\'Inbox\')/messages',
   expirationDateTime: '2016-11-20T18:23:45.9356913Z',
   clientState: 'secretClientValue',
   latestSupportedTlsVersion: 'v1_2'
};

await client.api('/subscriptions')
	.post(subscription);

</code></pre>
<!-- markdownlint-disable MD041-->
<blockquote>
<p>For details about how to <a href="/en-us/graph/sdks/sdk-installation" data-linktype="absolute-path">add the SDK</a> to your project and <a href="/en-us/graph/sdks/choose-authentication-providers" data-linktype="absolute-path">create an authProvider</a> instance, see the <a href="/en-us/graph/sdks/sdks-overview" data-linktype="absolute-path">SDK documentation</a>.</p>
</blockquote>
</section>
<section id="tabpanel_1_php" role="tabpanel" data-tab="php" aria-hidden="true" hidden="hidden">

<pre><code class="lang-php">
&lt;?php
use Microsoft\Graph\GraphServiceClient;
use Microsoft\Graph\Generated\Models\Subscription;


$graphServiceClient = new GraphServiceClient($tokenRequestContext, $scopes);

$requestBody = new Subscription();
$requestBody-&gt;setChangeType('created');
$requestBody-&gt;setNotificationUrl('https://webhook.azurewebsites.net/api/send/myNotifyClient');
$requestBody-&gt;setResource('me/mailFolders(\'Inbox\')/messages');
$requestBody-&gt;setExpirationDateTime(new \DateTime('2016-11-20T18:23:45.9356913Z'));
$requestBody-&gt;setClientState('secretClientValue');
$requestBody-&gt;setLatestSupportedTlsVersion('v1_2');

$result = $graphServiceClient-&gt;subscriptions()-&gt;post($requestBody)-&gt;wait();

</code></pre>
<!-- markdownlint-disable MD041-->
<blockquote>
<p>For details about how to <a href="/en-us/graph/sdks/sdk-installation" data-linktype="absolute-path">add the SDK</a> to your project and <a href="/en-us/graph/sdks/choose-authentication-providers" data-linktype="absolute-path">create an authProvider</a> instance, see the <a href="/en-us/graph/sdks/sdks-overview" data-linktype="absolute-path">SDK documentation</a>.</p>
</blockquote>
</section>
<section id="tabpanel_1_powershell" role="tabpanel" data-tab="powershell" aria-hidden="true" hidden="hidden">

<pre><code class="lang-powershell">
Import-Module Microsoft.Graph.ChangeNotifications

$params = @{
	changeType = "created"
	notificationUrl = "https://webhook.azurewebsites.net/api/send/myNotifyClient"
	resource = "me/mailFolders('Inbox')/messages"
	expirationDateTime = [System.DateTime]::Parse("2016-11-20T18:23:45.9356913Z")
	clientState = "secretClientValue"
	latestSupportedTlsVersion = "v1_2"
}

New-MgSubscription -BodyParameter $params

</code></pre>
<!-- markdownlint-disable MD041-->
<blockquote>
<p>For details about how to <a href="/en-us/graph/sdks/sdk-installation" data-linktype="absolute-path">add the SDK</a> to your project and <a href="/en-us/graph/sdks/choose-authentication-providers" data-linktype="absolute-path">create an authProvider</a> instance, see the <a href="/en-us/graph/sdks/sdks-overview" data-linktype="absolute-path">SDK documentation</a>.</p>
</blockquote>
</section>
<section id="tabpanel_1_python" role="tabpanel" data-tab="python" aria-hidden="true" hidden="hidden">

<pre><code class="lang-python">
# Code snippets are only available for the latest version. Current version is 1.x
from msgraph import GraphServiceClient
from msgraph.generated.models.subscription import Subscription
# To initialize your graph_client, see https://learn.microsoft.com/en-us/graph/sdks/create-client?from=snippets&amp;tabs=python
request_body = Subscription(
	change_type = "created",
	notification_url = "https://webhook.azurewebsites.net/api/send/myNotifyClient",
	resource = "me/mailFolders('Inbox')/messages",
	expiration_date_time = "2016-11-20T18:23:45.9356913Z",
	client_state = "secretClientValue",
	latest_supported_tls_version = "v1_2",
)

result = await graph_client.subscriptions.post(request_body)


</code></pre>
<!-- markdownlint-disable MD041-->
<blockquote>
<p>For details about how to <a href="/en-us/graph/sdks/sdk-installation" data-linktype="absolute-path">add the SDK</a> to your project and <a href="/en-us/graph/sdks/choose-authentication-providers" data-linktype="absolute-path">create an authProvider</a> instance, see the <a href="/en-us/graph/sdks/sdks-overview" data-linktype="absolute-path">SDK documentation</a>.</p>
</blockquote>
</section>
</div>

<p>In the request body, supply a JSON representation of the <a href="resources/subscription?view=graph-rest-1.0" data-linktype="relative-path">subscription</a> object.
The <code>clientState</code> and <code>latestSupportedTlsVersion</code> fields are optional.</p>
<h4 id="duplicate-subscription-behavior">Duplicate subscription behavior</h4>
<p>Duplicate subscriptions aren't allowed. When a subscription request contains the same values for <strong>changeType</strong> and <strong>resource</strong> that an existing subscription contains, the request fails with an HTTP error code <code>409 Conflict</code>, and the error message <code>Subscription Id &lt;&gt; already exists for the requested combination</code>.</p>
<h4 id="resources-examples">Resources examples</h4>
<p>The following are valid values for the resource property of the subscription:</p>
<table>
<thead>
<tr>
<th style="text-align: left;">Resource type</th>
<th style="text-align: left;">Examples</th>
</tr>
</thead>
<tbody>
<tr>
<td style="text-align: left;"><a href="resources/callrecords-callrecord?view=graph-rest-1.0" data-linktype="relative-path">Call records</a></td>
<td style="text-align: left;"><code>communications/callRecords</code></td>
</tr>
<tr>
<td style="text-align: left;"><a href="resources/callrecording?view=graph-rest-1.0" data-linktype="relative-path">callRecording</a></td>
<td style="text-align: left;"><code>communications/onlineMeetings/getAllRecordings</code>, <code>communications/onlineMeetings/{onlineMeetingId}/recordings</code>, <code>users/{userId}/onlineMeetings/getAllRecordings</code></td>
</tr>
<tr>
<td style="text-align: left;"><a href="resources/calltranscript?view=graph-rest-1.0" data-linktype="relative-path">callTranscript</a></td>
<td style="text-align: left;"><code>communications/onlineMeetings/getAllTranscripts</code>, <code>communications/onlineMeetings/{onlineMeetingId}/transcripts</code>, <code>users/{userId}/onlineMeetings/getAllTranscripts</code></td>
</tr>
<tr>
<td style="text-align: left;"><a href="resources/chatmessage?view=graph-rest-1.0" data-linktype="relative-path">Chat message</a></td>
<td style="text-align: left;"><code>chats/{id}/messages</code>, <code>chats/getAllMessages</code>, <code>teams/{id}/channels/{id}/messages</code>, <code>teams/getAllMessages</code></td>
</tr>
<tr>
<td style="text-align: left;"><a href="resources/contact?view=graph-rest-1.0" data-linktype="relative-path">Contacts</a></td>
<td style="text-align: left;"><code>me/contacts</code></td>
</tr>
<tr>
<td style="text-align: left;"><a href="resources/conversation?view=graph-rest-1.0" data-linktype="relative-path">Conversations</a></td>
<td style="text-align: left;"><code>groups('{id}')/conversations</code></td>
</tr>
<tr>
<td style="text-align: left;"><a href="resources/driveitem?view=graph-rest-1.0" data-linktype="relative-path">Drives</a></td>
<td style="text-align: left;"><code>me/drive/root</code></td>
</tr>
<tr>
<td style="text-align: left;"><a href="resources/event?view=graph-rest-1.0" data-linktype="relative-path">Events</a></td>
<td style="text-align: left;"><code>me/events</code></td>
</tr>
<tr>
<td style="text-align: left;"><a href="resources/group?view=graph-rest-1.0" data-linktype="relative-path">Groups</a></td>
<td style="text-align: left;"><code>groups</code></td>
</tr>
<tr>
<td style="text-align: left;"><a href="resources/list?view=graph-rest-1.0" data-linktype="relative-path">List</a></td>
<td style="text-align: left;"><code>sites/{site-id}/lists/{list-id}</code></td>
</tr>
<tr>
<td style="text-align: left;"><a href="resources/message?view=graph-rest-1.0" data-linktype="relative-path">Mail</a></td>
<td style="text-align: left;"><code>me/mailfolders('inbox')/messages</code>, <code>me/messages</code></td>
</tr>
<tr>
<td style="text-align: left;"><a href="resources/presence?view=graph-rest-1.0" data-linktype="relative-path">Presence</a></td>
<td style="text-align: left;"><code>/communications/presences/{id}</code> (single user), <code>/communications/presences?$filter=id in ('{id}','{id}',…)</code> (multiple users)</td>
</tr>
<tr>
<td style="text-align: left;"><a href="resources/printer?view=graph-rest-1.0" data-linktype="relative-path">printer</a></td>
<td style="text-align: left;"><code>print/printers/{id}/jobs</code></td>
</tr>
<tr>
<td style="text-align: left;"><a href="resources/printtaskdefinition?view=graph-rest-1.0" data-linktype="relative-path">PrintTaskDefinition</a></td>
<td style="text-align: left;"><code>print/taskDefinitions/{id}/tasks</code></td>
</tr>
<tr>
<td style="text-align: left;"><a href="resources/alert?view=graph-rest-1.0" data-linktype="relative-path">Security alert</a></td>
<td style="text-align: left;"><code>security/alerts?$filter=status eq 'New'</code></td>
</tr>
<tr>
<td style="text-align: left;"><a href="resources/todotask?view=graph-rest-1.0" data-linktype="relative-path">todoTask</a></td>
<td style="text-align: left;"><code>/me/todo/lists/{todoTaskListId}/tasks</code></td>
</tr>
<tr>
<td style="text-align: left;"><a href="resources/user?view=graph-rest-1.0" data-linktype="relative-path">Users</a></td>
<td style="text-align: left;"><code>users</code></td>
</tr>
</tbody>
</table>
<blockquote>
<p><strong>Note:</strong> Any path starting with <code>me</code> can also be used with <code>users/{id}</code> instead of <code>me</code> to target a specific user instead of the current user.</p>
</blockquote>
<h3 id="response-1">Response</h3>
<p>The following example shows the response.</p>
<blockquote>
<p><strong>Note:</strong> The response object shown here might be shortened for readability.</p>
</blockquote>
<!-- {
  "blockType": "response",
  "truncated": true,
  "@odata.type": "microsoft.graph.subscription"
} -->
<pre><code class="lang-http">HTTP/1.1 201 Created
Content-type: application/json

{
  "@odata.context": "https://graph.microsoft.com/v1.0/$metadata#subscriptions/$entity",
  "id": "7f105c7d-2dc5-4530-97cd-4e7ae6534c07",
  "resource": "me/mailFolders('Inbox')/messages",
  "applicationId": "24d3b144-21ae-4080-943f-7067b395b913",
  "changeType": "created",
  "clientState": "secretClientValue",
  "notificationUrl": "https://webhook.azurewebsites.net/api/send/myNotifyClient",
  "expirationDateTime": "2016-11-20T18:23:45.9356913Z",
  "creatorId": "8ee44408-0679-472c-bc2a-692812af3437",
  "latestSupportedTlsVersion": "v1_2",
  "notificationContentType": "application/json"
}
</code></pre>
<h4 id="notification-endpoint-validation">Notification endpoint validation</h4>
<p>The subscription notification endpoint (specified in the <code>notificationUrl</code> property) must be capable of responding to a validation request as described in <a href="/en-us/graph/change-notifications-overview#notification-endpoint-validation" data-linktype="absolute-path">Set up notifications for changes in user data</a>. If validation fails, the request to create the subscription returns a 400 Bad Request error.</p>
<!-- uuid: 8fcb5dbc-d5aa-4681-8e31-b001d5168d79
2015-10-25 14:57:30 UTC -->
<!-- {
  "type": "#page.annotation",
  "description": "Create subscription",
  "keywords": "",
  "section": "documentation",
  "tocPath": "",
  "suppressions": [
  ]
}-->
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
		datetime="2026-03-23T13:01:00.000Z"
		data-article-date-source="calculated"
		class="is-invisible"
	>
		2026-03-23
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