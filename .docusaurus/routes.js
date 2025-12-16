import React from 'react';
import ComponentCreator from '@docusaurus/ComponentCreator';

export default [
  {
    path: '/__docusaurus/debug',
    component: ComponentCreator('/__docusaurus/debug', '5ff'),
    exact: true
  },
  {
    path: '/__docusaurus/debug/config',
    component: ComponentCreator('/__docusaurus/debug/config', '5ba'),
    exact: true
  },
  {
    path: '/__docusaurus/debug/content',
    component: ComponentCreator('/__docusaurus/debug/content', 'a2b'),
    exact: true
  },
  {
    path: '/__docusaurus/debug/globalData',
    component: ComponentCreator('/__docusaurus/debug/globalData', 'c3c'),
    exact: true
  },
  {
    path: '/__docusaurus/debug/metadata',
    component: ComponentCreator('/__docusaurus/debug/metadata', '156'),
    exact: true
  },
  {
    path: '/__docusaurus/debug/registry',
    component: ComponentCreator('/__docusaurus/debug/registry', '88c'),
    exact: true
  },
  {
    path: '/__docusaurus/debug/routes',
    component: ComponentCreator('/__docusaurus/debug/routes', '000'),
    exact: true
  },
  {
    path: '/blog',
    component: ComponentCreator('/blog', 'df4'),
    exact: true
  },
  {
    path: '/blog/archive',
    component: ComponentCreator('/blog/archive', '182'),
    exact: true
  },
  {
    path: '/blog/authors',
    component: ComponentCreator('/blog/authors', '0b7'),
    exact: true
  },
  {
    path: '/blog/tags',
    component: ComponentCreator('/blog/tags', '287'),
    exact: true
  },
  {
    path: '/blog/tags/announcement',
    component: ComponentCreator('/blog/tags/announcement', '4fa'),
    exact: true
  },
  {
    path: '/blog/welcome',
    component: ComponentCreator('/blog/welcome', 'bbd'),
    exact: true
  },
  {
    path: '/markdown-page',
    component: ComponentCreator('/markdown-page', '3d7'),
    exact: true
  },
  {
    path: '/docs',
    component: ComponentCreator('/docs', 'fbc'),
    routes: [
      {
        path: '/docs',
        component: ComponentCreator('/docs', '08a'),
        routes: [
          {
            path: '/docs/tags',
            component: ComponentCreator('/docs/tags', 'fce'),
            exact: true
          },
          {
            path: '/docs/tags/ai',
            component: ComponentCreator('/docs/tags/ai', 'bd3'),
            exact: true
          },
          {
            path: '/docs/tags/aws',
            component: ComponentCreator('/docs/tags/aws', 'e55'),
            exact: true
          },
          {
            path: '/docs/tags/bedrock',
            component: ComponentCreator('/docs/tags/bedrock', '37f'),
            exact: true
          },
          {
            path: '/docs/tags/beginner',
            component: ComponentCreator('/docs/tags/beginner', 'b06'),
            exact: true
          },
          {
            path: '/docs/tags/cloud',
            component: ComponentCreator('/docs/tags/cloud', 'ed2'),
            exact: true
          },
          {
            path: '/docs/tags/esp-32',
            component: ComponentCreator('/docs/tags/esp-32', '856'),
            exact: true
          },
          {
            path: '/docs/tags/hardware',
            component: ComponentCreator('/docs/tags/hardware', 'e1d'),
            exact: true
          },
          {
            path: '/docs/tags/iot',
            component: ComponentCreator('/docs/tags/iot', '19b'),
            exact: true
          },
          {
            path: '/docs',
            component: ComponentCreator('/docs', '28e'),
            routes: [
              {
                path: '/docs/about',
                component: ComponentCreator('/docs/about', 'c2e'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/community',
                component: ComponentCreator('/docs/community', '3a7'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/guides',
                component: ComponentCreator('/docs/guides', '1cb'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/guides/ai/bedrock-intro',
                component: ComponentCreator('/docs/guides/ai/bedrock-intro', '4fb'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/guides/ai/nova-chat-deployment',
                component: ComponentCreator('/docs/guides/ai/nova-chat-deployment', '0c8'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/guides/aws/getting-started',
                component: ComponentCreator('/docs/guides/aws/getting-started', '21e'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/guides/edge/esp32-intro',
                component: ComponentCreator('/docs/guides/edge/esp32-intro', 'f7b'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/projects',
                component: ComponentCreator('/docs/projects', '3f4'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/start-here/intro',
                component: ComponentCreator('/docs/start-here/intro', '36e'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/start-here/now',
                component: ComponentCreator('/docs/start-here/now', 'e50'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/workshops',
                component: ComponentCreator('/docs/workshops', 'f5c'),
                exact: true,
                sidebar: "docsSidebar"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    path: '/',
    component: ComponentCreator('/', 'e5f'),
    exact: true
  },
  {
    path: '*',
    component: ComponentCreator('*'),
  },
];
