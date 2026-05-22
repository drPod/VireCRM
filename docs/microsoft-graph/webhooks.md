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
			<title>Set up notifications for changes in resource data - Microsoft Graph | Microsoft Learn</title>
			<meta charset="utf-8" />
			<meta name="viewport" content="width=device-width, initial-scale=1.0" />
			<meta name="color-scheme" content="light dark" />

			<meta name="description" content="Change notifications enable applications to receive alerts when a Microsoft Graph resource they&#39;re interested changes." />
			<link rel="canonical" href="https://learn.microsoft.com/en-us/graph/change-notifications-overview" /> 

			<!-- Non-customizable open graph and sharing-related metadata -->
			<meta name="twitter:card" content="summary_large_image" />
			<meta name="twitter:site" content="@MicrosoftLearn" />
			<meta property="og:type" content="website" />
			<meta property="og:image:alt" content="Microsoft Learn" />
			<meta property="og:image" content="https://learn.microsoft.com/en-us/media/open-graph-image.png" />
			<!-- Page specific open graph and sharing-related metadata -->
			<meta property="og:title" content="Set up notifications for changes in resource data - Microsoft Graph" />
			<meta property="og:url" content="https://learn.microsoft.com/en-us/graph/change-notifications-overview" />
			<meta property="og:description" content="Change notifications enable applications to receive alerts when a Microsoft Graph resource they&#39;re interested changes." />
			<meta name="platform_id" content="59281a4c-969d-669f-19ed-87e652940e87" /> <meta name="scope" content="graph" />
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
	
		<meta name="ms.subservice" content="change-notifications" />
	
		<meta name="toc_preview" content="true" />
	
		<meta name="recommendations" content="false" />
	
		<meta name="ms.service" content="microsoft-graph" />
	
		<meta name="ms.topic" content="concept-article" />
	
		<meta name="ms.reviewer" content="jessieli-ad" />
	
		<meta name="ms.localizationpriority" content="high" />
	
		<meta name="ms.custom" content="graphiamtop20" />
	
		<meta name="ms.date" content="2024-12-27T00:00:00Z" />
	
		<meta name="document_id" content="c7400cec-8c7f-a3f5-1125-d4a850b2041b" />
	
		<meta name="document_version_independent_id" content="c7400cec-8c7f-a3f5-1125-d4a850b2041b" />
	
		<meta name="updated_at" content="2026-04-07T22:18:00Z" />
	
		<meta name="original_content_git_url" content="https://github.com/microsoftgraph/microsoft-graph-docs/blob/live/concepts/change-notifications-overview.md" />
	
		<meta name="gitcommit" content="https://github.com/microsoftgraph/microsoft-graph-docs/blob/21697e2b8a5734da63402b5298de0ee1d7230641/concepts/change-notifications-overview.md" />
	
		<meta name="git_commit_id" content="21697e2b8a5734da63402b5298de0ee1d7230641" />
	
		<meta name="site_name" content="Docs" />
	
		<meta name="depot_name" content="MSDN.microsoft-graph-docs" />
	
		<meta name="schema" content="Conceptual" />
	
		<meta name="toc_rel" content="toc.json" />
	
		<meta name="feedback_help_link_type" content="" />
	
		<meta name="feedback_help_link_url" content="" />
	
		<meta name="word_count" content="2706" />
	
		<meta name="asset_id" content="change-notifications-overview" />
	
		<meta name="moniker_range_name" content="" />
	
		<meta name="item_type" content="Content" />
	
		<meta name="source_path" content="concepts/change-notifications-overview.md" />
	
		<meta name="previous_tlsh_hash" content="6AAAF08273139650EAB3AA057837EAE066E1568E7CBCAE8401FE01D7A3497D232EAA7D5B77C37E81232181C7137B0F9BD28A323BD5FAF153126557EB4154204B2CC877F609" />
	
		<meta name="github_feedback_content_git_url" content="https://github.com/microsoftgraph/microsoft-graph-docs-contrib/blob/main/concepts/change-notifications-overview.md" />
	
		<meta name="markdown_url" content="https://learn.microsoft.com/en-us/graph/change-notifications-overview?accept=text/markdown" />
	 
		<meta name="cmProducts" content="https://authoring-docs-microsoft.poolparty.biz/devrel/63959238-cb90-4871-a33d-4a5519097e47" data-source="generated" />
	
		<meta name="cmProducts" content="https://authoring-docs-microsoft.poolparty.biz/devrel/5fc61396-d075-4560-aece-fdbda73d243f" data-source="generated" />
	
		<meta name="spProducts" content="https://authoring-docs-microsoft.poolparty.biz/devrel/78d87f42-5582-4a6b-90be-7db2f12b34e6" data-source="generated" />
	
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
        "name": "Lauragra",
        "url": "https://github.com/Lauragra"
      },
      {
        "name": "jasonjoh",
        "url": "https://github.com/jasonjoh"
      },
      {
        "name": "JarbasHorst",
        "url": "https://github.com/JarbasHorst"
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
			
			href="https://github.com/microsoftgraph/microsoft-graph-docs-contrib/blob/main/concepts/change-notifications-overview.md"
			data-original_content_git_url="https://github.com/microsoftgraph/microsoft-graph-docs/blob/live/concepts/change-notifications-overview.md"
			data-original_content_git_url_template="{repo}/blob/{branch}/concepts/change-notifications-overview.md"
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
	
					<div class="content"><h1 id="set-up-notifications-for-changes-in-resource-data">Set up notifications for changes in resource data</h1></div>
					
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
	
					<div class="content"><p>Change notifications enable applications to receive alerts when a Microsoft Graph resource they're interested in changes; that is, created, updated, or deleted. Microsoft Graph sends notifications to the specified client endpoint, and the client service processes the notifications according to the business requirements. For example, the service might fetch more data, update its cache and views, and so on.</p>
<div class="IMPORTANT">
<p>Important</p>
<p>The change notifications feature isn't supported in Microsoft Entra External ID in external tenants and Azure AD B2C tenants.</p>
</div>
<h2 id="why-get-change-notifications">Why get change notifications?</h2>
<p>Change notifications follow an event-driven model where customers receive alerts when changes occur instead of them polling Microsoft Graph. Depending on your business logic, change notifications are suitable when:</p>
<ul>
<li>You're subscribing to a resource that changes frequently.</li>
<li>You need to react to changes in near real-time.</li>
<li>You want to avoid frequently polling Microsoft Graph which might cause you to hit the throttling limits.</li>
</ul>
<p>The following image shows how change notifications works and compares with <a href="delta-query-overview" data-linktype="relative-path">change tracking</a>.</p>
<p><span class="mx-imgBorder">
<img src="images/change-notifications/change-notifications-vs-delta-query.png" alt="Illustration of change notifications and delta query services" data-linktype="relative-path">
</span>
</p>
<p>The following video provides an overview of change notifications in Microsoft Graph.</p>
<div class="embeddedvideo"><iframe src="https://www.youtube-nocookie.com/embed/rC1bunenaq4" frameborder="0" allowfullscreen="true" data-linktype="external"></iframe></div>
<h2 id="types-of-change-notifications">Types of change notifications</h2>
<p>Microsoft Graph supports three types of change notifications:</p>
<ul>
<li><strong>Basic notifications</strong>: Change notifications that don't contain resource data other than the <strong>id</strong> of the resource that changed. When an app receives a basic notification, the service can use the <strong>id</strong> to query the changed object.</li>
<li><strong>Rich notifications</strong>: Change notifications that include the resource data of the object that changed. For more information about rich notifications, see <a href="change-notifications-with-resource-data" data-linktype="relative-path">Rich notifications</a>.</li>
<li><strong>Lifecycle notifications</strong>: Notifications that alert the customer when they are at risk of missing change notifications due to the lifecycle of their subscription. For more information about lifecycle notifications, see <a href="change-notifications-lifecycle-events" data-linktype="relative-path">Lifecycle notifications</a>.</li>
</ul>
<h2 id="receiving-change-notifications">Receiving change notifications</h2>
<p>Microsoft Graph can deliver change notifications to clients via the following channels.</p>
<ul>
<li><strong>Webhooks</strong>. For more information, see <a href="change-notifications-delivery-webhooks" data-linktype="relative-path">Receive change notifications through webhooks</a>.</li>
<li><strong>Azure Event Hubs</strong>. For more information, see <a href="change-notifications-delivery-event-hubs" data-linktype="relative-path">Receive change notifications through Azure Event Hubs</a>.</li>
<li><strong>Azure Event Grid</strong>. For more information, see <a href="/en-us/azure/event-grid/subscribe-to-graph-api-events?context=graph%2Fcontext" data-linktype="absolute-path">Receive change notifications through Azure Event Grid</a>.</li>
</ul>
<h2 id="managing-subscriptions">Managing subscriptions</h2>
<p>Clients can create subscriptions, renew subscriptions, and delete subscriptions. While the subscription is active and when changes occur in the subscribed resource, Microsoft Graph sends change notifications to the specified notification endpoint.</p>
<p>You manage the subscription using the <a href="/en-us/graph/api/resources/subscription" data-linktype="absolute-path">subscription resource type</a> and its related methods. Microsoft Graph sends change notifications in a structure defined in the <a href="/en-us/graph/api/resources/changenotificationcollection" data-linktype="absolute-path">changeNotificationCollection resource type</a>.</p>
<h2 id="supported-resources">Supported resources</h2>
<!-- markdownlint-disable MD041-->
<p>An app can subscribe to changes on the Microsoft Graph resources listed in the table. Subscriptions to resources marked with an asterisk (<code>*</code>) are only available on the <code>/beta</code> endpoint.</p>
<div class="NOTE">
<p>Note</p>
<p>For Microsoft Teams resources, the <strong>per-organization limit of 10,000 total subscriptions</strong> is shared cumulatively across <strong>all Teams change notification subscriptions</strong> in the tenant. It includes subscriptions created for different Teams resources—such as chats, chat messages, call transcripts, call recordings, channels, teams, and conversation members—which <strong>all count toward the same organizational quota</strong>. When the combined number of active Teams subscriptions reaches this limit, <strong>any additional subscription creation request for a Teams resource fails</strong> with a <code>403 Forbidden</code> error.</p>
</div>
<div class="mx-tableFixed">
<table>
<thead>
<tr>
<th>Resource</th>
<th>Supported resource paths</th>
<th>Limitations</th>
</tr>
</thead>
<tbody>
<tr>
<td>Cloud printing <a href="/en-us/graph/api/resources/printer" data-linktype="absolute-path">printer</a></td>
<td>Changes when a print job is ready to be downloaded (jobFetchable event): <code>/print/printers/{id}/jobs</code></td>
<td>-</td>
</tr>
<tr>
<td>Cloud printing <a href="/en-us/graph/api/resources/printtaskdefinition" data-linktype="absolute-path">printTaskDefinition</a></td>
<td>Changes when there's a valid job in the queue (jobStarted event): <code>/print/printtaskdefinition/{id}/tasks</code></td>
<td>-</td>
</tr>
<tr>
<td>Copilot <a href="/en-us/microsoft-365/copilot/extensibility/api/ai-services/meeting-insights/resources/callaiinsight" data-linktype="absolute-path">aiInsights</a></td>
<td>Copilot AI insights from meetings that a particular user is part of: <code>/copilot/users/{userId}/onlineMeetings/getAllAiInsights</code> <br><br> Copilot AI insights for a particular meeting: <code>/copilot/users/{userId}/onlineMeetings/{onlineMeetingId}/aiInsights</code></td>
<td>Maximum subscription quotas for AI insights across all meetings for a user: <ul><li>Per app and user combination: 1</li><li>Per user (delegated): 10</li><li>Per organization: 10,000 total subscriptions.</li></ul><br><br>Maximum subscription quotas for AI insights of a specific meeting: <ul><li>Per app and user + meeting combination: 1</li><li>Per user and meeting combination (delegated): 1</li><li>Per organization: 10,000 total subscriptions (shared)</li></ul></td>
</tr>
<tr>
<td>Copilot <a href="/en-us/graph/api/resources/aiinteraction" data-linktype="absolute-path">aiInteraction</a></td>
<td>Copilot AI interactions that a particular user is part of: <code>copilot/users/{userId}/interactionHistory/getAllEnterpriseInteractions</code> <br><br> Copilot AI interactions in an organization: <code>copilot/interactionHistory/getAllEnterpriseInteractions</code></td>
<td>Maximum subscription quotas: <ul><li> Per app and tenant combination (for subscriptions tracking AI interactions across a tenant): 1</li> <li> Per app and user combination (for subscriptions tracking AI interactions a particular user is part of): 1</li> <li> Per user (for subscriptions tracking AI interactions a particular user is part of): 10 subscriptions.</li> <li> Per organization: 10,000 total subscriptions.</li></ul></td>
</tr>
<tr>
<td><a href="/en-us/graph/api/resources/driveitem" data-linktype="absolute-path">driveItem</a> on OneDrive (personal)</td>
<td>Changes to content within the hierarchy of <em>any folder</em>: <code>/users/{id}/drive/root</code></td>
<td>-</td>
</tr>
<tr>
<td><a href="/en-us/graph/api/resources/driveitem" data-linktype="absolute-path">driveItem</a> on OneDrive for work or school</td>
<td>Changes to content within the hierarchy of the <em>root folder</em>: <code>/drives/{id}/root</code> , <code>/users/{id}/drive/root</code></td>
<td>-</td>
</tr>
<tr>
<td><a href="/en-us/graph/api/resources/group" data-linktype="absolute-path">group</a></td>
<td>Changes to all groups: <code>/groups</code>  <br><br> Changes to a specific group: <code>/groups/{id}</code> <br><br> Changes to owners of a specific group:  <code>/groups/{id}/owners</code> <br><br> Changes to members of a specific group: <code>/groups/{id}/members</code></td>
<td>Maximum subscription quotas: <ul><li> Per app (for all tenants combined): 50,000 total subscriptions.</li> <li> Per tenant (for all applications combined): 1,000 total subscriptions across all apps.</li> <li> Per app and tenant combination: 100 total subscriptions.</li></ul><br><br>Not supported for Azure AD B2C tenants.<br><br><strong>NOTE:</strong> Creation and soft-deletion of groups also trigger the <code>updated</code> <strong>changeType</strong>.</td>
</tr>
<tr>
<td>Microsoft Entra Health Monitoring <a href="/en-us/graph/api/resources/healthmonitoring-alert" data-linktype="absolute-path">alert</a></td>
<td>Changes to all health monitoring alerts: <code>/reports/healthmonitoring/alerts</code> <br><br> Changes to a specific type of alert: <code>/reports/healthmonitoring/alert</code> with the <code>notificationQueryOptions</code> property in request payload set as <code>$filter=alertType eq '{alertType}'</code></td>
<td>-</td>
</tr>
<tr>
<td><a href="/en-us/graph/api/resources/list" data-linktype="absolute-path">list</a> under a SharePoint <a href="/en-us/graph/api/resources/site" data-linktype="absolute-path">site</a></td>
<td>Changes to content within the <em>list</em>:  <code>/sites/{site-id}/lists/{list-id}</code></td>
<td>-</td>
</tr>
<tr>
<td>Microsoft 365 group <a href="/en-us/graph/api/resources/conversation" data-linktype="absolute-path">conversation</a></td>
<td>Changes to a group's conversations: <code>groups/{id}/conversations</code></td>
<td>-</td>
</tr>
<tr>
<td>Outlook <a href="/en-us/graph/api/resources/message" data-linktype="absolute-path">message</a></td>
<td>Changes to all messages in a user's mailbox: <code>/users/{id}/messages</code> , <code>/me/messages</code> <br><br> Changes to messages in a user's Inbox: <code>/users/{id}/mailFolders('inbox')/messages</code> , <code>/me/mailFolders('inbox')/messages</code></td>
<td>A maximum of 1,000 active subscriptions per mailbox for all applications is allowed.</td>
</tr>
<tr>
<td>Outlook <a href="/en-us/graph/api/resources/event" data-linktype="absolute-path">event</a></td>
<td>Changes to all events in a user's mailbox: <code>/users/{id}/events</code> , <code>/me/events</code></td>
<td>A maximum of 1,000 active subscriptions per mailbox for all applications is allowed.</td>
</tr>
<tr>
<td>Outlook personal <a href="/en-us/graph/api/resources/contact" data-linktype="absolute-path">contact</a></td>
<td>Changes to all personal contacts in a user's mailbox: <code>/users/{id}/contacts</code> , <code>/me/contacts</code></td>
<td>A maximum of 1,000 active subscriptions per mailbox for all applications is allowed.</td>
</tr>
<tr>
<td>Security <a href="/en-us/graph/api/resources/alert" data-linktype="absolute-path">alert</a></td>
<td>Changes to a specific alert: <code>/security/alerts/{id}</code> <br><br>Changes to filtered alerts: <code>/security/alerts/?$filter={parameters}</code></td>
<td>For more information, see <a href="/en-us/graph/api/resources/security-api-overview?view=graph-rest-beta#alerts&amp;preserve-view=true" data-linktype="absolute-path">Security API alerts</a>.</td>
</tr>
<tr>
<td>Teams <a href="/en-us/graph/api/resources/approvalItem" data-linktype="absolute-path">approvals</a></td>
<td>Changes to all approvals in a tenant: <code>/solutions/approval/approvalItems</code></td>
<td>Maximum subscription quotas: <ul><li> Per tenant (for all applications combined): 1000 total subscriptions across all apps</li> <li> Per app and tenant combination: 1 subscription.</li></ul></td>
</tr>
<tr>
<td>Teams <a href="/en-us/graph/api/resources/callrecords-callrecord" data-linktype="absolute-path">callRecord</a></td>
<td>Changes to all call records: <code>/communications/callRecords</code> <br><br> Changes to filtered call records: <code>/communications/callRecords?$filter={parameters}</code></td>
<td>For more information, see <a href="/en-us/graph/changenotifications-for-callrecords" data-linktype="absolute-path">Change notifications for Call Records</a>. <br><br> Maximum subscription quotas: <ul><li> Per organization: 100 total subscriptions.</li></ul><br><br><strong>NOTE:</strong> Creation of call records also triggers the <code>updated</code> <strong>changeType</strong>.</td>
</tr>
<tr>
<td>Teams <a href="/en-us/graph/api/resources/callrecording" data-linktype="absolute-path">callRecording</a></td>
<td>All recordings in an organization: <code>communications/onlineMeetings/getAllRecordings</code> <br><br> All recordings for a specific meeting: <code>communications/onlineMeetings/{onlineMeetingId}/recordings</code> <br><br> A call recording that becomes available in a meeting organized by a specific user: <code>users/{id}/onlineMeetings/getAllRecordings</code> <br><br> A call recording that becomes available in a meeting where a particular Teams app is installed: <code>appCatalogs/teamsApps/{id}/installedToOnlineMeetings/getAllRecordings</code> *</td>
<td>Maximum subscription quotas: <ul><li> Per app and online-meeting combination: 1</li> <li> Per app and user combination: 1</li> <li> Per user (for subscriptions tracking recordings in all onlineMeetings organized by the user): 10 subscriptions.</li> <li> Per organization: 10,000 total subscriptions.</li></ul></td>
</tr>
<tr>
<td>Teams <a href="/en-us/graph/api/resources/calltranscript" data-linktype="absolute-path">callTranscript</a></td>
<td>All transcripts in an organization: <code>communications/onlineMeetings/getAllTranscripts</code> <br><br> All transcripts for a specific meeting: <code>communications/onlineMeetings/{onlineMeetingId}/transcripts</code> <br><br> A call transcript that becomes available in a meeting organized by a specific user: <code>users/{id}/onlineMeetings/getAllTranscripts</code> <br><br> A call transcript that becomes available in a meeting where a particular Teams app is installed: <code>appCatalogs/teamsApps/{id}/installedToOnlineMeetings/getAllTrancripts</code> *</td>
<td>Maximum subscription quotas: <ul><li> Per app and online-meeting combination: 1</li> <li> Per app and user combination: 1</li> <li> Per user (for subscriptions tracking transcripts in all onlineMeetings organized by the user): 10 subscriptions.</li> <li> Per organization: 10,000 total subscriptions.</li></ul></td>
</tr>
<tr>
<td>Teams <a href="/en-us/graph/api/resources/chat" data-linktype="absolute-path">chat</a></td>
<td>Changes to any chat in the tenant: <code>/chats</code>  <br><br> Changes to a specific chat: <code>/chats/{id}</code> <br><br> Changes to a specific chat with the <a href="/en-us/graph/teams-changenotifications-chat#notification-payloads-for-user-specific-properties" data-linktype="absolute-path">notifyOnUserSpecificProperties</a> query parameter: <code>/chats/{id}?notifyOnUserSpecificProperties={Boolean}</code> <br><br> Changes to all chats in an organization where a particular Teams app is installed: <code>/appCatalogs/teamsApps/{id}/installedToChats</code> <br><br> Changes to all chats that a particular user is part of: <code>/users/{id}/chats</code> <br><br> Changes to all chats that a particular user is part of with the <a href="/en-us/graph/teams-changenotifications-chat#notification-payloads-for-user-specific-properties" data-linktype="absolute-path">notifyOnUserSpecificProperties</a> query parameter: <code>/users/{id}/chats?notifyOnUserSpecificProperties={Boolean}</code></td>
<td>Maximum subscription quotas: <ul><li> Per app and chat combination: 1 subscription.</li> <li> Per organization: 10,000 total subscriptions.</li> <li> Per user (for subscriptions tracking all chats that a particular user is part of): 10 subscriptions.</li></ul></td>
</tr>
<tr>
<td>Teams <a href="/en-us/graph/api/resources/chatmessage" data-linktype="absolute-path">chatMessage</a></td>
<td>Changes to chat messages in all channels in all teams: <code>/teams/getAllMessages</code> <br><br> Changes to chat messages in a specific channel: <code>/teams/{id}/channels/{id}/messages</code> <br><br> Changes to chat messages in all chats: <code>/chats/getAllMessages</code>  <br><br> Changes to chat messages in a specific chat: <code>/chats/{id}/messages</code> <br><br> Changes to chat messages in all chats a particular user is part of: <code>/users/{id}/chats/getAllMessages</code> <br><br> Changes to chat messages for all chats in an organization where a particular Teams app is installed: <code>/appCatalogs/teamsApps/{id}/installedToChats/getAllMessages</code></td>
<td>Maximum subscription quotas: <ul><li> Per app and channel or chat combination: 1 subscription.</li> <li> Per user (for subscriptions tracking chat messages in all chats the user is part of): 10 subscriptions.</li> <li> Per organization: 10,000 total subscriptions.</li></ul></td>
</tr>
<tr>
<td>Teams <a href="/en-us/graph/api/resources/channel" data-linktype="absolute-path">channel</a></td>
<td>Changes to channels in all teams: <code>/teams/getAllChannels</code> <br><br> Changes to channel in a specific team: <code>/teams/{id}/channels</code></td>
<td>Maximum subscription quotas: <ul><li> Per app and team combination: 1 subscription.</li> <li> Per organization: 10,000 total subscriptions.</li></ul></td>
</tr>
<tr>
<td>Teams <a href="/en-us/graph/api/resources/conversationmember" data-linktype="absolute-path">conversationMember</a></td>
<td>Changes to membership in a specific team: <code>/teams/{id}/members</code> <br><br> Changes to membership in all channels under a specific team: <code>teams/{id}/channels/getAllMembers</code> <br><br> Changes to membership in a specific chat: <code>/chats/{id}/members</code>  <br><br> Changes to membership for all chats in an organization where a particular Teams app is installed: <code>/appCatalogs/teamsApps/{id}/installedToChats/getAllMembers</code> <br><br> Changes to membership in all chats: <code>/chats/getAllMembers</code></td>
<td>Maximum subscription quotas: <ul><li> Per app and team combination: 1 subscription.</li> <li> Per organization: 10,000 total subscriptions.</li></ul></td>
</tr>
<tr>
<td>Teams <a href="/en-us/graph/api/resources/onlinemeeting" data-linktype="absolute-path">onlineMeeting</a> <sup>*<sup></sup></sup></td>
<td>Changes to an online meeting: <code>/communications/onlineMeetings(joinWebUrl='{encodedJoinWebUrl}')/meetingCallEvents</code></td>
<td>Doesn't support using <code>$select</code> to return only selected properties. The rich notification consists of all the properties of the changed instance. One subscription allowed per application per online meeting. For more information, see <a href="/en-us/graph/changenotifications-for-onlinemeeting" data-linktype="absolute-path">Get change notifications for Microsoft Teams meeting call event updates</a>.</td>
</tr>
<tr>
<td>Teams <a href="/en-us/graph/api/resources/presence" data-linktype="absolute-path">presence</a></td>
<td>Changes to a single user's presence:  <code>/communications/presences/{id}</code> <br><br> Changes to multiple users' presence:  <code>/communications/presences?$filter=id in ({id},{id}...)</code></td>
<td>The subscription for multiple users' presence is limited to 650 distinct users. Doesn't support using <code>$select</code> to return only selected properties. The rich notification consists of all the properties of the changed instance. One subscription allowed per application per delegated user. For more information, see <a href="/en-us/graph/changenotifications-for-presence" data-linktype="absolute-path">Get change notifications for presence updates in Microsoft Teams</a>.</td>
</tr>
<tr>
<td>Teams <a href="/en-us/graph/api/resources/team" data-linktype="absolute-path">team</a></td>
<td>Changes to any team in the tenant: <code>/teams</code> <br><br> Changes to a specific team: <code>/teams/{id}</code></td>
<td>Maximum subscription quotas: <ul><li> Per app and team combination: 1 subscription.</li> <li> Per organization: 10,000 total subscriptions.</li></ul></td>
</tr>
<tr>
<td>Teams Shifts <a href="/en-us/graph/api/resources/offershiftrequest" data-linktype="absolute-path">offerShiftRequest</a></td>
<td>Changes to any offer shift request in a team: <code>/teams/{id}/schedule/offerShiftRequests</code></td>
<td>Maximum subscription quotas: <ul><li> Per app and resource path combination: 1 subscription per tenant.</li> <li> Per resource path and user combination: 10 delegated user subscriptions per tenant.</li></ul></td>
</tr>
<tr>
<td>Teams Shifts <a href="/en-us/graph/api/resources/openshiftchangerequest" data-linktype="absolute-path">openShiftChangeRequest</a></td>
<td>Changes to any open shift request in a team: <code>/teams/{id}/schedule/openShiftChangeRequests</code></td>
<td>Maximum subscription quotas:<ul><li> Per app and resource path combination: 1 subscription per tenant.</li> <li> Per user and resource path combination: 10 subscriptions.</li> <li> Per organization: 10,000 total subscriptions.</li></ul></td>
</tr>
<tr>
<td>Teams Shifts <a href="/en-us/graph/api/resources/shift" data-linktype="absolute-path">shift</a></td>
<td>Changes to any shift in a team: <code>/teams/{id}/schedule/shifts</code></td>
<td>Maximum subscription quotas:<ul><li> Per app and resource path combination: 1 subscription per tenant.</li> <li> Per user and resource path combination: 10 subscriptions.</li> <li> Per organization: 10,000 total subscriptions.</li></ul></td>
</tr>
<tr>
<td>Teams Shifts <a href="/en-us/graph/api/resources/swapshiftschangerequest" data-linktype="absolute-path">swapShiftsChangeRequest</a></td>
<td>Changes to any swap shift request in a team: <code>/teams/{id}/schedule/swapShiftsChangeRequests</code></td>
<td>Maximum subscription quotas:<ul><li> Per app and resource path combination: 1 subscription per tenant.</li> <li> Per user and resource path combination: 10 subscriptions.</li> <li> Per organization: 10,000 total subscriptions.</li></ul></td>
</tr>
<tr>
<td>Teams Shifts <a href="/en-us/graph/api/resources/timeoffrequest" data-linktype="absolute-path">timeOffRequest</a></td>
<td>Changes to any time off request in a team: <code>/teams/{id}/schedule/timeOffRequests</code></td>
<td>Maximum subscription quotas:<ul><li> Per app and resource path combination: 1 subscription per tenant.</li> <li> Per user and resource path combination: 10 subscriptions.</li> <li> Per organization: 10,000 total subscriptions.</li></ul></td>
</tr>
<tr>
<td><a href="/en-us/graph/api/resources/todotask" data-linktype="absolute-path">todoTask</a></td>
<td>Changes to all task in a specific task list: <code>/me/todo/lists/{todoTaskListId}/tasks</code></td>
<td>-</td>
</tr>
<tr>
<td><a href="/en-us/graph/api/resources/user" data-linktype="absolute-path">user</a></td>
<td>Changes to all users: <code>/users</code> <br><br> Changes to a specific user: <code>/users/{id}</code></td>
<td>Maximum subscription quotas: <ul><li> Per app (for all tenants combined): 50,000 total subscriptions.</li> <li> Per tenant (for all applications combined): 1,000 total subscriptions across all apps</li> <li> Per app and tenant combination: 100 total subscriptions.</li></ul><br><br>Not supported for personal Microsoft accounts like outlook.com.<br><br>Not supported for Azure AD B2C tenants.<br><br><strong>NOTE:</strong> Creation and soft-deletion of users also trigger the <code>updated</code> <strong>changeType</strong>.</td>
</tr>
</tbody>
</table>
</div>
<div class="NOTE">
<p>Note</p>
<p>Many resources have limits or quotas on how many subscriptions can be made against that resource.  When exceeding that limit, attempts to create a subscription will result in a <code>403 Forbidden</code> error response. The <strong>message</strong> property of the error response will explain the limit that has been exceeded.</p>
</div>
<p>Some of these resources support rich notifications (notifications with resource data). For their details, see <a href="/en-us/graph/change-notifications-with-resource-data#supported-resources" data-linktype="absolute-path">Set up change notifications that include resource data</a>.</p>
<h2 id="subscription-lifetime">Subscription lifetime</h2>
<p>Subscriptions have a limited lifetime. Apps need to renew their subscriptions before the expiration time; Otherwise, they need to create a new subscription. Apps can also unsubscribe at any time to stop getting change notifications.</p>
<p>The following table shows the maximum expiration times for subscriptions per resource in Microsoft Graph.</p>
<!-- markdownlint-disable MD041-->
<!-- Maximum length of subscription per resource. This file is referenced in the change notifications overview and subscription resource type files. -->
<table>
<thead>
<tr>
<th style="text-align: left;">Resource</th>
<th style="text-align: left;">Maximum expiration time</th>
</tr>
</thead>
<tbody>
<tr>
<td style="text-align: left;">Copilot <a href="/en-us/graph/api/resources/aiinteraction" data-linktype="absolute-path">aiInteraction</a></td>
<td style="text-align: left;">4,320 minutes (three days)</td>
</tr>
<tr>
<td style="text-align: left;">Security <a href="/en-us/graph/api/resources/alert" data-linktype="absolute-path">alert</a></td>
<td style="text-align: left;">43,200 minutes (under 30 days)</td>
</tr>
<tr>
<td style="text-align: left;">Teams <a href="/en-us/graph/api/resources/approvalItem" data-linktype="absolute-path">approvals</a></td>
<td style="text-align: left;">43,200 minutes (under 30 days)</td>
</tr>
<tr>
<td style="text-align: left;">Teams <a href="/en-us/graph/api/resources/callrecords-callrecord" data-linktype="absolute-path">callRecord</a></td>
<td style="text-align: left;">4,230 minutes (under three days)</td>
</tr>
<tr>
<td style="text-align: left;">Teams <a href="/en-us/graph/api/resources/callrecording" data-linktype="absolute-path">callRecording</a></td>
<td style="text-align: left;">4,320 minutes (three days)</td>
</tr>
<tr>
<td style="text-align: left;">Teams <a href="/en-us/graph/api/resources/calltranscript" data-linktype="absolute-path">callTranscript</a></td>
<td style="text-align: left;">4,320 minutes (three days)</td>
</tr>
<tr>
<td style="text-align: left;">Teams <a href="/en-us/graph/api/resources/channel" data-linktype="absolute-path">channel</a></td>
<td style="text-align: left;">4,320 minutes (three days)</td>
</tr>
<tr>
<td style="text-align: left;">Teams <a href="/en-us/graph/api/resources/chat" data-linktype="absolute-path">chat</a></td>
<td style="text-align: left;">4,320 minutes (three days)</td>
</tr>
<tr>
<td style="text-align: left;">Teams <a href="/en-us/graph/api/resources/chatmessage" data-linktype="absolute-path">chatMessage</a></td>
<td style="text-align: left;">4,320 minutes (three days)</td>
</tr>
<tr>
<td style="text-align: left;">Teams <a href="/en-us/graph/api/resources/conversationmember" data-linktype="absolute-path">conversationMember</a></td>
<td style="text-align: left;">4,320 minutes (three days)</td>
</tr>
<tr>
<td style="text-align: left;">Teams <a href="/en-us/graph/api/resources/onlinemeeting" data-linktype="absolute-path">onlineMeeting</a></td>
<td style="text-align: left;">4,320 minutes (three days)</td>
</tr>
<tr>
<td style="text-align: left;">Teams <a href="/en-us/graph/api/resources/team" data-linktype="absolute-path">team</a></td>
<td style="text-align: left;">4,320 minutes (three days)</td>
</tr>
<tr>
<td style="text-align: left;">Teams <a href="/en-us/graph/api/resources/teamsappinstallation" data-linktype="absolute-path">teamsAppInstallation</a></td>
<td style="text-align: left;">4,320 minutes (3 days)</td>
</tr>
<tr>
<td style="text-align: left;">Teams Shifts <a href="/en-us/graph/api/resources/offershiftrequest" data-linktype="absolute-path">offerShiftRequest</a></td>
<td style="text-align: left;">360 minutes (6 hours)</td>
</tr>
<tr>
<td style="text-align: left;">Teams Shifts <a href="/en-us/graph/api/resources/openshiftchangerequest" data-linktype="absolute-path">openShiftChangeRequest</a></td>
<td style="text-align: left;">360 minutes (6 hours)</td>
</tr>
<tr>
<td style="text-align: left;">Teams Shifts <a href="/en-us/graph/api/resources/shift" data-linktype="absolute-path">shift</a></td>
<td style="text-align: left;">360 minutes (6 hours)</td>
</tr>
<tr>
<td style="text-align: left;">Teams Shifts <a href="/en-us/graph/api/resources/swapshiftschangerequest" data-linktype="absolute-path">swapShiftsChangeRequest</a></td>
<td style="text-align: left;">360 minutes (6 hours)</td>
</tr>
<tr>
<td style="text-align: left;">Teams Shifts <a href="/en-us/graph/api/resources/timeoffrequest" data-linktype="absolute-path">timeOffRequest</a></td>
<td style="text-align: left;">360 minutes (6 hours)</td>
</tr>
<tr>
<td style="text-align: left;">Group <a href="/en-us/graph/api/resources/conversation" data-linktype="absolute-path">conversation</a></td>
<td style="text-align: left;">4,230 minutes (under three days)</td>
</tr>
<tr>
<td style="text-align: left;">OneDrive <a href="/en-us/graph/api/resources/driveitem" data-linktype="absolute-path">driveItem</a></td>
<td style="text-align: left;">42,300 minutes (under 30 days)</td>
</tr>
<tr>
<td style="text-align: left;">SharePoint <a href="/en-us/graph/api/resources/list" data-linktype="absolute-path">list</a></td>
<td style="text-align: left;">42,300 minutes (under 30 days)</td>
</tr>
<tr>
<td style="text-align: left;">Outlook <a href="/en-us/graph/api/resources/message" data-linktype="absolute-path">message</a>, <a href="/en-us/graph/api/resources/event" data-linktype="absolute-path">event</a>, <a href="/en-us/graph/api/resources/contact" data-linktype="absolute-path">contact</a></td>
<td style="text-align: left;">10,080 minutes (under seven days) <br><br>For subscriptions with resource data (rich notification subscriptions), subscription lifetime is 1440 minutes (under one day).</td>
</tr>
<tr>
<td style="text-align: left;"><a href="/en-us/graph/api/resources/user" data-linktype="absolute-path">user</a>, <a href="/en-us/graph/api/resources/group" data-linktype="absolute-path">group</a>, other directory resources</td>
<td style="text-align: left;">41,760 minutes (under 29 days)</td>
</tr>
<tr>
<td style="text-align: left;"><a href="/en-us/graph/api/resources/onlinemeeting" data-linktype="absolute-path">onlineMeeting</a></td>
<td style="text-align: left;">4,230 minutes (under three days)</td>
</tr>
<tr>
<td style="text-align: left;"><a href="/en-us/graph/api/resources/presence" data-linktype="absolute-path">presence</a></td>
<td style="text-align: left;">60 minutes (1 hour)</td>
</tr>
<tr>
<td style="text-align: left;">Print <a href="/en-us/graph/api/resources/printer" data-linktype="absolute-path">printer</a></td>
<td style="text-align: left;">4,230 minutes (under three days)</td>
</tr>
<tr>
<td style="text-align: left;">Print <a href="/en-us/graph/api/resources/printtaskdefinition" data-linktype="absolute-path">printTaskDefinition</a></td>
<td style="text-align: left;">4,230 minutes (under three days)</td>
</tr>
<tr>
<td style="text-align: left;"><a href="/en-us/graph/api/resources/todotask" data-linktype="absolute-path">todoTask</a></td>
<td style="text-align: left;">4,230 minutes (under three days) <br><br>Webhooks for this resource are only available in the global endpoint and not in the national clouds.</td>
</tr>
<tr>
<td style="text-align: left;">Microsoft Entra Health Monitoring <a href="/en-us/graph/api/resources/healthmonitoring-alert" data-linktype="absolute-path">alert</a></td>
<td style="text-align: left;">42,300 minutes (under 30 days)</td>
</tr>
<tr>
<td style="text-align: left;"><strong>baseTask</strong> (deprecated)</td>
<td style="text-align: left;">4,230 minutes (under three days)</td>
</tr>
</tbody>
</table>
<blockquote>
<p><strong>Note:</strong> Existing applications and new applications should not exceed the supported value. In the future, any requests to create or renew a subscription beyond the maximum value will fail.</p>
</blockquote>
<h2 id="latency">Latency</h2>
<!-- markdownlint-disable MD041-->
<!-- This include file is referenced from the change notifications overview. -->
<p>The following table lists the latency to expect between an event happening in the service and the delivery of the change notification.</p>
<table>
<thead>
<tr>
<th style="text-align: left;">Resource</th>
<th style="text-align: left;">Average latency</th>
<th style="text-align: left;">Maximum latency</th>
</tr>
</thead>
<tbody>
<tr>
<td style="text-align: left;"><a href="/en-us/graph/api/resources/aiinteraction" data-linktype="absolute-path">aiInteraction</a></td>
<td style="text-align: left;">Less than 10 seconds</td>
<td style="text-align: left;">60 minutes</td>
</tr>
<tr>
<td style="text-align: left;"><a href="/en-us/graph/api/resources/alert" data-linktype="absolute-path">alert</a> <sup>1</sup></td>
<td style="text-align: left;">Less than 3 minutes</td>
<td style="text-align: left;">5 minutes</td>
</tr>
<tr>
<td style="text-align: left;"><a href="/en-us/graph/api/resources/approvalItem" data-linktype="absolute-path">approvals</a></td>
<td style="text-align: left;">Less than 10 seconds</td>
<td style="text-align: left;">40 seconds</td>
</tr>
<tr>
<td style="text-align: left;"><a href="/en-us/graph/api/resources/calendar" data-linktype="absolute-path">calendar</a></td>
<td style="text-align: left;">Less than 1 minute</td>
<td style="text-align: left;">3 minutes</td>
</tr>
<tr>
<td style="text-align: left;"><a href="/en-us/graph/api/resources/callrecords-callrecord" data-linktype="absolute-path">callRecord</a> <sup>2</sup></td>
<td style="text-align: left;">Less than 30 minutes</td>
<td style="text-align: left;">150 minutes</td>
</tr>
<tr>
<td style="text-align: left;"><a href="/en-us/graph/api/resources/callrecording" data-linktype="absolute-path">callRecording</a></td>
<td style="text-align: left;">Less than 10 seconds</td>
<td style="text-align: left;">60 minutes</td>
</tr>
<tr>
<td style="text-align: left;"><a href="/en-us/graph/api/resources/calltranscript" data-linktype="absolute-path">callTranscript</a></td>
<td style="text-align: left;">Less than 10 seconds</td>
<td style="text-align: left;">60 minutes</td>
</tr>
<tr>
<td style="text-align: left;"><a href="/en-us/graph/api/resources/channel" data-linktype="absolute-path">channel</a></td>
<td style="text-align: left;">Less than 10 seconds</td>
<td style="text-align: left;">60 minutes</td>
</tr>
<tr>
<td style="text-align: left;"><a href="/en-us/graph/api/resources/chat" data-linktype="absolute-path">chat</a></td>
<td style="text-align: left;">Less than 10 seconds</td>
<td style="text-align: left;">60 minutes</td>
</tr>
<tr>
<td style="text-align: left;"><a href="/en-us/graph/api/resources/chatmessage" data-linktype="absolute-path">chatMessage</a></td>
<td style="text-align: left;">Less than 10 seconds</td>
<td style="text-align: left;">1 minute</td>
</tr>
<tr>
<td style="text-align: left;"><a href="/en-us/graph/api/resources/contact" data-linktype="absolute-path">contact</a></td>
<td style="text-align: left;">Less than 1 minute</td>
<td style="text-align: left;">3 minutes</td>
</tr>
<tr>
<td style="text-align: left;"><a href="/en-us/graph/api/resources/conversation" data-linktype="absolute-path">conversation</a></td>
<td style="text-align: left;">Unknown</td>
<td style="text-align: left;">Unknown</td>
</tr>
<tr>
<td style="text-align: left;"><a href="/en-us/graph/api/resources/conversationmember" data-linktype="absolute-path">conversationMember</a></td>
<td style="text-align: left;">Less than 10 seconds</td>
<td style="text-align: left;">60 minutes</td>
</tr>
<tr>
<td style="text-align: left;"><a href="/en-us/graph/api/resources/driveitem" data-linktype="absolute-path">driveItem</a></td>
<td style="text-align: left;">Less than 1 minute</td>
<td style="text-align: left;">60 minutes</td>
</tr>
<tr>
<td style="text-align: left;"><a href="/en-us/graph/api/resources/event" data-linktype="absolute-path">event</a></td>
<td style="text-align: left;">Unknown</td>
<td style="text-align: left;">Unknown</td>
</tr>
<tr>
<td style="text-align: left;"><a href="/en-us/graph/api/resources/group" data-linktype="absolute-path">group</a></td>
<td style="text-align: left;">Unknown</td>
<td style="text-align: left;">Unknown</td>
</tr>
<tr>
<td style="text-align: left;"><a href="/en-us/graph/api/resources/healthmonitoring-alert" data-linktype="absolute-path">health monitoring alert</a></td>
<td style="text-align: left;">Unknown</td>
<td style="text-align: left;">Unknown</td>
</tr>
<tr>
<td style="text-align: left;"><a href="/en-us/graph/api/resources/list" data-linktype="absolute-path">list</a></td>
<td style="text-align: left;">Less than 1 minute</td>
<td style="text-align: left;">60 minutes</td>
</tr>
<tr>
<td style="text-align: left;"><a href="/en-us/graph/api/resources/message" data-linktype="absolute-path">message</a></td>
<td style="text-align: left;">Less than 1 minute</td>
<td style="text-align: left;">3 minutes</td>
</tr>
<tr>
<td style="text-align: left;"><a href="/en-us/graph/api/resources/offershiftrequest" data-linktype="absolute-path">offerShiftRequest</a></td>
<td style="text-align: left;">Less than 1 minute</td>
<td style="text-align: left;">60 minutes</td>
</tr>
<tr>
<td style="text-align: left;"><a href="/en-us/graph/api/resources/onlinemeeting" data-linktype="absolute-path">onlineMeeting</a></td>
<td style="text-align: left;">Less than 10 seconds</td>
<td style="text-align: left;">1 minute</td>
</tr>
<tr>
<td style="text-align: left;"><a href="/en-us/graph/api/resources/openshiftchangerequest" data-linktype="absolute-path">openShiftChangeRequest</a></td>
<td style="text-align: left;">Less than 1 minute</td>
<td style="text-align: left;">60 minutes</td>
</tr>
<tr>
<td style="text-align: left;"><a href="/en-us/graph/api/resources/presence" data-linktype="absolute-path">presence</a></td>
<td style="text-align: left;">Less than 10 seconds</td>
<td style="text-align: left;">1 minute</td>
</tr>
<tr>
<td style="text-align: left;"><a href="/en-us/graph/api/resources/printer" data-linktype="absolute-path">printer</a></td>
<td style="text-align: left;">Less than 1 minute</td>
<td style="text-align: left;">5 minutes</td>
</tr>
<tr>
<td style="text-align: left;"><a href="/en-us/graph/api/resources/printtaskdefinition" data-linktype="absolute-path">printTaskDefinition</a></td>
<td style="text-align: left;">Less than 1 minute</td>
<td style="text-align: left;">5 minutes</td>
</tr>
<tr>
<td style="text-align: left;"><a href="/en-us/graph/api/resources/shift" data-linktype="absolute-path">shift</a></td>
<td style="text-align: left;">Less than 1 minute</td>
<td style="text-align: left;">60 minutes</td>
</tr>
<tr>
<td style="text-align: left;"><a href="/en-us/graph/api/resources/swapshiftschangerequest" data-linktype="absolute-path">swapShiftsChangeRequest</a></td>
<td style="text-align: left;">Less than 1 minute</td>
<td style="text-align: left;">60 minutes</td>
</tr>
<tr>
<td style="text-align: left;"><a href="/en-us/graph/api/resources/team" data-linktype="absolute-path">team</a></td>
<td style="text-align: left;">Less than 10 seconds</td>
<td style="text-align: left;">60 minutes</td>
</tr>
<tr>
<td style="text-align: left;"><a href="/en-us/graph/api/resources/teamsappinstallation" data-linktype="absolute-path">teamsAppInstallation</a></td>
<td style="text-align: left;">Less than 10 seconds</td>
<td style="text-align: left;">60 minutes</td>
</tr>
<tr>
<td style="text-align: left;"><a href="/en-us/graph/api/resources/timeoffrequest" data-linktype="absolute-path">timeOffRequest</a></td>
<td style="text-align: left;">Less than 1 minute</td>
<td style="text-align: left;">60 minutes</td>
</tr>
<tr>
<td style="text-align: left;"><a href="/en-us/graph/api/resources/todotask" data-linktype="absolute-path">todoTask</a></td>
<td style="text-align: left;">Less than 2 minutes</td>
<td style="text-align: left;">15 minutes</td>
</tr>
<tr>
<td style="text-align: left;"><a href="/en-us/graph/api/resources/user" data-linktype="absolute-path">user</a></td>
<td style="text-align: left;">Unknown</td>
<td style="text-align: left;">Unknown</td>
</tr>
</tbody>
</table>
<p><sup>1</sup> The latency provided for the <strong>alert</strong> resource is only applicable after the alert is created. It doesn't include the time it takes for a rule to create an alert from the data.
<sup>2</sup> The latency provided for the <strong>callRecord</strong> resource is only applicable to the first version of a call record. Subsequent versions of a call record might be updated beyond the stated latencies.</p>
<h2 id="code-samples">Code samples</h2>
<p>The following code samples are available on GitHub.</p>
<ul>
<li><a href="https://github.com/microsoftgraph/msgraph-training-changenotifications" data-linktype="external">Microsoft Graph Training Module - Using Change Notifications and Track Changes with Microsoft Graph</a></li>
<li><a href="https://github.com/microsoftgraph/nodejs-webhooks-rest-sample" data-linktype="external">Microsoft Graph Webhooks Sample for Node.js</a></li>
<li><a href="https://github.com/microsoftgraph/aspnetcore-webhooks-sample" data-linktype="external">Microsoft Graph Webhooks Sample for ASP.NET Core</a></li>
<li><a href="https://github.com/microsoftgraph/java-spring-webhooks-sample" data-linktype="external">Microsoft Graph Webhooks Sample for Java Spring</a></li>
</ul>
<h2 id="related-content">Related content</h2>
<ul>
<li><a href="change-notifications-with-resource-data" data-linktype="relative-path">Rich notifications (notifications with resource data)</a></li>
<li><a href="change-notifications-lifecycle-events" data-linktype="relative-path">Lifecycle notifications</a></li>
<li><a href="universal-print-webhook-notifications" data-linktype="relative-path">Change notifications for cloud printing</a></li>
<li><a href="outlook-change-notifications-overview" data-linktype="relative-path">Change notifications for Outlook resources</a></li>
<li><a href="teams-change-notification-in-microsoft-teams-overview" data-linktype="relative-path">Change notifications for Microsoft Teams resources</a></li>
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
		datetime="2025-03-05T18:42:00.000Z"
		data-article-date-source="calculated"
		class="is-invisible"
	>
		2025-03-05
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