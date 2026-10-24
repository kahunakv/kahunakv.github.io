// @ts-check
// `@type` JSDoc annotations allow editor autocompletion and type checking
// (when paired with `@ts-check`).
// There are various equivalent ways to declare your Docusaurus config.
// See: https://docusaurus.io/docs/api/docusaurus-config

import {themes as prismThemes} from 'prism-react-renderer';

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Kahuna',
  tagline: 'Robust distributed locking and reliable key-value store',
  favicon: 'img/favicon.ico',

  // Set the production url of your site here
  url: 'https://kahunakv.github.io',
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: '/',
  trailingSlash: true,

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: 'kahunakv', // Usually your GitHub org/user name.
  projectName: 'kahunakv.github.io', // Usually your repo name.
  deploymentBranch: 'gh-pages',

  onBrokenLinks: 'throw',
  themes: ['@docusaurus/theme-mermaid'],
  markdown: {
    mermaid: true,
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  headTags: [
    {
      tagName: 'meta',
      attributes: {
        name: 'algolia-site-verification',
        content: 'CCAE52A1C7A7537A',
      },
    },
  ],

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: './sidebars.js',
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          editUrl:
            'https://github.com/kahunakv/kahunakv.github.io/tree/main/',
        },
        blog: {
          showReadingTime: true,
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          editUrl:
            'https://github.com/kahunakv.github.io/tree/tree/main/',
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      image: 'img/kahuna-social-card.png',
      // The crawler config lives in algolia/crawler-config.js.
      algolia: {
        appId: 'SPBBUBI3JT',
        // Search-only key. Safe to commit; never put the crawler key here.
        apiKey: '4bce7f90e4896c3f699731e08db06a09',
        indexName: 'kahuna_docs',
        // The site is single-locale and unversioned, and docs and blog share
        // one index, so contextual filtering by docusaurus_tag would only
        // ever exclude valid results.
        contextualSearch: false,
      },
      navbar: {
        title: 'Kahuna',
        logo: {
          alt: 'Kahuna Logo',
          src: 'img/logo.svg',
        },
        items: [
          {
            to: '/docs/why-kahuna',
            label: 'Why Kahuna?',
            position: 'left'
          },
          {
            type: 'docSidebar',
            sidebarId: 'tutorialSidebar',
            position: 'left',
            label: 'Tutorial',
          },
          {
            to: '/docs/getting-started',
            label: 'Documentation',
            position: 'left'
          },
          {
            to: '/playground',
            label: 'Playground',
            position: 'left'
          },
          {
            to: '/blog',
            label: 'Blog',
            position: 'left'
          },
          {
            href: 'https://github.com/kahunakv/kahuna',
            label: 'GitHub',
            position: 'right',
          }
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Docs',
            items: [
              {
                label: 'Tutorials',
                to: '/docs/intro',
              },
              {
                label: 'Architecture',
                to: '/docs/architecture/overview',
              },
              {
                label: 'Recipes',
                to: '/docs/recipes/rate-limiting',
              },
            ],
          },
          {
            title: 'Community',
            items: [
              {
                label: 'Github Discussions',
                href: 'https://github.com/kahunakv/kahuna/discussions',
              }
            ],
          },
          {
            title: 'More',
            items: [
              {
                label: 'Blog',
                to: '/blog',
              },
              {
                label: 'GitHub',
                href: 'https://github.com/kahunakv/kahuna',
              },
            ],
          },
        ],
        copyright: 'Copyright © 2024-2026 Kahuna.',
      },
      // Colors per color mode live in src/theme/Mermaid/index.js.
      mermaid: {
        theme: {light: 'base', dark: 'base'},
        options: {
          // Flat boxes without the drop shadows of Mermaid 12's default 'neo' look.
          look: 'classic',
          // Mermaid 12 wraps node labels at 120px; keep short labels on one line.
          flowchart: {padding: 16, wrappingWidth: 220},
          // Narrow, wrapped sequence diagrams keep their text legible when
          // scaled to the content column.
          sequence: {
            wrap: true,
            width: 130,
            actorMargin: 40,
            mirrorActors: false,
            actorFontSize: 15,
            messageFontSize: 15,
            noteFontSize: 14,
          },
        },
      },
      prism: {
        theme: prismThemes.github,
        darkTheme: prismThemes.dracula,
        additionalLanguages: ['csharp', 'bash'],
      },
    }),
};

export default config;
