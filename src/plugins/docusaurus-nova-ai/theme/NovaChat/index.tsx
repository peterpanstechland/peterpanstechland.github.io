/**
 * Nova Chat Component
 * 
 * AI 聊天组件 - 基于 AWS Nova 模型
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import styles from './styles.module.css';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface NovaChatConfig {
  apiEndpoint?: string;
  welcomeMessage?: string;
  placeholder?: string;
  position?: 'bottom-right' | 'bottom-left';
}

// 从页面配置读取
function getConfig(): NovaChatConfig {
  if (typeof document === 'undefined') return {};
  
  // 尝试从 Docusaurus 配置读取
  try {
    // @ts-ignore
    const siteConfig = window.__DOCUSAURUS__?.siteConfig;
    if (siteConfig?.customFields?.novaChat) {
      return siteConfig.customFields.novaChat;
    }
  } catch {}
  
  // 备用：从 script 标签读取
  const configEl = document.getElementById('nova-chat-config');
  if (configEl) {
    try {
      return JSON.parse(configEl.textContent || '{}');
    } catch {
      return {};
    }
  }
  return {};
}

// 模拟 Nova API 调用 (实际使用时替换为真实 API)
async function callNovaAPI(message: string, apiEndpoint: string): Promise<string> {
  // 演示模式 - 模拟回复
  // 实际部署时，这里调用你的 AWS Lambda + API Gateway
  const demoResponses: Record<string, string> = {
    'hello': '你好！我是基于 AWS Nova 模型的 AI 助手。我可以帮你解答关于这个文档站点的问题。',
    'help': '我可以帮助你：\n- 🔍 搜索文档内容\n- 📖 解释技术概念\n- 💡 提供代码示例\n- 🛠️ 解决常见问题',
    'aws': 'AWS (Amazon Web Services) 是全球领先的云服务平台。这个站点包含很多关于 AWS 服务的教程，包括 EC2、S3、Lambda、Bedrock 等。',
    'nova': 'Amazon Nova 是 AWS 最新推出的多模态基础模型系列，通过 Amazon Bedrock 提供。它支持文本、图像和视频理解，具有出色的性价比。',
    'bedrock': 'Amazon Bedrock 是一项完全托管的服务，提供多种基础模型的 API 访问，包括 Claude、Nova、Llama 等。你可以用它来构建生成式 AI 应用。',
    'esp32': 'ESP32 是一款低成本、低功耗的 Wi-Fi + 蓝牙 SoC，非常适合 IoT 项目。这个站点有很多关于 ESP32 与 AWS IoT 集成的教程。',
  };

  // 模拟网络延迟
  await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 400));

  // 检查关键词匹配
  const lowerMessage = message.toLowerCase();
  for (const [keyword, response] of Object.entries(demoResponses)) {
    if (lowerMessage.includes(keyword)) {
      return response;
    }
  }

  // 默认回复
  return `感谢你的提问！这是一个演示版本。\n\n在实际部署中，这里会调用 AWS Nova 模型来智能回答你的问题："${message}"\n\n你可以尝试问一些关于 **AWS**、**Bedrock**、**Nova**、**ESP32** 的问题。`;
}

const config = getConfig();

export default function NovaChat(): React.JSX.Element | null {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const prevFocusRef = useRef<HTMLElement | null>(null);

  const {
    apiEndpoint = '/api/nova-chat',
    welcomeMessage = '👋 你好！我是 Nova AI 助手，有什么可以帮助你的吗？',
    placeholder = '输入你的问题...',
    position = 'bottom-right',
  } = config;

  // 初始化欢迎消息
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          content: welcomeMessage,
          timestamp: new Date(),
        },
      ]);
    }
  }, [welcomeMessage]);

  // 自动滚动到最新消息
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 自动调整输入框高度
  useEffect(() => {
    const textarea = inputRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [input]);

  // 聚焦管理
  useEffect(() => {
    if (isOpen) {
      // 打开时存储焦点（避免存储自身 Input）
      if (document.activeElement instanceof HTMLElement && document.activeElement !== inputRef.current) {
        prevFocusRef.current = document.activeElement;
      }
      inputRef.current?.focus();
    } else {
      // 关闭时恢复焦点
      prevFocusRef.current?.focus();
    }
  }, [isOpen]);

  // ESC 关闭
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await callNovaAPI(userMessage.content, apiEndpoint);
      
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response,
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: '抱歉，发生了错误。请稍后重试。',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, apiEndpoint]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 只在客户端渲染
  if (typeof window === 'undefined') {
    return null;
  }

  return (
    <div className={styles.container} data-position={position}>
      {/* 聊天窗口 */}
      {isOpen && (
        <div className={styles.chatWindow}>
          {/* 头部 */}
          <div className={styles.header}>
            <div className={styles.headerInfo}>
              <span className={styles.headerIcon}>⚡</span>
              <span className={styles.headerTitle}>Nova AI 助手</span>
              <span className={styles.statusDot} />
            </div>
            <button 
              className={styles.closeButton} 
              onClick={() => setIsOpen(false)}
              aria-label="关闭聊天"
            >
              ✕
            </button>
          </div>

          {/* 消息列表 */}
          <div
            className={styles.messages}
            role="log"
            aria-live="polite"
            aria-atomic="false"
          >
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`${styles.message} ${styles[msg.role]}`}
              >
                {msg.role === 'assistant' && (
                  <span
                    className={styles.avatar}
                    role="img"
                    aria-label="AI Avatar"
                  >
                    🤖
                  </span>
                )}
                <div className={styles.messageContent}>
                  {msg.content.split('\n').map((line, i) => (
                    <p key={i}>{line || <br />}</p>
                  ))}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className={`${styles.message} ${styles.assistant}`}>
                <span
                  className={styles.avatar}
                  role="img"
                  aria-label="AI Avatar"
                >
                  🤖
                </span>
                <div className={styles.messageContent}>
                  <div
                    className={styles.typingIndicator}
                    role="status"
                    aria-label="Nova AI is typing"
                  >
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* 输入区域 */}
          <div className={styles.inputArea}>
            <textarea
              ref={inputRef}
              className={styles.input}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              rows={1}
              disabled={isLoading}
              aria-label="输入消息"
            />
            <button
              className={styles.sendButton}
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              aria-label="发送消息"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </div>

          {/* 底部标识 */}
          <div className={styles.footer}>
            Powered by <span className={styles.footerBrand}>AWS Nova</span>
          </div>
        </div>
      )}

      {/* 浮动按钮 */}
      <button
        className={`${styles.fab} ${isOpen ? styles.fabOpen : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? '关闭聊天' : '打开 AI 助手'}
      >
        {isOpen ? (
          <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="currentColor" width="28" height="28">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z" />
            <circle cx="12" cy="10" r="1.5" />
            <circle cx="8" cy="10" r="1.5" />
            <circle cx="16" cy="10" r="1.5" />
          </svg>
        )}
      </button>
    </div>
  );
}
