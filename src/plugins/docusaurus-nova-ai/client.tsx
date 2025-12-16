/**
 * Nova Chat 客户端入口
 * 
 * 自动将聊天组件注入到页面中
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import NovaChat from './theme/NovaChat';

// 确保只在客户端运行
if (typeof window !== 'undefined') {
  // 等待 DOM 加载完成
  const initNovaChat = () => {
    // 创建容器
    const containerId = 'nova-chat-root';
    let container = document.getElementById(containerId);
    
    if (!container) {
      container = document.createElement('div');
      container.id = containerId;
      document.body.appendChild(container);
      
      // 渲染组件
      const root = createRoot(container);
      root.render(<NovaChat />);
    }
  };

  // 页面加载后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNovaChat);
  } else {
    initNovaChat();
  }
}

export default {};

