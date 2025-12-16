---
sidebar_position: 2
title: 部署 Nova AI 聊天插件
description: 详细步骤教你如何为 Docusaurus 站点部署 Nova AI 聊天助手
keywords: [aws, bedrock, nova, lambda, api-gateway, 聊天机器人, ai]
---

# 部署 Nova AI 聊天插件

本指南将带你完成 Nova AI 聊天助手插件的部署。该插件使用 Amazon Bedrock 的 Nova 模型为你的 Docusaurus 文档站点添加 AI 驱动的聊天机器人。

## 概览

Nova AI 聊天插件由两部分组成：

1. **前端组件**：嵌入在 Docusaurus 站点中的 React 聊天组件
2. **后端 API**：调用 Amazon Bedrock Nova 模型的 AWS Lambda 函数

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   Docusaurus    │ ---> │   API Gateway   │ ---> │     Lambda      │
│     (前端)       │      │   (HTTP API)    │      │   (Bedrock)     │
└─────────────────┘      └─────────────────┘      └─────────────────┘
```

## 前置条件

- 拥有 Bedrock 访问权限的 AWS 账户
- 已配置 AWS CLI
- 了解 Lambda 和 API Gateway 基础知识

## 步骤 1：启用 Bedrock 模型访问

1. 打开 [Amazon Bedrock 控制台](https://console.aws.amazon.com/bedrock)
2. 进入 **Model access** → **Manage model access**
3. 申请访问 **Amazon Nova** 模型：
   - ✅ Amazon Nova Micro（最快、最便宜）
   - ✅ Amazon Nova Lite（平衡）
   - ✅ Amazon Nova Pro（最强大）

:::tip 模型选择建议
对于文档聊天机器人，推荐使用 **Nova Micro**，因为它延迟低、成本效益高。它非常擅长处理问答任务。
:::

## 步骤 2：创建 Lambda 函数

### 2.1 创建函数

1. 打开 [AWS Lambda 控制台](https://console.aws.amazon.com/lambda)
2. 点击 **创建函数**
3. 配置：
   - **函数名称**：`nova-chat-api`
   - **运行时**：Python 3.12
   - **架构**：x86_64

### 2.2 添加函数代码

将以下代码复制到你的 Lambda 函数中：

```python
"""
AWS Lambda 后端 - Nova AI 聊天 API
"""

import json
import os
import boto3
from botocore.config import Config

# 配置
MODEL_ID = os.environ.get('MODEL_ID', 'amazon.nova-micro-v1:0')
MAX_TOKENS = int(os.environ.get('MAX_TOKENS', '1024'))

# 初始化 Bedrock 客户端
config = Config(retries={'max_attempts': 3, 'mode': 'adaptive'})
bedrock = boto3.client('bedrock-runtime', config=config)

# 系统提示词 - 根据你的文档内容自定义
SYSTEM_PROMPT = """你是一个技术文档站点的 AI 助手。
你帮助用户理解文档内容、回答问题并提供代码示例。
回答要简洁、友好、准确。如果不知道答案，请如实说明。"""


def lambda_handler(event, context):
    """Lambda 入口函数"""
    
    # 处理 CORS 预检请求
    if event.get('requestContext', {}).get('http', {}).get('method') == 'OPTIONS':
        return cors_response(200, {})
    
    try:
        body = json.loads(event.get('body', '{}'))
        user_message = body.get('message', '')
        history = body.get('history', [])
        
        if not user_message:
            return cors_response(400, {'error': '缺少消息内容'})
        
        # 构建消息列表
        messages = []
        for msg in history[-10:]:  # 保留最近 10 条消息
            messages.append({
                'role': msg.get('role', 'user'),
                'content': [{'text': msg.get('content', '')}]
            })
        
        messages.append({
            'role': 'user',
            'content': [{'text': user_message}]
        })
        
        # 调用 Bedrock
        response = bedrock.converse(
            modelId=MODEL_ID,
            messages=messages,
            system=[{'text': SYSTEM_PROMPT}],
            inferenceConfig={
                'maxTokens': MAX_TOKENS,
                'temperature': 0.7,
                'topP': 0.9,
            }
        )
        
        assistant_message = response['output']['message']['content'][0]['text']
        
        return cors_response(200, {
            'message': assistant_message,
            'usage': {
                'inputTokens': response['usage']['inputTokens'],
                'outputTokens': response['usage']['outputTokens'],
            }
        })
        
    except Exception as e:
        print(f"Error: {str(e)}")
        return cors_response(500, {'error': str(e)})


def cors_response(status_code: int, body: dict) -> dict:
    """返回带 CORS 头的响应"""
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',  # 生产环境请替换为你的域名
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
        'body': json.dumps(body, ensure_ascii=False)
    }
```

### 2.3 配置环境变量

为 Lambda 添加以下环境变量：

| 变量 | 值 | 说明 |
|------|-----|------|
| `MODEL_ID` | `amazon.nova-micro-v1:0` | Bedrock 模型 ID |
| `MAX_TOKENS` | `1024` | 最大响应 token 数 |

### 2.4 添加 IAM 权限

将以下策略附加到 Lambda 执行角色：

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

### 2.5 调整超时和内存

- **超时**：30 秒（Nova 响应可能需要几秒钟）
- **内存**：256 MB（对于 API 调用足够）

## 步骤 3：创建 API Gateway

### 3.1 创建 HTTP API

1. 打开 [API Gateway 控制台](https://console.aws.amazon.com/apigateway)
2. 点击 **创建 API** → **HTTP API** → **构建**
3. 添加集成：
   - **集成类型**：Lambda
   - **Lambda 函数**：`nova-chat-api`

### 3.2 配置路由

添加以下路由：

| 方法 | 路径 | 集成 |
|------|------|------|
| POST | `/api/nova-chat` | Lambda: nova-chat-api |

### 3.3 配置 CORS

在 **CORS** 设置中：

```
Access-Control-Allow-Origin: https://your-site.github.io
Access-Control-Allow-Methods: POST, OPTIONS
Access-Control-Allow-Headers: Content-Type
```

:::warning 安全提示
在生产环境中，请将 `*` 替换为你的实际域名，防止未授权访问。
:::

### 3.4 部署 API

1. 点击 **部署**
2. 复制 **调用 URL**（例如：`https://abc123.execute-api.us-east-1.amazonaws.com`）

## 步骤 4：配置前端

更新 `docusaurus.config.ts`：

```typescript
const config = {
  // ... 其他配置
  
  customFields: {
    novaChat: {
      apiEndpoint: 'https://abc123.execute-api.us-east-1.amazonaws.com/api/nova-chat',
      welcomeMessage: '👋 你好！我是 Nova AI 助手，有什么可以帮助你的吗？',
      placeholder: '输入你的问题...',
      position: 'bottom-right',
    },
  },
};
```

## 步骤 5：测试集成

1. 运行 Docusaurus 站点：`npm start`
2. 点击右下角的聊天按钮
3. 发送测试消息
4. 验证是否收到 Nova 的回复

## 故障排查

### "Access Denied" 错误

- 检查 Lambda IAM 角色是否有 Bedrock 权限
- 确认 Bedrock 控制台中已启用模型访问

### CORS 错误

- 确保 API Gateway CORS 已配置
- 检查 `Access-Control-Allow-Origin` 是否匹配你的域名

### 超时错误

- 将 Lambda 超时增加到 30 秒以上
- 检查 CloudWatch 日志中的错误

### 无响应

- 验证 `docusaurus.config.ts` 中的 API Gateway URL 是否正确
- 检查浏览器控制台的网络错误

## 成本估算

| 模型 | 输入 | 输出 | 单次对话成本 |
|------|------|------|-------------|
| Nova Micro | $0.035/1M tokens | $0.14/1M tokens | ~$0.00007 |
| Nova Lite | $0.06/1M tokens | $0.24/1M tokens | ~$0.00012 |
| Nova Pro | $0.80/1M tokens | $3.20/1M tokens | ~$0.0016 |

对于每月 ~1000 次对话的文档站点（使用 Nova Micro）：
- 预估成本：**< ¥0.70/月**

## 下一步

- [自定义系统提示词](/docs/guides/ai/bedrock-intro) 以适应你的特定文档
- 添加 [RAG（检索增强生成）](/docs/guides/ai/bedrock-intro) 以获得更好的答案
- 实现速率限制以控制成本

---

:::info 完整源代码
完整的插件源代码位于：
`src/plugins/docusaurus-nova-ai/`
:::

