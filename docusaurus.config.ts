import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: "Peter Pan's Techland",
  tagline: 'AI × Edge × AWS - Building the future, one project at a time.',
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

  // 启用 Mermaid 图表支持
  markdown: {
    mermaid: true,
  },
  themes: ['@docusaurus/theme-mermaid'],

  // Nova AI 聊天助手插件
  clientModules: [
    require.resolve('./src/plugins/docusaurus-nova-ai/client.tsx'),
  ],

  // Nova AI 配置 (可选)
  customFields: {
    novaChat: {
      // API 端点 - 部署 Lambda 后替换为真实 URL
      apiEndpoint: 'https://your-api-gateway-url.amazonaws.com/api/nova-chat',
      // 欢迎消息
      welcomeMessage: '👋 你好！我是 Nova AI 助手，有什么可以帮助你的吗？',
      // 输入框占位符
      placeholder: '输入你的问题...',
      // 按钮位置: 'bottom-right' 或 'bottom-left'
      position: 'bottom-right',
    },
  },

  // Internationalization configuration
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'zh-Hans'],
    localeConfigs: {
      en: {
        label: 'EN',
        htmlLang: 'en-US',
      },
      'zh-Hans': {
        label: '中文',
        htmlLang: 'zh-Hans',
      },
    },
  },

  plugins: ['docusaurus-plugin-image-zoom'],

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
        // Hackathons
        {
          type: 'doc',
          docId: 'hackathons/index',
          position: 'left',
          label: 'Hackathons',
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
        // Right side items
        {
          href: 'https://github.com/peterpanstechland',
          label: 'GitHub',
          position: 'right',
        },
        // Language switcher
        {
          type: 'localeDropdown',
          position: 'right',
        },
      ],
    },
    
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
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
              label: 'AWS Builder Community',
              href: 'https://community.aws/',
            },
            {
              label: 'GitHub',
              href: 'https://github.com/peterpanstechland',
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
      additionalLanguages: ['bash', 'json', 'python', 'yaml'],
    },
    
    // Mermaid 图表主题配置
    mermaid: {
      theme: { light: 'neutral', dark: 'dark' },
    },

    zoom: {
      selector: '.markdown img',
      background: {
        light: 'rgba(255, 255, 255, 0.9)',
        dark: 'rgba(0, 0, 0, 0.9)',
      },
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
