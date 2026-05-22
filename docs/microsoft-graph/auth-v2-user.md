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
			<title>Get access on behalf of a user - Microsoft Graph | Microsoft Learn</title>
			<meta charset="utf-8" />
			<meta name="viewport" content="width=device-width, initial-scale=1.0" />
			<meta name="color-scheme" content="light dark" />

			<meta name="description" content="Learn how an app obtains an access token from the Microsoft identity platform and calls Microsoft Graph on behalf of a user." />
			<link rel="canonical" href="https://learn.microsoft.com/en-us/graph/auth-v2-user" /> 

			<!-- Non-customizable open graph and sharing-related metadata -->
			<meta name="twitter:card" content="summary_large_image" />
			<meta name="twitter:site" content="@MicrosoftLearn" />
			<meta property="og:type" content="website" />
			<meta property="og:image:alt" content="Microsoft Learn" />
			<meta property="og:image" content="https://learn.microsoft.com/en-us/media/open-graph-image.png" />
			<!-- Page specific open graph and sharing-related metadata -->
			<meta property="og:title" content="Get access on behalf of a user - Microsoft Graph" />
			<meta property="og:url" content="https://learn.microsoft.com/en-us/graph/auth-v2-user" />
			<meta property="og:description" content="Learn how an app obtains an access token from the Microsoft identity platform and calls Microsoft Graph on behalf of a user." />
			<meta name="platform_id" content="c230723d-7c3f-c5ff-85a7-b6e94e920338" /> <meta name="scope" content="graph" />
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
	
		<meta name="ms.topic" content="tutorial" />
	
		<meta name="ms.reviewer" content="jackson.woods" />
	
		<meta name="ms.localizationpriority" content="high" />
	
		<meta name="ms.custom" content="graphiamtop20" />
	
		<meta name="ms.date" content="2025-08-29T00:00:00Z" />
	
		<meta name="document_id" content="4323239e-0486-0f8f-6f2b-5e41e6178594" />
	
		<meta name="document_version_independent_id" content="627883a9-8cd7-93cd-358d-b841d390714b" />
	
		<meta name="updated_at" content="2025-08-29T23:05:00Z" />
	
		<meta name="original_content_git_url" content="https://github.com/microsoftgraph/microsoft-graph-docs/blob/live/concepts/auth-v2-user.md" />
	
		<meta name="gitcommit" content="https://github.com/microsoftgraph/microsoft-graph-docs/blob/6f6ea4bab1b8a507923b8178639518bcb61ba882/concepts/auth-v2-user.md" />
	
		<meta name="git_commit_id" content="6f6ea4bab1b8a507923b8178639518bcb61ba882" />
	
		<meta name="site_name" content="Docs" />
	
		<meta name="depot_name" content="MSDN.microsoft-graph-docs" />
	
		<meta name="schema" content="Conceptual" />
	
		<meta name="toc_rel" content="toc.json" />
	
		<meta name="feedback_help_link_type" content="" />
	
		<meta name="feedback_help_link_url" content="" />
	
		<meta name="word_count" content="2378" />
	
		<meta name="asset_id" content="auth-v2-user" />
	
		<meta name="moniker_range_name" content="" />
	
		<meta name="item_type" content="Content" />
	
		<meta name="source_path" content="concepts/auth-v2-user.md" />
	
		<meta name="previous_tlsh_hash" content="84519B52620C8A26FD966C157C2BB79236F0E04DAE70EAD42DA96B9161850FB71B159E56FB83A7C52376839301D7BD0DD3E5B73DC12D729349B958A4C2EC2813AB483373C8" />
	
		<meta name="github_feedback_content_git_url" content="https://github.com/microsoftgraph/microsoft-graph-docs-contrib/blob/main/concepts/auth-v2-user.md" />
	
		<meta name="markdown_url" content="https://learn.microsoft.com/en-us/graph/auth-v2-user?accept=text/markdown" />
	 
		<meta name="cmProducts" content="https://authoring-docs-microsoft.poolparty.biz/devrel/5fc61396-d075-4560-aece-fdbda73d243f" data-source="generated" />
	
		<meta name="cmProducts" content="https://authoring-docs-microsoft.poolparty.biz/devrel/1ae5c491-970a-4062-8301-6336e69f9026" data-source="generated" />
	
		<meta name="cmProducts" content="https://microsoft-devrel.poolparty.biz/DevRelOfferingOntology/1433a524-c01f-4b87-beab-670c040dea4f" data-source="generated" />
	
		<meta name="spProducts" content="https://authoring-docs-microsoft.poolparty.biz/devrel/ad9437c1-8cda-4537-ad69-b4b263652e13" data-source="generated" />
	
		<meta name="spProducts" content="https://authoring-docs-microsoft.poolparty.biz/devrel/f2c3e52e-3667-4e8a-bf11-20b9eaccdc8c" data-source="generated" />
	
		<meta name="spProducts" content="https://microsoft-devrel.poolparty.biz/DevRelOfferingOntology/312f1f05-a431-4193-8a4d-e6245d5966de" data-source="generated" />
	

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
        "name": "fdmonroy",
        "url": "https://github.com/fdmonroy"
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
        "name": "alexbuckgit",
        "url": "https://github.com/alexbuckgit"
      },
      {
        "name": "Lauragra",
        "url": "https://github.com/Lauragra"
      },
      {
        "name": "arviedelgado",
        "url": "https://github.com/arviedelgado"
      },
      {
        "name": "t-miller",
        "url": "https://github.com/t-miller"
      },
      {
        "name": "omondiatieno",
        "url": "https://github.com/omondiatieno"
      },
      {
        "name": "jack-ohara",
        "url": "https://github.com/jack-ohara"
      },
      {
        "name": "mr-oliva",
        "url": "https://github.com/mr-oliva"
      },
      {
        "name": "JamesTran-MSFT",
        "url": "https://github.com/JamesTran-MSFT"
      },
      {
        "name": "Jackson-Woods",
        "url": "https://github.com/Jackson-Woods"
      },
      {
        "name": "rwike77",
        "url": "https://github.com/rwike77"
      },
      {
        "name": "DCtheGeek",
        "url": "https://github.com/DCtheGeek"
      },
      {
        "name": "kjyam98",
        "url": "https://github.com/kjyam98"
      },
      {
        "name": "CalvinAllen",
        "url": "https://github.com/CalvinAllen"
      },
      {
        "name": "jthake",
        "url": "https://github.com/jthake"
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
			
			href="https://github.com/microsoftgraph/microsoft-graph-docs-contrib/blob/main/concepts/auth-v2-user.md"
			data-original_content_git_url="https://github.com/microsoftgraph/microsoft-graph-docs/blob/live/concepts/auth-v2-user.md"
			data-original_content_git_url_template="{repo}/blob/{branch}/concepts/auth-v2-user.md"
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
	
					<div class="content"><h1 id="get-access-on-behalf-of-a-user">Get access on behalf of a user</h1></div>
					
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
	
					<div class="content"><p>To call Microsoft Graph, an app must get an access token from the Microsoft identity platform. This access token includes information about whether the app is authorized to access Microsoft Graph on behalf of a signed-in user or with its own identity. This article provides guidance on how an app can <a href="auth/auth-concepts#access-scenarios" data-linktype="relative-path">access Microsoft Graph on behalf of a user</a>, also called <em>delegated access</em>.</p>
<p>This article details the raw HTTP requests involved for an app to get access on behalf of a user by using the popular <a href="/en-us/azure/active-directory/develop/v2-oauth2-auth-code-flow#" data-linktype="absolute-path">OAuth 2.0 authorization code grant flow</a>. Typically, you don't need to write raw HTTP requests and instead use a Microsoft-built or supported authentication library that handles many of these details for you and helps you get access tokens and call Microsoft Graph. For more information, see <a href="#use-the-microsoft-authentication-library-msal" data-linktype="self-bookmark">Use the Microsoft Authentication Library (MSAL)</a>.</p>
<p>In this article, you complete the following steps in using the OAuth 2.0 authorization code grant flow:</p>
<ol>
<li>Request authorization.</li>
<li>Request an access token.</li>
<li>Use the access token to call Microsoft Graph.</li>
<li>[Optional] Use the refresh token to renew an expired access token.</li>
</ol>
<h2 id="prerequisites">Prerequisites</h2>
<p>Before proceeding with the steps in this article:</p>
<ol>
<li>Understand the authentication and authorization concepts in the Microsoft identity platform. For more information, see <a href="auth/auth-concepts" data-linktype="relative-path">Authentication and authorization basics</a>.</li>
<li>Register the app with Microsoft Entra ID. For more information, see <a href="auth-register-app-v2" data-linktype="relative-path">Register an application with the Microsoft identity platform</a>. Save the following values from the app registration:
<ul>
<li>The application ID (referred to as Object ID on the Microsoft Entra admin center).</li>
<li>A client secret (application password), a certificate, or a federated identity credential. This property isn't needed for public clients like native, mobile, and single page applications.</li>
<li>A redirect URI for the app to receive token responses from Microsoft Entra ID.</li>
</ul>
</li>
</ol>
<h2 id="step-1-request-authorization">Step 1: Request authorization</h2>
<p>The first step in the authorization code flow is for the user to authorize the app to act on their behalf.</p>
<p>In the flow, the app redirects the user to the Microsoft identity platform <code>/authorize</code> endpoint. Through this endpoint, Microsoft Entra ID signs the user in and requests their consent for the permissions that the app requests. After consent is obtained, Microsoft Entra ID returns an authorization <strong>code</strong> to the app. The app can then redeem this code at the Microsoft identity platform <code>/token</code> endpoint for an access token.</p>
<h3 id="authorization-request">Authorization request</h3>
<p>The following example shows a request to the <code>/authorize</code> endpoint.</p>
<p>In the request URL, you call the <code>/authorize</code> endpoint and specify the required and recommended properties as query parameters.</p>
<p>In the following example, the app requests the <em>User.Read</em> and <em>Mail.Read</em> Microsoft Graph permissions, which allow the app to read the profile and mail of the signed-in user respectively. The <em>offline_access</em> permission is a standard OIDC scope that's requested so that the app can get a refresh token. The app can use the refresh token to get a new access token when the current one expires.</p>
<div class="tabGroup" id="tabgroup_1">
<ul role="tablist">
<li role="presentation">
<a href="#tabpanel_1_http" role="tab" aria-controls="tabpanel_1_http" data-tab="http" tabindex="0" aria-selected="true" data-linktype="self-bookmark">HTTP</a>
</li>
<li role="presentation">
<a href="#tabpanel_1_curl" role="tab" aria-controls="tabpanel_1_curl" data-tab="curl" tabindex="-1" data-linktype="self-bookmark">cURL</a>
</li>
</ul>
<section id="tabpanel_1_http" role="tabpanel" data-tab="http">

<pre><code>// Line breaks for legibility only

GET https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize?
client_id=11111111-1111-1111-1111-111111111111
&amp;response_type=code
&amp;redirect_uri=http%3A%2F%2Flocalhost%2Fmyapp%2F
&amp;response_mode=query
&amp;scope=offline_access%20user.read%20mail.read
&amp;state=12345  HTTP/1.1
</code></pre>
</section>
<section id="tabpanel_1_curl" role="tabpanel" data-tab="curl" aria-hidden="true" hidden="hidden">

<pre><code class="lang-bash">curl --location --request GET 'https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize?client_id=11111111-1111-1111-1111-111111111111&amp;response_type=code&amp;redirect_uri=https%3A%2F%2Flocalhost%2Fmyapp%2F&amp;response_mode=query&amp;scope=offline_access%20User.Read%20Mail.Read&amp;state=12345'
</code></pre>
</section>
</div>
<h5 id="parameters">Parameters</h5>
<table>
<thead>
<tr>
<th>Parameter</th>
<th>Required</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr>
<td>tenant</td>
<td>Required</td>
<td>The <code>{tenant}</code> value in the path of the request controls who can sign into the application. The allowed values are: <br><li><code>common</code> for both Microsoft accounts and work or school accounts </li><li><code>organizations</code> for work or school accounts only </li><li><code>consumers</code> for Microsoft accounts only </li><li>tenant identifiers such as the tenant ID or domain name. <br>For more information, see <a href="/en-us/azure/active-directory/develop/active-directory-v2-protocols#endpoints" data-linktype="absolute-path">protocol basics</a>.</li></td>
</tr>
<tr>
<td>client_id</td>
<td>Required</td>
<td>The Application (client) ID that the <a href="https://go.microsoft.com/fwlink/?linkid=2083908" data-linktype="external">registration portal</a> assigned the app. Also referred to as <strong>appId</strong> in the Microsoft Graph application and service principal object.</td>
</tr>
<tr>
<td>response_type</td>
<td>Required</td>
<td>Must include <code>code</code> for the OAuth 2.0 authorization code flow.</td>
</tr>
<tr>
<td>redirect_uri</td>
<td>Recommended</td>
<td>The redirect URI of the app, where authentication responses are sent to and received by the app. It must exactly match one of the redirect URIs you registered in the app registration portal, except it must be URL encoded. For native and mobile apps, use the default value of <code>https://login.microsoftonline.com/common/oauth2/nativeclient</code>.</td>
</tr>
<tr>
<td>scope</td>
<td>Required</td>
<td>A space-separated list of the Microsoft Graph permissions that you want the user to consent to. These permissions can include resource permissions, such as <em>User.Read</em> and <em>Mail.Read</em>, and OIDC scopes, such as <code>offline_access</code>, which indicates that the app needs a refresh token for long-lived access to resources.</td>
</tr>
<tr>
<td>response_mode</td>
<td>Recommended</td>
<td>Specifies the method that should be used to send the resulting token back to the app. Can be <code>query</code> or <code>form_post</code>.</td>
</tr>
<tr>
<td>state</td>
<td>Recommended</td>
<td>A value included in the request that's also returned in the token response. It can be a string of any content that you wish. A randomly generated unique value is typically used for <a href="https://tools.ietf.org/html/rfc6749#section-10.12" data-linktype="external">preventing cross-site request forgery attacks</a>. This property also encodes information about the user's state in the app before the authentication request occurred, such as the page or view they were on.</td>
</tr>
</tbody>
</table>
<h3 id="user-consent-experience">User consent experience</h3>
<p>After the app sends the authorization request, the user is asked to enter their credentials to authenticate with Microsoft. The Microsoft identity platform v2.0 endpoint ensures that the user consents to the permissions indicated in the <code>scope</code> query parameter. If the user or administrator didn't consent to any permission, they're asked to consent to the required permissions. For more information about the Microsoft Entra consent experience, see <a href="/en-us/azure/active-directory/develop/application-consent-experience" data-linktype="absolute-path">Application consent experience</a> and <a href="/en-us/azure/active-directory/develop/permissions-consent-overview#consent" data-linktype="absolute-path">Introduction to permissions and consent</a>.</p>
<p>The following screenshot is an example of the consent dialog box presented for a Microsoft account user.</p>
<p><span class="mx-imgBorder">
<img src="images/auth-v2/v2-consumer-consent.png" alt="Consent dialog for Microsoft account." data-linktype="relative-path">
</span>
</p>
<h3 id="authorization-response">Authorization response</h3>
<p>If the user consents to the permissions the app requested, the response contains the authorization code in the <code>code</code> parameter. Here's an example of a successful response to the previous request. Because the <code>response_mode</code> parameter in the request was set to <code>query</code>, the response is returned in the query string of the redirect URL.</p>
<pre><code>HTTP/1.1 200 OK

https://localhost/myapp/?code=M0ab92efe-b6fd-df08-87dc-2c6500a7f84d&amp;state=12345&amp;session_state=fe1540c3-a69a-469a-9fa3-8a2470936421#
</code></pre>
<h5 id="query-parameters">Query parameters</h5>
<table>
<thead>
<tr>
<th>Parameter</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr>
<td>code</td>
<td>The authorization code that the app requested. The app uses the authorization code to request an access token for the target resource. Authorization codes are short lived, typically they expire after about 10 minutes.</td>
</tr>
<tr>
<td>state</td>
<td>If a state parameter is included in the request, the same value appears in the response. The app should verify that the state values in the request and response are identical. This check helps to detect <a href="https://tools.ietf.org/html/rfc6749#section-10.12" data-linktype="external">Cross-Site Request Forgery (CSRF) attacks</a> against the client.</td>
</tr>
<tr>
<td>session_state</td>
<td>A unique value that identifies the current user session. This value is a GUID, but you should treat it as an opaque value that is passed without examination.</td>
</tr>
</tbody>
</table>
<h2 id="step-2-request-an-access-token">Step 2: Request an access token</h2>
<p>The app uses the authorization <code>code</code> received in the previous step to request an access token by sending a <code>POST</code> request to the <code>/token</code> endpoint.</p>
<h3 id="token-request">Token request</h3>
<div class="tabGroup" id="tabgroup_2">
<ul role="tablist">
<li role="presentation">
<a href="#tabpanel_2_http" role="tab" aria-controls="tabpanel_2_http" data-tab="http" tabindex="0" aria-selected="true" data-linktype="self-bookmark">HTTP</a>
</li>
<li role="presentation">
<a href="#tabpanel_2_curl" role="tab" aria-controls="tabpanel_2_curl" data-tab="curl" tabindex="-1" data-linktype="self-bookmark">cURL</a>
</li>
</ul>
<section id="tabpanel_2_http" role="tabpanel" data-tab="http">

<pre><code>// Line breaks for legibility only

POST /{tenant}/oauth2/v2.0/token HTTP/1.1
Host: https://login.microsoftonline.com
Content-Type: application/x-www-form-urlencoded

client_id=11111111-1111-1111-1111-111111111111
&amp;scope=user.read%20mail.read
&amp;code=OAAABAAAAiL9Kn2Z27UubvWFPbm0gLWQJVzCTE9UkP3pSx1aXxUjq3n8b2JRLk4OxVXr...
&amp;redirect_uri=http%3A%2F%2Flocalhost%2Fmyapp%2F
&amp;grant_type=authorization_code
&amp;client_secret=HF8Q~Krjqh4r...    // NOTE: Only required for web apps
</code></pre>
</section>
<section id="tabpanel_2_curl" role="tabpanel" data-tab="curl" aria-hidden="true" hidden="hidden">

<pre><code class="lang-bash">curl --location --request POST 'https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token' \
--header 'Content-Type: application/x-www-form-urlencoded' \
--data-urlencode 'client_id=11111111-1111-1111-1111-111111111111' \
--data-urlencode 'scope=User.Read Mail.Read' \
--data-urlencode 'code=M0ab92efe-b6fd-df08-87dc-2c6500a7f84d' \
--data-urlencode 'redirect_uri=https://localhost/myapp/' \
--data-urlencode 'grant_type=authorization_code' \
--data-urlencode 'client_secret=zHF8Q~Krjqh4r...''
</code></pre>
</section>
</div>
<h5 id="parameters-1">Parameters</h5>
<table>
<thead>
<tr>
<th>Parameter</th>
<th>Required</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr>
<td>tenant</td>
<td>Required</td>
<td>Use the <code>{tenant}</code> value in the path of the request to control who can sign into the application. The allowed values are: <br><li><code>common</code> for both Microsoft accounts and work or school accounts </li><li><code>organizations</code> for work or school accounts only </li><li><code>consumers</code> for Microsoft accounts only </li><li>tenant identifiers such as the tenant ID or domain name. <br>For more information, see <a href="/en-us/azure/active-directory/develop/active-directory-v2-protocols#endpoints" data-linktype="absolute-path">protocol basics</a>.</li></td>
</tr>
<tr>
<td>client_id</td>
<td>Required</td>
<td>The Application (client) ID that the <a href="https://go.microsoft.com/fwlink/?linkid=2083908" data-linktype="external">registration portal</a> assigned the app. Also referred to as <strong>appId</strong> in the Microsoft Graph application and service principal object.</td>
</tr>
<tr>
<td>grant_type</td>
<td>Required</td>
<td>Must be <code>authorization_code</code> for the authorization code flow.</td>
</tr>
<tr>
<td>scope</td>
<td>Required</td>
<td>A space-separated list of scopes. The scopes that your app requests in this leg must be equivalent to or a subset of the scopes that it requested in the authorization leg in Step 1. If the scopes you specify in this request span multiple resource servers, the v2.0 endpoint returns a token for the resource specified in the first scope.</td>
</tr>
<tr>
<td>code</td>
<td>Required</td>
<td>The authorization <strong>code</strong> that you acquired in the authorization leg in Step 1.</td>
</tr>
<tr>
<td>redirect_uri</td>
<td>Required</td>
<td>The same redirect URI value that you used to acquire the authorization <strong>code</strong> in Step 1.</td>
</tr>
<tr>
<td>client_secret</td>
<td>Required for web apps</td>
<td>The client secret that you created in the app registration portal for your app. Don't use it in a native app, because client secrets can't be reliably stored on devices. It's required for web apps and web APIs, which can store the client_secret securely on the server side.</td>
</tr>
</tbody>
</table>
<h3 id="token-response">Token response</h3>
<p>The access token includes a list of permissions in the <code>scope</code> parameter. The response is similar to the following sample.</p>
<pre><code class="lang-json">HTTP/1.1 200 OK
Content-type: application/json

{
    "token_type": "Bearer",
    "scope": "Mail.Read User.Read",
    "expires_in": 3736,
    "ext_expires_in": 3736,
    "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsIng1dCI6Ik5HVEZ2ZEstZnl0aEV1Q...",
    "refresh_token": "AwABAAAAvPM1KaPlrEqdFSBzjqfTGAMxZGUTdM0t4B4..."
}
</code></pre>
<h5 id="response-body-properties">Response body properties</h5>
<table>
<thead>
<tr>
<th>Parameter</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr>
<td>token_type</td>
<td>Indicates the token type value. The only type that Microsoft Entra ID supports is <code>Bearer</code>.</td>
</tr>
<tr>
<td>scope</td>
<td>A space separated list of the Microsoft Graph permissions that the access token is valid for.</td>
</tr>
<tr>
<td>expires_in</td>
<td>How long the access token is valid (in seconds).</td>
</tr>
<tr>
<td>ext_expires_in</td>
<td>Indicates an extended lifetime for the access token (in seconds) and used to support resiliency when the token issuance service isn't responding.</td>
</tr>
<tr>
<td>access_token</td>
<td>The requested access token. The app can use this token to call Microsoft Graph.</td>
</tr>
<tr>
<td>refresh_token</td>
<td>An OAuth 2.0 refresh token. The app can use this token to acquire additional access tokens after the current access token expires. Refresh tokens are long-lived, and can be used to retain access to resources for extended periods of time. A refresh token is only returned if you include <code>offline_access</code> as a <code>scope</code> parameter. For details, see the <a href="/en-us/azure/active-directory/develop/active-directory-v2-tokens" data-linktype="absolute-path">v2.0 token reference</a>.</td>
</tr>
</tbody>
</table>
<h2 id="step-3-use-the-access-token-to-call-microsoft-graph">Step 3: Use the access token to call Microsoft Graph</h2>
<p>After you get an access token, the app uses it to call Microsoft Graph by attaching the access token as a <strong>Bearer</strong> token to the <strong>Authorization</strong> header in an HTTP request. The following request gets the profile of the signed-in user.</p>
<h3 id="request">Request</h3>
<div class="tabGroup" id="tabgroup_3">
<ul role="tablist">
<li role="presentation">
<a href="#tabpanel_3_http" role="tab" aria-controls="tabpanel_3_http" data-tab="http" tabindex="0" aria-selected="true" data-linktype="self-bookmark">HTTP</a>
</li>
<li role="presentation">
<a href="#tabpanel_3_curl" role="tab" aria-controls="tabpanel_3_curl" data-tab="curl" tabindex="-1" data-linktype="self-bookmark">cURL</a>
</li>
</ul>
<section id="tabpanel_3_http" role="tabpanel" data-tab="http">

<pre><code class="lang-http">GET https://graph.microsoft.com/v1.0/me  HTTP/1.1
Authorization: Bearer eyJ0eXAiO ... 0X2tnSQLEANnSPHY0gKcgw
Host: graph.microsoft.com
</code></pre>
</section>
<section id="tabpanel_3_curl" role="tabpanel" data-tab="curl" aria-hidden="true" hidden="hidden">

<pre><code class="lang-bash">curl --location --request GET 'https://graph.microsoft.com/v1.0/me' \
--header 'Authorization: Bearer eyJ0eXAiO ... 0X2tnSQLEANnSPHY0gKcgw' \
--data ''
</code></pre>
</section>
</div>
<h3 id="response">Response</h3>
<p>A successful response looks similar to the following example (some response headers are removed).</p>
<pre><code>HTTP/1.1 200 OK
Content-Type: application/json;odata.metadata=minimal;odata.streaming=true;IEEE754Compatible=false;charset=utf-8
request-id: f45d08c0-6901-473a-90f5-7867287de97f
client-request-id: f45d08c0-6901-473a-90f5-7867287de97f
OData-Version: 4.0
Duration: 727.0022
Date: Thu, 20 Apr 2017 05:21:18 GMT
Content-Length: 407

{
    "@odata.context": "https://graph.microsoft.com/v1.0/$metadata#users/$entity",
    "businessPhones": [
        "425-555-0100"
    ],
    "displayName": "MOD Administrator",
    "givenName": "MOD",
    "jobTitle": null,
    "mail": "admin@contoso.com",
    "mobilePhone": "425-555-0101",
    "officeLocation": null,
    "preferredLanguage": "en-US",
    "surname": "Administrator",
    "userPrincipalName": "admin@contoso.com",
    "id": "10a08e2e-3ea2-4ce0-80cb-d5fdd4b05ea6"
}
</code></pre>
<h2 id="step-4-use-the-refresh-token-to-renew-an-expired-access-token">Step 4: Use the refresh token to renew an expired access token</h2>
<p>Access tokens are short lived, and the app must refresh them after they expire to continue accessing resources. The app refreshes an access token by submitting another <code>POST</code> request to the <code>/token</code> endpoint, this time:</p>
<ul>
<li>Providing the <code>refresh_token</code> instead of the <strong>code</strong> in the request body</li>
<li>Specifying <code>refresh_token</code> as the <strong>grant_type</strong>, instead of <code>authorization_code</code>.</li>
</ul>
<h3 id="request-1">Request</h3>
<div class="tabGroup" id="tabgroup_4">
<ul role="tablist">
<li role="presentation">
<a href="#tabpanel_4_http" role="tab" aria-controls="tabpanel_4_http" data-tab="http" tabindex="0" aria-selected="true" data-linktype="self-bookmark">HTTP</a>
</li>
<li role="presentation">
<a href="#tabpanel_4_curl" role="tab" aria-controls="tabpanel_4_curl" data-tab="curl" tabindex="-1" data-linktype="self-bookmark">cURL</a>
</li>
</ul>
<section id="tabpanel_4_http" role="tabpanel" data-tab="http">

<pre><code>// Line breaks for legibility only

POST /{tenant}/oauth2/v2.0/token HTTP/1.1
Host: https://login.microsoftonline.com
Content-Type: application/x-www-form-urlencoded

client_id=11111111-1111-1111-1111-111111111111
&amp;scope=user.read%20mail.read
&amp;refresh_token=OAAABAAAAiL9Kn2Z27UubvWFPbm0gLWQJVzCTE9UkP3pSx1aXxUjq...
&amp;grant_type=refresh_token
&amp;client_secret=jXoM3iz...      // NOTE: Only required for web apps
</code></pre>
</section>
<section id="tabpanel_4_curl" role="tabpanel" data-tab="curl" aria-hidden="true" hidden="hidden">

<pre><code class="lang-bash">curl --location --request POST 'https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token' \
--header 'Content-Type: application/x-www-form-urlencoded' \
--data-urlencode 'client_id=11111111-1111-1111-1111-111111111111' \
--data-urlencode 'scope=User.Read Mail.Read' \
--data-urlencode 'refresh_token=OAAABAAAAiL9Kn2Z27UubvWFPbm0gLWQJVzCTE9UkP3pSx1aXxUjq...' \
--data-urlencode 'grant_type=refresh_token' \
--data-urlencode 'client_secret=jXoM3iz...'
</code></pre>
</section>
</div>
<h5 id="parameters-2">Parameters</h5>
<table>
<thead>
<tr>
<th>Parameter</th>
<th>Required</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr>
<td>tenant</td>
<td>Required</td>
<td>Use the <code>{tenant}</code> value in the path of the request to control who can sign into the application. The allowed values are: <br><li><code>common</code> for both Microsoft accounts and work or school accounts </li><li><code>organizations</code> for work or school accounts only </li><li><code>consumers</code> for Microsoft accounts only </li><li>tenant identifiers such as the tenant ID or domain name. <br>For more information, see <a href="/en-us/azure/active-directory/develop/active-directory-v2-protocols#endpoints" data-linktype="absolute-path">protocol basics</a>.</li></td>
</tr>
<tr>
<td>client_id</td>
<td>Required</td>
<td>The Application (client) ID that the <a href="https://go.microsoft.com/fwlink/?linkid=2083908" data-linktype="external">registration portal</a> assigned your app. Also referred to as <strong>appId</strong> in the Microsoft Graph application and service principal object.</td>
</tr>
<tr>
<td>grant_type</td>
<td>Required</td>
<td>Must be <code>refresh_token</code>.</td>
</tr>
<tr>
<td>scope</td>
<td>Optional</td>
<td>A space-separated list of permissions (scopes). The permissions that your app requests must be equivalent to or a subset of the permissions that it requested in the original authorization code request in Step 2.</td>
</tr>
<tr>
<td>refresh_token</td>
<td>Required</td>
<td>The refresh_token that your app acquired during the token request in Step 3.</td>
</tr>
<tr>
<td>client_secret</td>
<td>Required for web apps</td>
<td>The client secret that you created in the app registration portal for your app. Don't use the secret in a native app, because client_secrets can't be reliably stored on devices. It's required for web apps and web APIs, which have the ability to store the client_secret securely on the server side.</td>
</tr>
</tbody>
</table>
<h3 id="response-1">Response</h3>
<p>A successful token response looks similar to the following.</p>
<pre><code class="lang-json">HTTP/1.1 200 OK
Content-type: application/json

{
    "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsIng1dCI6Ik5HVEZ2ZEstZnl0aEV1Q...",
    "token_type": "Bearer",
    "expires_in": 3599,
    "scope": "Mail.Read User.Read",
    "refresh_token": "AwABAAAAvPM1KaPlrEqdFSBzjqfTGAMxZGUTdM0t4B4...",
}
</code></pre>
<h5 id="response-body-parameters">Response body parameters</h5>
<table>
<thead>
<tr>
<th>Parameter</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr>
<td>access_token</td>
<td>The requested access token. The app can use this token in calls to Microsoft Graph.</td>
</tr>
<tr>
<td>token_type</td>
<td>Indicates the token type value. The only type that Microsoft Entra ID supports is <code>Bearer</code>.</td>
</tr>
<tr>
<td>expires_in</td>
<td>How long the access token is valid (in seconds).</td>
</tr>
<tr>
<td>scope</td>
<td>The permissions (scopes) that the access_token is valid for.</td>
</tr>
<tr>
<td>refresh_token</td>
<td>A new OAuth 2.0 refresh token. Replace the old refresh token with this newly acquired refresh token to ensure your refresh tokens remain valid for as long as possible.</td>
</tr>
</tbody>
</table>
<h2 id="use-the-microsoft-authentication-library-msal">Use the Microsoft Authentication Library (MSAL)</h2>
<p>In this article, you saw the low-level protocol details that are required only when manually crafting and issuing raw HTTP requests to execute the authorization code flow. In production apps, use a <a href="/en-us/azure/active-directory/develop/msal-overview" data-linktype="absolute-path">Microsoft-built or supported authentication library</a>, such as the Microsoft Authentication Library (MSAL), to get security tokens and call protected web APIs such as Microsoft Graph. Also, explore how to <a href="sdks/choose-authentication-providers" data-linktype="relative-path">choose a Microsoft Graph authentication provider based on scenario</a>.</p>
<p>MSAL and other supported authentication libraries simplify the process for you by handling details such as validation, cookie handling, token caching, and secure connections, so you can focus on the functionality of your application.</p>
<p>Microsoft has built and maintains a wide selection of code samples that demonstrate usage of supported authentication libraries with the Microsoft identity platform. To access these code samples, see the <a href="/en-us/entra/identity-platform/sample-v2-code?tabs=apptype#service--daemon" data-linktype="absolute-path">Microsoft identity platform code samples</a>.</p>
<h2 id="related-content">Related content</h2>
<ul>
<li>Explore <a href="/en-us/graph/tutorials" data-linktype="absolute-path">Microsoft Graph tutorials</a> for code samples that are built using different SDKs to create basic applications that authenticate and access data in delegated scenarios.</li>
<li>Choose from code samples that are built using different SDKs and maintained by Microsoft to run custom apps that use supported authentication libraries, sign-in users, and call Microsoft Graph. See <a href="/en-us/graph/tutorials" data-linktype="absolute-path">Microsoft Graph tutorials</a>.</li>
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
		datetime="2025-08-29T23:05:00.000Z"
		data-article-date-source="calculated"
		class="is-invisible"
	>
		2025-08-29
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