/**
 * Docusaurus Nova AI Plugin
 * 
 * 基于 AWS Nova 模型的 AI 聊天助手插件
 * 为文档站点提供智能问答功能
 */

import type { Plugin, LoadContext } from '@docusaurus/types';
import path from 'path';

export interface NovaChatOptions {
  /** API 端点 URL */
  apiEndpoint?: string;
  /** 欢迎消息 */
  welcomeMessage?: string;
  /** 占位符文本 */
  placeholder?: string;
  /** 按钮位置 */
  position?: 'bottom-right' | 'bottom-left';
  /** 主题颜色 (使用 CSS 变量) */
  themeColor?: string;
}

const DEFAULT_OPTIONS: NovaChatOptions = {
  apiEndpoint: '/api/nova-chat',
  welcomeMessage: '👋 你好！我是 Nova AI 助手，有什么可以帮助你的吗？',
  placeholder: '输入你的问题...',
  position: 'bottom-right',
  themeColor: 'var(--ifm-color-primary)',
};

export default function pluginNovaAI(
  context: LoadContext,
  options: NovaChatOptions
): Plugin {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };

  return {
    name: 'docusaurus-nova-ai',

    getThemePath() {
      return path.resolve(__dirname, './theme');
    },

    getClientModules() {
      return [path.resolve(__dirname, './theme/NovaChat')];
    },

    injectHtmlTags() {
      return {
        headTags: [
          {
            tagName: 'script',
            attributes: {
              type: 'application/json',
              id: 'nova-chat-config',
            },
            innerHTML: JSON.stringify(mergedOptions),
          },
        ],
      };
    },

    async contentLoaded({ actions }) {
      const { setGlobalData } = actions;
      setGlobalData({
        options: mergedOptions,
      });
    },
  };
}

export { default as NovaChat } from './theme/NovaChat';

