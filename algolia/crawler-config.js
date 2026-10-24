/*
 * Algolia Crawler configuration for the Kahuna documentation site.
 *
 * This file is a checked-in copy for review and version history. The live
 * configuration is edited in the Algolia dashboard:
 *   Data Sources -> Crawler -> kahuna-docs -> Editor.
 *
 * Paste the object below over the config in the editor, but keep the
 * dashboard's own `appId` line. The default config that the onboarding flow
 * generates emits generic page records ({ url, title, description, headers,
 * content }); Docusaurus search needs DocSearch records
 * ({ hierarchy.lvl0..lvl6, content, anchor, type }).
 *
 * The dashboard keeps the crawler API key out of the editor. That key is
 * write-capable - never put it in this repository.
 *
 * `initialIndexSettings` below applies only when the crawler creates the
 * index. To change the settings of the existing index, edit
 * algolia/index-settings.json (keep it in sync with the block below) and run
 * algolia/apply-index-settings.mjs.
 *
 * Selectors are grounded in the generated HTML: the page title is
 * `<article><header><h1>`, and body copy lives in `article .markdown`. Content
 * stays inside `.markdown` so breadcrumbs and blog tags do not become records,
 * and `li[role=tab]` skips the client tab labels (C#, TypeScript, CLI).
 *
 * `aggregateContent` is false because each record stores its text twice
 * (`content` and `content_camel`). A merged section of about 4.5KB, such as
 * "Durable Commit Decisions" in the distributed transactions page, exceeds
 * the 10KB record limit and the crawler drops the whole page. One record per
 * paragraph or list item stays small, and `distinct` on `url` still returns
 * one hit per section.
 *
 * The domain also hosts the Kommander docs under /kommander.github.io/. That
 * site has its own crawler and index, so this crawler excludes it.
 */

new Crawler({
  appId: "SPBBUBI3JT",
  indexPrefix: "",
  rateLimit: 8,
  maxUrls: 500,
  schedule: "every 1 day at 3:00 am",
  startUrls: ["https://kahunakv.github.io/"],
  sitemaps: ["https://kahunakv.github.io/sitemap.xml"],
  discoveryPatterns: ["https://kahunakv.github.io/**"],
  exclusionPatterns: [
    "https://kahunakv.github.io/kommander.github.io/**",
    "https://kahunakv.github.io/blog/",
    "https://kahunakv.github.io/blog/page/**",
    "https://kahunakv.github.io/blog/tags/**",
    "https://kahunakv.github.io/blog/archive/**",
    "https://kahunakv.github.io/blog/authors/**",
    "https://kahunakv.github.io/book/**",
    "https://kahunakv.github.io/paper/**",
    "https://kahunakv.github.io/playground-engine/**",
    "https://kahunakv.github.io/search/**",
  ],
  saveBackup: false,
  ignoreQueryParams: ["source", "utm_*"],
  ignoreCanonicalTo: true,
  actions: [
    {
      indexName: "kahuna_docs",
      pathsToMatch: ["https://kahunakv.github.io/docs/**"],
      recordExtractor: ({ $, helpers }) => {
        return helpers.docsearch({
          recordProps: {
            lvl0: {
              selectors: "",
              defaultValue: "Documentation",
            },
            lvl1: "header h1",
            lvl2: "article h2",
            lvl3: "article h3",
            lvl4: "article h4",
            lvl5: "article h5, article .markdown td:first-child",
            lvl6: "article h6",
            content:
              "article .markdown p, article .markdown li:not([role=tab]), article .markdown td:last-child",
          },
          aggregateContent: false,
          recordVersion: "v3",
        });
      },
    },
    {
      indexName: "kahuna_docs",
      pathsToMatch: ["https://kahunakv.github.io/blog/**"],
      recordExtractor: ({ $, helpers }) => {
        return helpers.docsearch({
          recordProps: {
            lvl0: {
              selectors: "",
              defaultValue: "Blog",
            },
            lvl1: "header h1",
            lvl2: "article h2",
            lvl3: "article h3",
            lvl4: "article h4",
            lvl5: "article h5, article .markdown td:first-child",
            lvl6: "article h6",
            content:
              "article .markdown p, article .markdown li:not([role=tab]), article .markdown td:last-child",
          },
          aggregateContent: false,
          recordVersion: "v3",
        });
      },
    },
  ],
  initialIndexSettings: {
    kahuna_docs: {
      attributesForFaceting: ["type", "lang", "language", "version", "docusaurus_tag"],
      attributesToRetrieve: [
        "hierarchy",
        "content",
        "anchor",
        "url",
        "url_without_anchor",
        "type",
      ],
      attributesToHighlight: ["hierarchy", "content"],
      attributesToSnippet: ["content:10"],
      camelCaseAttributes: ["hierarchy", "content"],
      searchableAttributes: [
        "unordered(hierarchy.lvl0)",
        "unordered(hierarchy.lvl1)",
        "unordered(hierarchy.lvl2)",
        "unordered(hierarchy.lvl3)",
        "unordered(hierarchy.lvl4)",
        "unordered(hierarchy.lvl5)",
        "unordered(hierarchy.lvl6)",
        "content",
      ],
      distinct: true,
      attributeForDistinct: "url",
      customRanking: [
        "desc(weight.pageRank)",
        "desc(weight.level)",
        "asc(weight.position)",
      ],
      ranking: [
        "words",
        "filters",
        "typo",
        "attribute",
        "proximity",
        "exact",
        "custom",
      ],
      highlightPreTag: '<span class="algolia-docsearch-suggestion--highlight">',
      highlightPostTag: "</span>",
      minWordSizefor1Typo: 3,
      minWordSizefor2Typos: 7,
      allowTyposOnNumericTokens: false,
      minProximity: 1,
      ignorePlurals: true,
      advancedSyntax: true,
      attributeCriteriaComputedByMinProximity: true,
      removeWordsIfNoResults: "allOptional",
      separatorsToIndex: "_",
    },
  },
});
