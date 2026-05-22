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
			<title>Attach large files to Outlook messages or events - Microsoft Graph | Microsoft Learn</title>
			<meta charset="utf-8" />
			<meta name="viewport" content="width=device-width, initial-scale=1.0" />
			<meta name="color-scheme" content="light dark" />

			<meta name="description" content="Create and use an upload session to add large file attachments over 3 MB to Outlook items. Each step shows the corresponding code for a message and an event." />
			<link rel="canonical" href="https://learn.microsoft.com/en-us/graph/outlook-large-attachments" /> 

			<!-- Non-customizable open graph and sharing-related metadata -->
			<meta name="twitter:card" content="summary_large_image" />
			<meta name="twitter:site" content="@MicrosoftLearn" />
			<meta property="og:type" content="website" />
			<meta property="og:image:alt" content="Microsoft Learn" />
			<meta property="og:image" content="https://learn.microsoft.com/en-us/media/open-graph-image.png" />
			<!-- Page specific open graph and sharing-related metadata -->
			<meta property="og:title" content="Attach large files to Outlook messages or events - Microsoft Graph" />
			<meta property="og:url" content="https://learn.microsoft.com/en-us/graph/outlook-large-attachments" />
			<meta property="og:description" content="Create and use an upload session to add large file attachments over 3 MB to Outlook items. Each step shows the corresponding code for a message and an event." />
			<meta name="platform_id" content="29e34596-3832-2ed7-0623-c048f652f0f5" /> <meta name="scope" content="graph" />
			<meta name="locale" content="en-us" />
			 
			<meta name="uhfHeaderId" content="MSDocsHeader-MSGraph" />

			<meta name="page_type" content="conceptual" />

			<!--page specific meta tags-->
			

			<!-- custom meta tags -->
			
		<meta name="feedback_system" content="Standard" />
	
		<meta name="feedback_product_url" content="https://developer.microsoft.com/graph/support" />
	
		<meta name="breadcrumb_path" content="/graph/concepts/breadcrumb/toc.json" />
	
		<meta name="author" content="SuryaLashmiS" />
	
		<meta name="ms.author" content="MSGraphDocsVteam" />
	
		<meta name="ms.suite" content="microsoft-graph" />
	
		<meta name="ms.subservice" content="outlook" />
	
		<meta name="toc_preview" content="true" />
	
		<meta name="recommendations" content="false" />
	
		<meta name="ms.service" content="microsoft-graph" />
	
		<meta name="ms.topic" content="how-to" />
	
		<meta name="ms.localizationpriority" content="high" />
	
		<meta name="ms.date" content="2024-11-07T00:00:00Z" />
	
		<meta name="document_id" content="60e6b4ed-4a94-6789-95e3-407780e8fd7e" />
	
		<meta name="document_version_independent_id" content="ff8aca6f-1a1f-1bef-c1dd-bfdbbaf9f901" />
	
		<meta name="updated_at" content="2025-08-06T00:47:00Z" />
	
		<meta name="original_content_git_url" content="https://github.com/microsoftgraph/microsoft-graph-docs/blob/live/concepts/outlook-large-attachments.md" />
	
		<meta name="gitcommit" content="https://github.com/microsoftgraph/microsoft-graph-docs/blob/70f4b4eecebce12fcb20dae6b2a542c5ea57b6e2/concepts/outlook-large-attachments.md" />
	
		<meta name="git_commit_id" content="70f4b4eecebce12fcb20dae6b2a542c5ea57b6e2" />
	
		<meta name="site_name" content="Docs" />
	
		<meta name="depot_name" content="MSDN.microsoft-graph-docs" />
	
		<meta name="schema" content="Conceptual" />
	
		<meta name="toc_rel" content="toc.json" />
	
		<meta name="feedback_help_link_type" content="" />
	
		<meta name="feedback_help_link_url" content="" />
	
		<meta name="word_count" content="2568" />
	
		<meta name="asset_id" content="outlook-large-attachments" />
	
		<meta name="moniker_range_name" content="" />
	
		<meta name="item_type" content="Content" />
	
		<meta name="source_path" content="concepts/outlook-large-attachments.md" />
	
		<meta name="previous_tlsh_hash" content="A5E5EB32750D9914EFD21E1624163A15B1F084DD9E603D895ABE6BB1D59D1E736316BDD7EA3BAF80433781060162B72CFAD1E33E905C33922657A85CC11A7682F7C93FB2CE" />
	
		<meta name="github_feedback_content_git_url" content="https://github.com/microsoftgraph/microsoft-graph-docs-contrib/blob/main/concepts/outlook-large-attachments.md" />
	
		<meta name="markdown_url" content="https://learn.microsoft.com/en-us/graph/outlook-large-attachments?accept=text/markdown" />
	 
		<meta name="cmProducts" content="https://authoring-docs-microsoft.poolparty.biz/devrel/3e34b70d-bca0-4369-a01b-71d1edfd427b" data-source="generated" />
	
		<meta name="cmProducts" content="https://authoring-docs-microsoft.poolparty.biz/devrel/5fc61396-d075-4560-aece-fdbda73d243f" data-source="generated" />
	
		<meta name="spProducts" content="https://authoring-docs-microsoft.poolparty.biz/devrel/8ca32b3f-fa14-46df-b09a-9c4a591d6396" data-source="generated" />
	
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
        "name": "SuryaLashmiS",
        "url": "https://github.com/SuryaLashmiS"
      },
      {
        "name": "Saisang",
        "url": "https://github.com/Saisang"
      },
      {
        "name": "Copilot",
        "url": "https://github.com/Copilot"
      },
      {
        "name": "FaithOmbongi",
        "url": "https://github.com/FaithOmbongi"
      },
      {
        "name": "mnorman-ms",
        "url": "https://github.com/mnorman-ms"
      },
      {
        "name": "RetYn",
        "url": "https://github.com/RetYn"
      },
      {
        "name": "jasonjoh",
        "url": "https://github.com/jasonjoh"
      },
      {
        "name": "lramosvea",
        "url": "https://github.com/lramosvea"
      },
      {
        "name": "Lauragra",
        "url": "https://github.com/Lauragra"
      },
      {
        "name": "JarbasHorst",
        "url": "https://github.com/JarbasHorst"
      },
      {
        "name": "isvargasmsft",
        "url": "https://github.com/isvargasmsft"
      },
      {
        "name": "MelanieHom",
        "url": "https://github.com/MelanieHom"
      },
      {
        "name": "angelgolfer-ms",
        "url": "https://github.com/angelgolfer-ms"
      },
      {
        "name": "svpsiva",
        "url": "https://github.com/svpsiva"
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
			
			href="https://github.com/microsoftgraph/microsoft-graph-docs-contrib/blob/main/concepts/outlook-large-attachments.md"
			data-original_content_git_url="https://github.com/microsoftgraph/microsoft-graph-docs/blob/live/concepts/outlook-large-attachments.md"
			data-original_content_git_url_template="{repo}/blob/{branch}/concepts/outlook-large-attachments.md"
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
	
					<div class="content"><h1 id="attach-large-files-to-outlook-messages-or-events">Attach large files to Outlook messages or events</h1></div>
					
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
	
					<div class="content"><p>Using the Microsoft Graph API, you can attach files up to 150 MB to an Outlook <a href="/en-us/graph/api/resources/message" data-linktype="absolute-path">message</a> or <a href="/en-us/graph/api/resources/event" data-linktype="absolute-path">event</a> item. Depending on the file size, choose one of two ways to attach the file:</p>
<ul>
<li>If the file size is under 3 MB, do a single POST on the <strong>attachments</strong> navigation property of the Outlook item; see how to do this <a href="/en-us/graph/api/message-post-attachments" data-linktype="absolute-path">for a message</a> or <a href="/en-us/graph/api/event-post-attachments" data-linktype="absolute-path">for an event</a>. The successful <code>POST</code> response includes the ID of the file attachment.</li>
<li>If the file size is between 3 MB and 150 MB, create an upload session, and iteratively use <code>PUT</code> to upload ranges of bytes of the file until you have uploaded the entire file. A header in the final successful <code>PUT</code> response includes a URL with the attachment ID.</li>
</ul>
<p>To attach multiple files to a message, choose the approach for each file based on its file size and attach the files individually.</p>
<p>This article illustrates the second approach step by step, creating and using an upload session to add a large file attachment (of size over 3 MB) to an Outlook item. Each step shows the corresponding code for a message and for an event. Upon successfully uploading the entire file, the article shows getting a response header that contains an ID for the file attachment, and then using that attachment ID to get the raw attachment content or attachment metadata.</p>
<div class="IMPORTANT">
<p>Important</p>
<p>Be aware of a <a href="https://developer.microsoft.com/en-us/graph/known-issues/?search=13644" data-linktype="external">known issue</a> if you're attaching large files to a message or event in a shared or delegated mailbox.</p>
</div>
<h2 id="step-1-create-an-upload-session">Step 1: Create an upload session</h2>
<p><a href="/en-us/graph/api/attachment-createuploadsession" data-linktype="absolute-path">Create an upload session</a> to attach a file to a message or event. Specify the file in the input parameter <strong>AttachmentItem</strong>.</p>
<p>A successful operation returns <code>HTTP 201 Created</code> and a new <a href="/en-us/graph/api/resources/uploadsession" data-linktype="absolute-path">uploadSession</a> instance, which contains an opaque URL that you can use in subsequent <code>PUT</code> operations to upload portions of the file. The <strong>uploadSession</strong> provides a temporary storage location where the bytes of the file are saved until you have uploaded the complete file.</p>
<p>The <strong>uploadSession</strong> object in the response also includes the <strong>nextExpectedRanges</strong> property, which indicates the initial upload starting location should be byte 0.</p>
<h3 id="permissions">Permissions</h3>
<p>Make sure to request <code>Mail.ReadWrite</code> permission to create the <strong>uploadSession</strong> for a message, and <code>Calendars.ReadWrite</code> for an event.</p>
<p>The opaque URL, returned in the <strong>uploadUrl</strong> property of the new <strong>uploadSession</strong>, is pre-authenticated and contains the appropriate authorization token for subsequent <code>PUT</code> queries in the <code>https://outlook.office.com</code> domain. That token expires by <strong>expirationDateTime</strong>. Do not customize this URL for the <code>PUT</code> operations.</p>
<h3 id="example-create-an-upload-session-for-a-message">Example: Create an upload session for a message</h3>
<h4 id="request">Request</h4>
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
  "name": "walkthrough_create_uploadsession_message",
  "sampleKeys": ["AAMkADI5MAAIT3drCAAA="]
}-->
<pre><code class="lang-http">POST https://graph.microsoft.com/v1.0/me/messages/AAMkADI5MAAIT3drCAAA=/attachments/createUploadSession
Content-type: application/json

{
  "AttachmentItem": {
    "attachmentType": "file",
    "name": "flower",
    "size": 3483322
  }
}
</code></pre>
</section>
<section id="tabpanel_1_csharp" role="tabpanel" data-tab="csharp" aria-hidden="true" hidden="hidden">

<pre><code class="lang-csharp">
// Code snippets are only available for the latest version. Current version is 5.x

// Dependencies
using Microsoft.Graph.Me.Messages.Item.Attachments.CreateUploadSession;
using Microsoft.Graph.Models;

var requestBody = new CreateUploadSessionPostRequestBody
{
	AttachmentItem = new AttachmentItem
	{
		AttachmentType = AttachmentType.File,
		Name = "flower",
		Size = 3483322L,
	},
};

// To initialize your graphClient, see https://learn.microsoft.com/en-us/graph/sdks/create-client?from=snippets&amp;tabs=csharp
var result = await graphClient.Me.Messages["{message-id}"].Attachments.CreateUploadSession.PostAsync(requestBody);


</code></pre>
<!-- markdownlint-disable MD041-->
<blockquote>
<p>Read the <a href="/en-us/graph/sdks/sdks-overview" data-linktype="absolute-path">SDK documentation</a> for details on how to <a href="/en-us/graph/sdks/sdk-installation" data-linktype="absolute-path">add the SDK</a> to your project and <a href="/en-us/graph/sdks/choose-authentication-providers" data-linktype="absolute-path">create an authProvider</a> instance.</p>
</blockquote>
</section>
<section id="tabpanel_1_go" role="tabpanel" data-tab="go" aria-hidden="true" hidden="hidden">

<pre><code class="lang-go">

// Code snippets are only available for the latest major version. Current major version is $v1.*

// Dependencies
import (
	  "context"
	  msgraphsdk "github.com/microsoftgraph/msgraph-sdk-go"
	  graphusers "github.com/microsoftgraph/msgraph-sdk-go/users"
	  graphmodels "github.com/microsoftgraph/msgraph-sdk-go/models"
	  //other-imports
)

requestBody := graphusers.NewItemCreateUploadSessionPostRequestBody()
attachmentItem := graphmodels.NewAttachmentItem()
attachmentType := graphmodels.FILE_ATTACHMENTTYPE 
attachmentItem.SetAttachmentType(&amp;attachmentType) 
name := "flower"
attachmentItem.SetName(&amp;name) 
size := int64(3483322)
attachmentItem.SetSize(&amp;size) 
requestBody.SetAttachmentItem(attachmentItem)

// To initialize your graphClient, see https://learn.microsoft.com/en-us/graph/sdks/create-client?from=snippets&amp;tabs=go
createUploadSession, err := graphClient.Me().Messages().ByMessageId("message-id").Attachments().CreateUploadSession().Post(context.Background(), requestBody, nil)


</code></pre>
<!-- markdownlint-disable MD041-->
<blockquote>
<p>Read the <a href="/en-us/graph/sdks/sdks-overview" data-linktype="absolute-path">SDK documentation</a> for details on how to <a href="/en-us/graph/sdks/sdk-installation" data-linktype="absolute-path">add the SDK</a> to your project and <a href="/en-us/graph/sdks/choose-authentication-providers" data-linktype="absolute-path">create an authProvider</a> instance.</p>
</blockquote>
</section>
<section id="tabpanel_1_java" role="tabpanel" data-tab="java" aria-hidden="true" hidden="hidden">

<pre><code class="lang-java">
// Code snippets are only available for the latest version. Current version is 6.x

GraphServiceClient graphClient = new GraphServiceClient(requestAdapter);

com.microsoft.graph.users.item.messages.item.attachments.createuploadsession.CreateUploadSessionPostRequestBody createUploadSessionPostRequestBody = new com.microsoft.graph.users.item.messages.item.attachments.createuploadsession.CreateUploadSessionPostRequestBody();
AttachmentItem attachmentItem = new AttachmentItem();
attachmentItem.setAttachmentType(AttachmentType.File);
attachmentItem.setName("flower");
attachmentItem.setSize(3483322L);
createUploadSessionPostRequestBody.setAttachmentItem(attachmentItem);
var result = graphClient.me().messages().byMessageId("{message-id}").attachments().createUploadSession().post(createUploadSessionPostRequestBody);


</code></pre>
<!-- markdownlint-disable MD041-->
<blockquote>
<p>Read the <a href="/en-us/graph/sdks/sdks-overview" data-linktype="absolute-path">SDK documentation</a> for details on how to <a href="/en-us/graph/sdks/sdk-installation" data-linktype="absolute-path">add the SDK</a> to your project and <a href="/en-us/graph/sdks/choose-authentication-providers" data-linktype="absolute-path">create an authProvider</a> instance.</p>
</blockquote>
</section>
<section id="tabpanel_1_javascript" role="tabpanel" data-tab="javascript" aria-hidden="true" hidden="hidden">

<pre><code class="lang-javascript">
const options = {
	authProvider,
};

const client = Client.init(options);

const uploadSession = {
  AttachmentItem: {
    attachmentType: 'file',
    name: 'flower',
    size: 3483322
  }
};

await client.api('/me/messages/AAMkADI5MAAIT3drCAAA=/attachments/createUploadSession')
	.post(uploadSession);

</code></pre>
<!-- markdownlint-disable MD041-->
<blockquote>
<p>Read the <a href="/en-us/graph/sdks/sdks-overview" data-linktype="absolute-path">SDK documentation</a> for details on how to <a href="/en-us/graph/sdks/sdk-installation" data-linktype="absolute-path">add the SDK</a> to your project and <a href="/en-us/graph/sdks/choose-authentication-providers" data-linktype="absolute-path">create an authProvider</a> instance.</p>
</blockquote>
</section>
<section id="tabpanel_1_php" role="tabpanel" data-tab="php" aria-hidden="true" hidden="hidden">

<pre><code class="lang-php">
&lt;?php
use Microsoft\Graph\GraphServiceClient;
use Microsoft\Graph\Generated\Users\Item\Messages\Item\Attachments\CreateUploadSession\CreateUploadSessionPostRequestBody;
use Microsoft\Graph\Generated\Models\AttachmentItem;
use Microsoft\Graph\Generated\Models\AttachmentType;


$graphServiceClient = new GraphServiceClient($tokenRequestContext, $scopes);

$requestBody = new CreateUploadSessionPostRequestBody();
$attachmentItem = new AttachmentItem();
$attachmentItem-&gt;setAttachmentType(new AttachmentType('file'));
$attachmentItem-&gt;setName('flower');
$attachmentItem-&gt;setSize(3483322);
$requestBody-&gt;setAttachmentItem($attachmentItem);

$result = $graphServiceClient-&gt;me()-&gt;messages()-&gt;byMessageId('message-id')-&gt;attachments()-&gt;createUploadSession()-&gt;post($requestBody)-&gt;wait();

</code></pre>
<!-- markdownlint-disable MD041-->
<blockquote>
<p>Read the <a href="/en-us/graph/sdks/sdks-overview" data-linktype="absolute-path">SDK documentation</a> for details on how to <a href="/en-us/graph/sdks/sdk-installation" data-linktype="absolute-path">add the SDK</a> to your project and <a href="/en-us/graph/sdks/choose-authentication-providers" data-linktype="absolute-path">create an authProvider</a> instance.</p>
</blockquote>
</section>
<section id="tabpanel_1_powershell" role="tabpanel" data-tab="powershell" aria-hidden="true" hidden="hidden">

<pre><code class="lang-powershell">
Import-Module Microsoft.Graph.Mail

$params = @{
	AttachmentItem = @{
		attachmentType = "file"
		name = "flower"
		size = 3483322
	}
}

# A UPN can also be used as -UserId.
New-MgUserMessageAttachmentUploadSession -UserId $userId -MessageId $messageId -BodyParameter $params

</code></pre>
<!-- markdownlint-disable MD041-->
<blockquote>
<p>Read the <a href="/en-us/graph/sdks/sdks-overview" data-linktype="absolute-path">SDK documentation</a> for details on how to <a href="/en-us/graph/sdks/sdk-installation" data-linktype="absolute-path">add the SDK</a> to your project and <a href="/en-us/graph/sdks/choose-authentication-providers" data-linktype="absolute-path">create an authProvider</a> instance.</p>
</blockquote>
</section>
<section id="tabpanel_1_python" role="tabpanel" data-tab="python" aria-hidden="true" hidden="hidden">

<pre><code class="lang-python">
# Code snippets are only available for the latest version. Current version is 1.x
from msgraph import GraphServiceClient
from msgraph.generated.users.item.messages.item.attachments.create_upload_session.create_upload_session_post_request_body import CreateUploadSessionPostRequestBody
from msgraph.generated.models.attachment_item import AttachmentItem
from msgraph.generated.models.attachment_type import AttachmentType
# To initialize your graph_client, see https://learn.microsoft.com/en-us/graph/sdks/create-client?from=snippets&amp;tabs=python
request_body = CreateUploadSessionPostRequestBody(
	attachment_item = AttachmentItem(
		attachment_type = AttachmentType.File,
		name = "flower",
		size = 3483322,
	),
)

result = await graph_client.me.messages.by_message_id('message-id').attachments.create_upload_session.post(request_body)


</code></pre>
<!-- markdownlint-disable MD041-->
<blockquote>
<p>Read the <a href="/en-us/graph/sdks/sdks-overview" data-linktype="absolute-path">SDK documentation</a> for details on how to <a href="/en-us/graph/sdks/sdk-installation" data-linktype="absolute-path">add the SDK</a> to your project and <a href="/en-us/graph/sdks/choose-authentication-providers" data-linktype="absolute-path">create an authProvider</a> instance.</p>
</blockquote>
</section>
</div>
<h4 id="response">Response</h4>
<p>The following example response shows the <strong>uploadSession</strong> resource returned for the message.</p>
<!-- {
  "blockType": "response",
  "name": "walkthrough_create_uploadsession_message",
  "truncated": true,
  "@odata.type": "microsoft.graph.uploadSession"
} -->
<pre><code class="lang-http">HTTP/1.1 201 Created
Content-type: application/json

{
    "@odata.context": "https://graph.microsoft.com/v1.0/$metadata#microsoft.graph.uploadSession",
    "uploadUrl": "https://outlook.office.com/api/v2.0/Users('a8e8e219-4931-95c1-b73d-62626fd79c32@72aa88bf-76f0-494f-91ab-2d7cd730db47')/Messages('AAMkADI5MAAIT3drCAAA=')/AttachmentSessions('AAMkADI5MAAIT3k0tAAA=')?authtoken=eyJhbGciOiJSUzI1NiIsImtpZCI6IktmYUNIUlN6bllHMmNI",
    "expirationDateTime": "2019-09-25T01:09:30.7671707Z",
    "nextExpectedRanges": [
        "0-"
    ]
}
</code></pre>
<h3 id="example-create-an-upload-session-for-an-event">Example: Create an upload session for an event</h3>
<h4 id="request-1">Request</h4>
<div class="tabGroup" id="tabgroup_2">
<ul role="tablist">
<li role="presentation">
<a href="#tabpanel_2_http" role="tab" aria-controls="tabpanel_2_http" data-tab="http" tabindex="0" aria-selected="true" data-linktype="self-bookmark">HTTP</a>
</li>
<li role="presentation">
<a href="#tabpanel_2_csharp" role="tab" aria-controls="tabpanel_2_csharp" data-tab="csharp" tabindex="-1" data-linktype="self-bookmark">C#</a>
</li>
<li role="presentation">
<a href="#tabpanel_2_go" role="tab" aria-controls="tabpanel_2_go" data-tab="go" tabindex="-1" data-linktype="self-bookmark">Go</a>
</li>
<li role="presentation">
<a href="#tabpanel_2_java" role="tab" aria-controls="tabpanel_2_java" data-tab="java" tabindex="-1" data-linktype="self-bookmark">Java</a>
</li>
<li role="presentation">
<a href="#tabpanel_2_javascript" role="tab" aria-controls="tabpanel_2_javascript" data-tab="javascript" tabindex="-1" data-linktype="self-bookmark">JavaScript</a>
</li>
<li role="presentation">
<a href="#tabpanel_2_php" role="tab" aria-controls="tabpanel_2_php" data-tab="php" tabindex="-1" data-linktype="self-bookmark">PHP</a>
</li>
<li role="presentation">
<a href="#tabpanel_2_powershell" role="tab" aria-controls="tabpanel_2_powershell" data-tab="powershell" tabindex="-1" data-linktype="self-bookmark">PowerShell</a>
</li>
<li role="presentation">
<a href="#tabpanel_2_python" role="tab" aria-controls="tabpanel_2_python" data-tab="python" tabindex="-1" data-linktype="self-bookmark">Python</a>
</li>
</ul>
<section id="tabpanel_2_http" role="tabpanel" data-tab="http">
<!-- {
  "blockType": "request",
  "name": "walkthrough_create_uploadsession_event",
  "sampleKeys": ["AAMkADU5CCmSAAA="]
}-->
<pre><code class="lang-http">POST https://graph.microsoft.com/v1.0/me/events/AAMkADU5CCmSAAA=/attachments/createUploadSession
Content-type: application/json

{
  "AttachmentItem": {
    "attachmentType": "file",
    "name": "flower",
    "size": 3483322
  }
}
</code></pre>
</section>
<section id="tabpanel_2_csharp" role="tabpanel" data-tab="csharp" aria-hidden="true" hidden="hidden">

<pre><code class="lang-csharp">
// Code snippets are only available for the latest version. Current version is 5.x

// Dependencies
using Microsoft.Graph.Me.Events.Item.Attachments.CreateUploadSession;
using Microsoft.Graph.Models;

var requestBody = new CreateUploadSessionPostRequestBody
{
	AttachmentItem = new AttachmentItem
	{
		AttachmentType = AttachmentType.File,
		Name = "flower",
		Size = 3483322L,
	},
};

// To initialize your graphClient, see https://learn.microsoft.com/en-us/graph/sdks/create-client?from=snippets&amp;tabs=csharp
var result = await graphClient.Me.Events["{event-id}"].Attachments.CreateUploadSession.PostAsync(requestBody);


</code></pre>
<!-- markdownlint-disable MD041-->
<blockquote>
<p>Read the <a href="/en-us/graph/sdks/sdks-overview" data-linktype="absolute-path">SDK documentation</a> for details on how to <a href="/en-us/graph/sdks/sdk-installation" data-linktype="absolute-path">add the SDK</a> to your project and <a href="/en-us/graph/sdks/choose-authentication-providers" data-linktype="absolute-path">create an authProvider</a> instance.</p>
</blockquote>
</section>
<section id="tabpanel_2_go" role="tabpanel" data-tab="go" aria-hidden="true" hidden="hidden">

<pre><code class="lang-go">

// Code snippets are only available for the latest major version. Current major version is $v1.*

// Dependencies
import (
	  "context"
	  msgraphsdk "github.com/microsoftgraph/msgraph-sdk-go"
	  graphusers "github.com/microsoftgraph/msgraph-sdk-go/users"
	  graphmodels "github.com/microsoftgraph/msgraph-sdk-go/models"
	  //other-imports
)

requestBody := graphusers.NewItemCreateUploadSessionPostRequestBody()
attachmentItem := graphmodels.NewAttachmentItem()
attachmentType := graphmodels.FILE_ATTACHMENTTYPE 
attachmentItem.SetAttachmentType(&amp;attachmentType) 
name := "flower"
attachmentItem.SetName(&amp;name) 
size := int64(3483322)
attachmentItem.SetSize(&amp;size) 
requestBody.SetAttachmentItem(attachmentItem)

// To initialize your graphClient, see https://learn.microsoft.com/en-us/graph/sdks/create-client?from=snippets&amp;tabs=go
createUploadSession, err := graphClient.Me().Events().ByEventId("event-id").Attachments().CreateUploadSession().Post(context.Background(), requestBody, nil)


</code></pre>
<!-- markdownlint-disable MD041-->
<blockquote>
<p>Read the <a href="/en-us/graph/sdks/sdks-overview" data-linktype="absolute-path">SDK documentation</a> for details on how to <a href="/en-us/graph/sdks/sdk-installation" data-linktype="absolute-path">add the SDK</a> to your project and <a href="/en-us/graph/sdks/choose-authentication-providers" data-linktype="absolute-path">create an authProvider</a> instance.</p>
</blockquote>
</section>
<section id="tabpanel_2_java" role="tabpanel" data-tab="java" aria-hidden="true" hidden="hidden">

<pre><code class="lang-java">
// Code snippets are only available for the latest version. Current version is 6.x

GraphServiceClient graphClient = new GraphServiceClient(requestAdapter);

com.microsoft.graph.users.item.events.item.attachments.createuploadsession.CreateUploadSessionPostRequestBody createUploadSessionPostRequestBody = new com.microsoft.graph.users.item.events.item.attachments.createuploadsession.CreateUploadSessionPostRequestBody();
AttachmentItem attachmentItem = new AttachmentItem();
attachmentItem.setAttachmentType(AttachmentType.File);
attachmentItem.setName("flower");
attachmentItem.setSize(3483322L);
createUploadSessionPostRequestBody.setAttachmentItem(attachmentItem);
var result = graphClient.me().events().byEventId("{event-id}").attachments().createUploadSession().post(createUploadSessionPostRequestBody);


</code></pre>
<!-- markdownlint-disable MD041-->
<blockquote>
<p>Read the <a href="/en-us/graph/sdks/sdks-overview" data-linktype="absolute-path">SDK documentation</a> for details on how to <a href="/en-us/graph/sdks/sdk-installation" data-linktype="absolute-path">add the SDK</a> to your project and <a href="/en-us/graph/sdks/choose-authentication-providers" data-linktype="absolute-path">create an authProvider</a> instance.</p>
</blockquote>
</section>
<section id="tabpanel_2_javascript" role="tabpanel" data-tab="javascript" aria-hidden="true" hidden="hidden">

<pre><code class="lang-javascript">
const options = {
	authProvider,
};

const client = Client.init(options);

const uploadSession = {
  AttachmentItem: {
    attachmentType: 'file',
    name: 'flower',
    size: 3483322
  }
};

await client.api('/me/events/AAMkADU5CCmSAAA=/attachments/createUploadSession')
	.post(uploadSession);

</code></pre>
<!-- markdownlint-disable MD041-->
<blockquote>
<p>Read the <a href="/en-us/graph/sdks/sdks-overview" data-linktype="absolute-path">SDK documentation</a> for details on how to <a href="/en-us/graph/sdks/sdk-installation" data-linktype="absolute-path">add the SDK</a> to your project and <a href="/en-us/graph/sdks/choose-authentication-providers" data-linktype="absolute-path">create an authProvider</a> instance.</p>
</blockquote>
</section>
<section id="tabpanel_2_php" role="tabpanel" data-tab="php" aria-hidden="true" hidden="hidden">

<pre><code class="lang-php">
&lt;?php
use Microsoft\Graph\GraphServiceClient;
use Microsoft\Graph\Generated\Users\Item\Events\Item\Attachments\CreateUploadSession\CreateUploadSessionPostRequestBody;
use Microsoft\Graph\Generated\Models\AttachmentItem;
use Microsoft\Graph\Generated\Models\AttachmentType;


$graphServiceClient = new GraphServiceClient($tokenRequestContext, $scopes);

$requestBody = new CreateUploadSessionPostRequestBody();
$attachmentItem = new AttachmentItem();
$attachmentItem-&gt;setAttachmentType(new AttachmentType('file'));
$attachmentItem-&gt;setName('flower');
$attachmentItem-&gt;setSize(3483322);
$requestBody-&gt;setAttachmentItem($attachmentItem);

$result = $graphServiceClient-&gt;me()-&gt;events()-&gt;byEventId('event-id')-&gt;attachments()-&gt;createUploadSession()-&gt;post($requestBody)-&gt;wait();

</code></pre>
<!-- markdownlint-disable MD041-->
<blockquote>
<p>Read the <a href="/en-us/graph/sdks/sdks-overview" data-linktype="absolute-path">SDK documentation</a> for details on how to <a href="/en-us/graph/sdks/sdk-installation" data-linktype="absolute-path">add the SDK</a> to your project and <a href="/en-us/graph/sdks/choose-authentication-providers" data-linktype="absolute-path">create an authProvider</a> instance.</p>
</blockquote>
</section>
<section id="tabpanel_2_powershell" role="tabpanel" data-tab="powershell" aria-hidden="true" hidden="hidden">

<pre><code class="lang-powershell">
Import-Module Microsoft.Graph.Calendar

$params = @{
	AttachmentItem = @{
		attachmentType = "file"
		name = "flower"
		size = 3483322
	}
}

# A UPN can also be used as -UserId.
New-MgUserEventAttachmentUploadSession -UserId $userId -EventId $eventId -BodyParameter $params

</code></pre>
<!-- markdownlint-disable MD041-->
<blockquote>
<p>Read the <a href="/en-us/graph/sdks/sdks-overview" data-linktype="absolute-path">SDK documentation</a> for details on how to <a href="/en-us/graph/sdks/sdk-installation" data-linktype="absolute-path">add the SDK</a> to your project and <a href="/en-us/graph/sdks/choose-authentication-providers" data-linktype="absolute-path">create an authProvider</a> instance.</p>
</blockquote>
</section>
<section id="tabpanel_2_python" role="tabpanel" data-tab="python" aria-hidden="true" hidden="hidden">

<pre><code class="lang-python">
# Code snippets are only available for the latest version. Current version is 1.x
from msgraph import GraphServiceClient
from msgraph.generated.users.item.events.item.attachments.create_upload_session.create_upload_session_post_request_body import CreateUploadSessionPostRequestBody
from msgraph.generated.models.attachment_item import AttachmentItem
from msgraph.generated.models.attachment_type import AttachmentType
# To initialize your graph_client, see https://learn.microsoft.com/en-us/graph/sdks/create-client?from=snippets&amp;tabs=python
request_body = CreateUploadSessionPostRequestBody(
	attachment_item = AttachmentItem(
		attachment_type = AttachmentType.File,
		name = "flower",
		size = 3483322,
	),
)

result = await graph_client.me.events.by_event_id('event-id').attachments.create_upload_session.post(request_body)


</code></pre>
<!-- markdownlint-disable MD041-->
<blockquote>
<p>Read the <a href="/en-us/graph/sdks/sdks-overview" data-linktype="absolute-path">SDK documentation</a> for details on how to <a href="/en-us/graph/sdks/sdk-installation" data-linktype="absolute-path">add the SDK</a> to your project and <a href="/en-us/graph/sdks/choose-authentication-providers" data-linktype="absolute-path">create an authProvider</a> instance.</p>
</blockquote>
</section>
</div>
<h4 id="response-1">Response</h4>
<p>The following example response shows the <strong>uploadSession</strong> resource returned for the event.</p>
<!-- {
  "blockType": "response",
  "name": "walkthrough_create_uploadsession_event",
  "truncated": true,
  "@odata.type": "microsoft.graph.uploadSession"
} -->
<pre><code class="lang-http">HTTP/1.1 201 Created
Content-type: application/json

{
    "@odata.context": "https://graph.microsoft.com/v1.0/$metadata#microsoft.graph.uploadSession",
    "uploadUrl": "https://outlook.office.com/api/v2.0/Users('d3b9214b-dd8b-441d-b7dc-c446c9fa0e69@98a79ebe-74bf-4e07-a017-7b410848cb32')/Events('AAMkADU5CCmSAAA=')/AttachmentSessions('AAMkADU5RpAACJlCs8AAA=')?authtoken=eyJhbGciOiJSUzI1NiIsImtpZCI6IktmYUNIBtw",
    "expirationDateTime": "2020-02-22T02:46:56.7410786Z",
    "nextExpectedRanges": [
        "0-"
    ]
}

</code></pre>
<h2 id="step-2-use-the-upload-session-to-upload-a-range-of-bytes-of-the-file">Step 2: Use the upload session to upload a range of bytes of the file</h2>
<p>To upload the file, or a portion of the file, make a <code>PUT</code> request to the URL returned in step 1 in the <strong>uploadUrl</strong> property of the <strong>uploadSession</strong> resource. You can upload the entire file, or split the file into multiple byte ranges. For better performance, keep each byte range less than 4 MB.</p>
<p>Specify request headers and request body as described below.</p>
<h3 id="request-headers">Request headers</h3>
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
<td style="text-align: left;">Content-Length</td>
<td style="text-align: left;">Int32</td>
<td style="text-align: left;">The number of bytes being uploaded in this operation. For better performance, keep the upper limit of the number of bytes for each <code>PUT</code> operation to 4 MB. Required.</td>
</tr>
<tr>
<td style="text-align: left;">Content-Range</td>
<td style="text-align: left;">String</td>
<td style="text-align: left;">The 0-based byte range of the file being uploaded in this operation, expressed in the format <code>bytes {start}-{end}/{total}</code>. Required.</td>
</tr>
<tr>
<td style="text-align: left;">Content-Type</td>
<td style="text-align: left;">String</td>
<td style="text-align: left;">The MIME type. Specify <code>application/octet-stream</code>. Required.</td>
</tr>
</tbody>
</table>
<p>Do not specify an <code>Authorization</code> request header. The <code>PUT</code> query uses a pre-authenticated URL from the <strong>uploadUrl</strong> property, that allows access to the <code>https://outlook.office.com</code> domain.</p>
<h3 id="request-body">Request body</h3>
<p>Specify the actual bytes of the file to be attached, that are in the location range specified by the <code>Content-Range</code> request header.</p>
<h3 id="response-2">Response</h3>
<p>A successful upload returns <code>HTTP 200 OK</code> and an <strong>uploadSession</strong> object. Note the following in the response object:</p>
<ul>
<li>The <strong>expirationDateTime</strong> property indicates the expiration date/time for the auth token embedded in the <strong>uploadUrl</strong> property value. This expiration date/time remains the same as returned by the initial <strong>uploadSession</strong> in step 1.</li>
<li>The <strong>nextExpectedRanges</strong> specifies the next byte location to start uploading from, for example, <code>"nextExpectedRanges":["2097152"]</code>. You must upload bytes in a file in order.</li>
</ul>
<!-- The **nextExpectedRanges** specifies one or more byte ranges, each indicating the starting point of a subsequent `PUT` request:

  - On a successful upload, this property returns the next range to start from, for example, `"nextExpectedRanges":["2097152"]`.
  - If a portion of a byte range has not uploaded successfully, this property includes the byte range with the start and end locations, for example, `"nextExpectedRanges":["1998457-2097094"]`.
-->
<ul>
<li>The <strong>uploadUrl</strong> property is not explicitly returned, because all <code>PUT</code> operations of an upload session use the same URL returned when creating the session (step 1).</li>
</ul>
<h3 id="example-first-upload-to-the-message">Example: First upload to the message</h3>
<h4 id="request-2">Request</h4>
<!-- {
  "blockType": "ignored"
}-->
<pre><code class="lang-http">PUT https://outlook.office.com/api/v2.0/Users('a8e8e219-4931-95c1-b73d-62626fd79c32@72aa88bf-76f0-494f-91ab-2d7cd730db47')/Messages('AAMkADI5MAAIT3drCAAA=')/AttachmentSessions('AAMkADI5MAAIT3k0tAAA=')?authtoken=eyJhbGciOiJSUzI1NiIsImtpZCI6IktmYUNIUlN6bllHMmNI
Content-Type: application/octet-stream
Content-Length: 2097152
Content-Range: bytes 0-2097151/3483322

{
  &lt;bytes 0-2097151 of the file to be attached, in binary format&gt;
}
</code></pre>
<h4 id="response-3">Response</h4>
<p>The following example response shows in the <strong>nextExpectedRanges</strong> property the start of the next byte range that the server expects.</p>
<!-- {
  "blockType": "ignored"
}-->
<pre><code class="lang-http">HTTP/1.1 200 OK
Content-type: application/json

{
  "@odata.context":"https://outlook.office.com/api/v2.0/$metadata#Users('a8e8e219-4931-95c1-b73d-62626fd79c32%4072aa88bf-76f0-494f-91ab-2d7cd730db47')/Messages('AAMkADI5MAAIT3drCAAA%3D')/AttachmentSessions/$entity",
  "ExpirationDateTime":"2019-09-25T01:09:30.7671707Z",
  "nextExpectedRanges":["2097152"]
}
</code></pre>
<h3 id="example-first-upload-to-the-event">Example: First upload to the event</h3>
<h4 id="request-3">Request</h4>
<!-- {
  "blockType": "ignored"
}-->
<pre><code class="lang-http">PUT https://outlook.office.com/api/v2.0/Users('d3b9214b-dd8b-441d-b7dc-c446c9fa0e69@98a79ebe-74bf-4e07-a017-7b410848cb32')/Events('AAMkADU5CCmSAAA=')/AttachmentSessions('AAMkADU5RpAACJlCs8AAA=')?authtoken=eyJhbGciOiJSUzI1NiIsImtpZCI6IktmYUNIBtw
Content-Type: application/octet-stream
Content-Length: 2097152
Content-Range: bytes 0-2097151/3483322

{
  &lt;bytes 0-2097151 of the file to be attached, in binary format&gt;
}
</code></pre>
<h4 id="response-4">Response</h4>
<p>The following example response shows in the <strong>nextExpectedRanges</strong> property the start of the next byte range that the server expects.</p>
<!-- {
  "blockType": "ignored"
}-->
<pre><code class="lang-http">HTTP/1.1 200 OK
Content-type: application/json

{
    "@odata.context":"https://outlook.office.com/api/v2.0/$metadata#Users('d3b9214b-dd8b-441d-b7dc-c446c9fa0e69%4098a79ebe-74bf-4e07-a017-7b410848cb32')/Events('AAMkADU5CCmSAAA%3D')/AttachmentSessions/$entity",
    "ExpirationDateTime":"2020-02-22T02:46:56.7410786Z",
    "nextExpectedRanges":["2097152"]
}
</code></pre>
<h2 id="step-3-continue-uploading-byte-ranges-until-the-entire-file-has-been-uploaded">Step 3: Continue uploading byte ranges until the entire file has been uploaded</h2>
<p>Following the initial upload in step 2, continue to upload the remaining portion of the file, using a similar <code>PUT</code> request as described in step 2, before you reach the expiration date/time for the session. Use the <strong>nextExpectedRanges</strong> collection to determine where to start the next byte range to upload. You might see multiple ranges specified, indicating parts of the file that the server has not yet received. This is useful if you need to resume a transfer that was interrupted and your client is unsure of the state on the service.</p>
<p>Once the last byte of the file has been successfully uploaded, the final <code>PUT</code> operation returns <code>HTTP 201 Created</code> and a <code>Location</code> header that indicates the URL to the file attachment in the <code>https://outlook.office.com</code> domain. You can get the attachment ID from the URL and save it for later use. Depending on your scenario, you can use that ID to <a href="/en-us/graph/api/attachment-get" data-linktype="absolute-path">get the metadata of the attachment</a>, or <a href="/en-us/graph/api/attachment-delete" data-linktype="absolute-path">remove the attachment from the Outlook item</a> using the Microsoft Graph endpoint.</p>
<p>The following examples show uploading the last byte range of the file to the message and to the event in the preceding steps.</p>
<h3 id="example-final-upload-to-the-message">Example: Final upload to the message</h3>
<h4 id="request-4">Request</h4>
<!-- {
  "blockType": "ignored"
}-->
<pre><code class="lang-http">PUT https://outlook.office.com/api/v2.0/Users('a8e8e219-4931-95c1-b73d-62626fd79c32@72aa88bf-76f0-494f-91ab-2d7cd730db47')/Messages('AAMkADI5MAAIT3drCAAA=')/AttachmentSessions('AAMkADI5MAAIT3k0tAAA=')?authtoken=eyJhbGciOiJSUzI1NiIsImtpZCI6IktmYUNIUlN6bllHMmNI
Content-Type: application/octet-stream
Content-Length: 1386170
Content-Range: bytes 2097152-3483321/3483322

{
  &lt;bytes 2097152-3483321 of the file to be attached, in binary format&gt;
}
</code></pre>
<h4 id="response-5">Response</h4>
<p>The following example response shows a <code>Location</code> response header from which you can save the attachment ID (<code>AAMkADI5MAAIT3drCAAABEgAQANAqbAe7qaROhYdTnUQwXm0=</code>) for later use.</p>
<!-- {
  "blockType": "ignored"
}-->
<pre><code class="lang-http">HTTP/1.1 201 Created

Location: https://outlook.office.com/api/v2.0/Users('a8e8e219-4931-95c1-b73d-62626fd79c32@72aa88bf-76f0-494f-91ab-2d7cd730db47')/Messages('AAMkADI5MAAIT3drCAAA=')/Attachments('AAMkADI5MAAIT3drCAAABEgAQANAqbAe7qaROhYdTnUQwXm0=')
Content-Length: 0
</code></pre>
<h3 id="example-final-upload-to-the-event">Example: Final upload to the event</h3>
<h4 id="request-5">Request</h4>
<!-- {
  "blockType": "ignored"
}-->
<pre><code class="lang-http">PUT https://outlook.office.com/api/v2.0/Users('d3b9214b-dd8b-441d-b7dc-c446c9fa0e69@98a79ebe-74bf-4e07-a017-7b410848cb32')/Events('AAMkADU5CCmSAAA=')/AttachmentSessions('AAMkADU5RpAACJlCs8AAA=')?authtoken=eyJhbGciOiJSUzI1NiIsImtpZCI6IktmYUNIBtw
Content-Type: application/octet-stream
Content-Length: 1386170
Content-Range: bytes 2097152-3483321/3483322

{
  &lt;bytes 2097152-3483321 of the file to be attached, in binary format&gt;
}
</code></pre>
<h4 id="response-6">Response</h4>
<p>The following example response shows a <code>Location</code> response header from which you can save the attachment ID (<code>AAMkADU5CCmSAAANZAlYPeyQByv7Y=</code>) for later use.</p>
<!-- {
  "blockType": "ignored"
}-->
<pre><code class="lang-http">HTTP/1.1 201 Created

Location: https://outlook.office.com/api/v2.0/Users('d3b9214b-dd8b-441d-b7dc-c446c9fa0e69@98a79ebe-74bf-4e07-a017-7b410848cb32')/Events('AAMkADU5CCmSAAA=')/Attachments('AAMkADU5CCmSAAANZAlYPeyQByv7Y=')
Content-Length: 0
</code></pre>
<h2 id="step-4-optional-get-the-file-attachment-from-the-outlook-item">Step 4 (optional): Get the file attachment from the Outlook item</h2>
<p>As always, <a href="/en-us/graph/api/attachment-get" data-linktype="absolute-path">getting an attachment</a> from an Outlook item is not technically limited by attachment size.</p>
<p>However, getting a large file attachment in base64-encoded format affects API performance. If you expect a large attachment:</p>
<ul>
<li>As an alternative to getting the attachment content in base64 format, you can <a href="/en-us/graph/api/attachment-get#example-6-get-the-raw-contents-of-a-file-attachment-on-a-message" data-linktype="absolute-path">get the raw data of the file attachment</a>.</li>
<li>To <a href="/en-us/graph/api/attachment-get#example-1-get-the-properties-of-a-file-attachment" data-linktype="absolute-path">get the metadata of the file attachment</a>, append a <code>$select</code> parameter to include only those metadata properties you want, excluding the <strong>contentBytes</strong> property which returns the file attachment in base64 format.</li>
</ul>
<h3 id="example-get-the-raw-file-attached-to-the-event">Example: Get the raw file attached to the event</h3>
<p>Following the event example and using the attachment ID returned in the <code>Location</code> header of the previous step, the example request in this section shows using a <code>$value</code> parameter to get the attachment raw content data.</p>
<h4 id="permissions-1">Permissions</h4>
<p>Use the least privileged delegated or application permission, <code>Calendars.Read</code>, as appropriate, for this operation. For more information, see <a href="permissions-reference" data-linktype="relative-path">calendar permissions</a>.</p>
<h4 id="request-6">Request</h4>
<!-- {
  "blockType": "ignored",
  "name": "walkthrough_get_attachment_raw",
  "sampleKeys": ["d3b9214b-dd8b-441d-b7dc-c446c9fa0e69@98a79ebe-74bf-4e07-a017-7b410848cb32", "AAMkADU5CCmSAAA=", "AAMkADU5CCmSAAANZAlYPeyQByv7Y="]
}-->
<pre><code class="lang-http">GET https://graph.microsoft.com/v1.0/Users('d3b9214b-dd8b-441d-b7dc-c446c9fa0e69@98a79ebe-74bf-4e07-a017-7b410848cb32')/Events('AAMkADU5CCmSAAA=')/Attachments('AAMkADU5CCmSAAANZAlYPeyQByv7Y=')/$value
</code></pre>
<h4 id="response-7">Response</h4>
<!-- {
  "blockType": "ignored",
  "name": "walkthrough_get_attachment_raw",
  "truncated": true
} -->
<pre><code class="lang-http">HTTP/1.1 200 OK
content-length: 3483322
Content-type: image/jpeg

{Raw bytes of the file}
</code></pre>
<h3 id="example-get-the-metadata-of-the-file-attached-to-the-message">Example: Get the metadata of the file attached to the message</h3>
<p>Following the message example, the example request in this section shows using a <code>$select</code> parameter to get some of the metadata of a file attachment on a message, excluding <strong>contentBytes</strong>.</p>
<h4 id="permissions-2">Permissions</h4>
<p>Use the least privileged delegated or application permission, <code>Mail.Read</code>, as appropriate, for this operation. For more information, see <a href="permissions-reference" data-linktype="relative-path">mail permissions</a>.</p>
<h4 id="request-7">Request</h4>
<!-- {
  "blockType": "request",
  "name": "walkthrough_get_attachment_metadata",
  "sampleKeys": ["a8e8e219-4931-95c1-b73d-62626fd79c32@72aa88bf-76f0-494f-91ab-2d7cd730db47", "AAMkADI5MAAIT3drCAAA=", "AAMkADI5MAAIT3drCAAABEgAQANAqbAe7qaROhYdTnUQwXm0="]
}-->
<pre><code class="lang-http">GET https://graph.microsoft.com/api/v1.0/Users('a8e8e219-4931-95c1-b73d-62626fd79c32@72aa88bf-76f0-494f-91ab-2d7cd730db47')/Messages('AAMkADI5MAAIT3drCAAA=')/Attachments('AAMkADI5MAAIT3drCAAABEgAQANAqbAe7qaROhYdTnUQwXm0=')?$select=lastModifiedDateTime,name,contentType,size,isInline
</code></pre>
<h4 id="response-8">Response</h4>
<!-- {
  "blockType": "response",
  "name": "walkthrough_get_attachment_metadata",
  "truncated": true,
  "@odata.type": "microsoft.graph.fileAttachment"
} -->
<pre><code class="lang-http">HTTP/1.1 200 OK
Content-type: application/json

{
    "@odata.context": "https://graph.microsoft.com/v1.0/$metadata#users('a8e8e219-4931-95c1-b73d-62626fd79c32%4072aa88bf-76f0-494f-91ab-2d7cd730db47')/messages('AAMkADI5MAAIT3drCAAA%3D')/attachments/$entity",
    "@odata.type": "#microsoft.graph.fileAttachment",
    "@odata.mediaContentType": "image/jpeg",
    "id": "AAMkADI5MAAIT3drCAAABEgAQANAqbAe7qaROhYdTnUQwXm0=",
    "lastModifiedDateTime": "2019-09-24T23:27:43Z",
    "name": "flower",
    "contentType": "image/jpeg",
    "size": 3640066,
    "isInline": false
}
</code></pre>
<h2 id="alternative-cancel-the-upload-session">Alternative: Cancel the upload session</h2>
<p>At any point of time before the upload session expires, if you have to cancel the upload, you can use the same initial opaque URL to delete the upload session. A successful operation returns <code>HTTP 204 No Content</code>.</p>
<h3 id="permissions-3">Permissions</h3>
<p>Because the initial opaque URL is pre-authenticated and contains the appropriate authorization token for subsequent queries for that upload session, do not specify an Authorization request header for this operation.</p>
<h3 id="example-cancel-the-upload-session-for-the-message">Example: Cancel the upload session for the message</h3>
<h4 id="request-8">Request</h4>
<!-- {
  "blockType": "ignored"
}-->
<pre><code class="lang-http">DELETE https://outlook.office.com/api/v2.0/Users('a8e8e219-4931-95c1-b73d-62626fd79c32@72aa88bf-76f0-494f-91ab-2d7cd730db47')/Messages('AAMkADI5MAAIT3drCAAA=')/AttachmentSessions('AAMkADI5MAAIT3k0tAAA=')?authtoken=eyJhbGciOiJSUzI1NiIsImtpZCI6IktmYUNIUlN6bllHMmNI
</code></pre>
<h4 id="response-9">Response</h4>
<!-- {
  "blockType": "ignored"
}-->
<pre><code class="lang-http">HTTP/1.1 204 No content
</code></pre>
<h2 id="errors">Errors</h2>
<h3 id="errorattachmentsizeshouldnotbelessthanminimumsize">ErrorAttachmentSizeShouldNotBeLessThanMinimumSize</h3>
<p>This error is returned when attempting to <a href="/en-us/graph/api/attachment-createuploadsession" data-linktype="absolute-path">create an upload session</a> to attach a file smaller than 3 MB. If the file size is under 3 MB, you should do a single POST on the <strong>attachments</strong> navigation property <a href="/en-us/graph/api/message-post-attachments" data-linktype="absolute-path">of the message</a> or <a href="/en-us/graph/api/event-post-attachments" data-linktype="absolute-path">of the event</a>. The successful <code>POST</code> response includes the ID of the file attached to the message.</p>
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
		datetime="2024-11-07T08:00:00.000Z"
		data-article-date-source="calculated"
		class="is-invisible"
	>
		2024-11-07
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