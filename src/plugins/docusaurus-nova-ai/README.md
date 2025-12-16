# Docusaurus Nova AI Plugin

基于 AWS Nova 模型的 Docusaurus AI 聊天助手插件。

## ✨ 功能特性

- 🤖 浮动 AI 聊天按钮
- 💬 流畅的聊天界面
- 🌙 自动适配暗黑/亮色主题
- 📱 响应式设计，支持移动端
- ⚡ 基于 AWS Nova 模型（通过 Bedrock）

## 📦 安装

插件已内置在项目中，无需额外安装。

## 🔧 配置

### 1. 前端配置

在 `docusaurus.config.ts` 中添加客户端模块：

```typescript
const config = {
  clientModules: [
    require.resolve('./src/plugins/docusaurus-nova-ai/client.tsx'),
  ],
  // ... 其他配置
};
```

### 2. 后端部署（生产环境）

#### 方式 A：AWS Lambda + API Gateway

1. 创建 Lambda 函数：
   - Runtime: Python 3.12
   - Handler: index.lambda_handler
   - 代码：使用 `lambda-example/index.py`

2. 配置 IAM 角色权限：
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:Converse"
      ],
      "Resource": "arn:aws:bedrock:*::foundation-model/*"
    }
  ]
}
```

3. 创建 API Gateway HTTP API：
   - 方法：POST
   - 路由：/api/nova-chat
   - 集成：Lambda 函数

4. 配置 CORS：
   - Allow Origin: 你的域名
   - Allow Methods: POST, OPTIONS
   - Allow Headers: Content-Type

#### 方式 B：Amplify / App Runner

也可以使用 AWS Amplify 或 App Runner 部署更完整的后端服务。

### 3. 前端连接后端

修改 `theme/NovaChat/index.tsx` 中的 `callNovaAPI` 函数：

```typescript
async function callNovaAPI(message: string, apiEndpoint: string): Promise<string> {
  const response = await fetch(apiEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });
  
  const data = await response.json();
  return data.message;
}
```

## 🎨 自定义样式

聊天组件使用 CSS 变量，自动继承主题颜色：

- `--ifm-color-primary`: 主色调
- `--accent`: 强调色
- `--ifm-background-surface-color`: 背景色
- `--border-color`: 边框颜色

可以在 `theme/NovaChat/styles.module.css` 中自定义更多样式。

## 📝 使用的 Nova 模型

推荐使用的 Nova 模型：

| 模型 | 模型 ID | 特点 |
|------|---------|------|
| Nova Micro | `amazon.nova-micro-v1:0` | 最快、最便宜，适合简单对话 |
| Nova Lite | `amazon.nova-lite-v1:0` | 平衡速度和质量 |
| Nova Pro | `amazon.nova-pro-v1:0` | 最强大，适合复杂任务 |

## 💰 成本估算

以 Nova Micro 为例：
- 输入：$0.035 / 1M tokens
- 输出：$0.14 / 1M tokens

一次典型对话（~500 tokens）成本约 $0.00007

## 🔒 安全建议

1. **永远不要在前端暴露 AWS 凭证**
2. 使用 API Gateway 配合 Lambda 作为中间层
3. 配置适当的 CORS 策略
4. 考虑添加速率限制
5. 使用 WAF 防护 API

## 📄 License

MIT License

