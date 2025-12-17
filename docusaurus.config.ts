import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'AutoGen Guide',
  tagline: 'Building Production-Ready Multi-Agent AI Systems',
  favicon: 'img/favicon.ico',

  future: {
    v4: true,
  },

  // GitHub Pages 배포 설정
  url: 'https://mypalesong.github.io',
  baseUrl: '/autogen/',

  organizationName: 'mypalesong',
  projectName: 'autogen',
  deploymentBranch: 'guide-pages',
  trailingSlash: false,

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  markdown: {
    format: 'detect',
    mermaid: true,
  },

  themes: ['@docusaurus/theme-mermaid'],

  i18n: {
    defaultLocale: 'ko',
    locales: ['ko', 'en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/mypalesong/autogen/tree/guide/',
        },
        blog: {
          showReadingTime: true,
          feedOptions: {
            type: ['rss', 'atom'],
            xslt: true,
          },
          editUrl: 'https://github.com/mypalesong/autogen/tree/guide/',
          onInlineTags: 'warn',
          onInlineAuthors: 'warn',
          onUntruncatedBlogPosts: 'warn',
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/autogen-social-card.png',
    colorMode: {
      defaultMode: 'dark',
      disableSwitch: false,
      respectPrefersColorScheme: false,
    },
    navbar: {
      title: 'AutoGen Guide',
      logo: {
        alt: 'AutoGen Logo',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'tutorialSidebar',
          position: 'left',
          label: 'Documentation',
        },
        {to: '/blog', label: 'Blog', position: 'left'},
        {
          href: 'https://github.com/microsoft/autogen',
          label: 'AutoGen GitHub',
          position: 'right',
        },
        {
          href: 'https://github.com/mypalesong/autogen',
          label: 'This Guide',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Documentation',
          items: [
            {
              label: 'Getting Started',
              to: '/docs/intro',
            },
            {
              label: 'Core Concepts',
              to: '/docs/category/core-concepts',
            },
            {
              label: 'Production Patterns',
              to: '/docs/category/production-patterns',
            },
          ],
        },
        {
          title: 'Resources',
          items: [
            {
              label: 'Microsoft AutoGen',
              href: 'https://microsoft.github.io/autogen/',
            },
            {
              label: 'AutoGen GitHub',
              href: 'https://github.com/microsoft/autogen',
            },
            {
              label: 'Discord Community',
              href: 'https://discord.gg/pAbnFJrkgZ',
            },
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
              label: 'This Guide Source',
              href: 'https://github.com/mypalesong/autogen',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} AutoGen Guide. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.vsDark,
      additionalLanguages: ['python', 'bash', 'json', 'yaml'],
    },
    mermaid: {
      theme: {light: 'neutral', dark: 'dark'},
    },
    algolia: undefined,
  } satisfies Preset.ThemeConfig,
};

export default config;
