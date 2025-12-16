import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: "Peter Pan's Techland",
  tagline: 'AI × Edge × AWS — Building intelligent systems from cloud to device',
  favicon: 'img/favicon.ico',

  // Set the production url of your site here
  url: 'https://peterpanstechland.github.io',
  // Set the /<baseUrl>/ pathname under which your site is served
  baseUrl: '/',

  // GitHub pages deployment config.
  organizationName: 'peterpanstechland',
  projectName: 'peterpanstechland.github.io',

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  // Internationalization configuration
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'zh-Hans'],
    localeConfigs: {
      en: {
        htmlLang: 'en-US',
        label: 'English',
      },
      'zh-Hans': {
        htmlLang: 'zh-Hans',
        label: '简体中文',
      },
    },
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl:
            'https://github.com/peterpanstechland/peterpanstechland.github.io/edit/main/',
        },
        blog: {
          showReadingTime: true,
          editUrl:
            'https://github.com/peterpanstechland/peterpanstechland.github.io/edit/main/',
          blogSidebarTitle: 'All posts',
          blogSidebarCount: 'ALL',
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    // Social card image
    image: 'img/docusaurus-social-card.jpg',
    navbar: {
      title: "Peter Pan's Techland",
      logo: {
        alt: 'Site Logo',
        src: 'img/logo.svg',
      },
      items: [
        // Start Here
        {
          type: 'doc',
          docId: 'start-here/intro',
          position: 'left',
          label: 'Start Here',
        },
        // Projects
        {
          type: 'doc',
          docId: 'projects/index',
          position: 'left',
          label: 'Projects',
        },
        // Guides
        {
          type: 'doc',
          docId: 'guides/index',
          position: 'left',
          label: 'Guides',
        },
        // Workshops
        {
          type: 'doc',
          docId: 'workshops/index',
          position: 'left',
          label: 'Workshops',
        },
        // Community
        {
          type: 'doc',
          docId: 'community/index',
          position: 'left',
          label: 'Community',
        },
        // Blog
        {
          to: '/blog',
          label: 'Blog',
          position: 'left',
        },
        // About
        {
          type: 'doc',
          docId: 'about/index',
          position: 'left',
          label: 'About',
        },
        // Language Switcher
        {
          type: 'localeDropdown',
          position: 'right',
        },
        // GitHub
        {
          href: 'https://github.com/peterpanstechland',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Explore',
          items: [
            {
              label: 'Start Here',
              to: '/docs/start-here/intro',
            },
            {
              label: 'Projects',
              to: '/docs/projects',
            },
            {
              label: 'Guides',
              to: '/docs/guides',
            },
          ],
        },
        {
          title: 'Community',
          items: [
            {
              label: 'GitHub',
              href: 'https://github.com/peterpanstechland',
            },
            {
              label: 'Twitter',
              href: 'https://twitter.com/peterpantech',
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
              label: 'About',
              to: '/docs/about',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Peter Pan's Techland. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'json', 'python', 'yaml', 'cpp', 'arduino'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
