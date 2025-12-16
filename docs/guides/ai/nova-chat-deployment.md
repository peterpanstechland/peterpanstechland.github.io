---
sidebar_position: 2
title: Deploy Nova AI Chat Plugin
description: Step-by-step guide to deploy the Nova AI chat assistant for your Docusaurus site
keywords: [aws, bedrock, nova, lambda, api-gateway, chatbot, ai]
---

# Deploy Nova AI Chat Plugin

This guide walks you through deploying the Nova AI chat assistant plugin, which adds an AI-powered chatbot to your Docusaurus documentation site using Amazon Bedrock's Nova models.

## Overview

The Nova AI chat plugin consists of two parts:

1. **Frontend Component**: A React chat widget embedded in your Docusaurus site
2. **Backend API**: An AWS Lambda function that calls Amazon Bedrock's Nova model

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   Docusaurus    │ ---> │   API Gateway   │ ---> │     Lambda      │
│   (Frontend)    │      │   (HTTP API)    │      │   (Bedrock)     │
└─────────────────┘      └─────────────────┘      └─────────────────┘
```

## Prerequisites

- AWS Account with Bedrock access
- AWS CLI configured
- Basic knowledge of Lambda and API Gateway

## Step 1: Enable Bedrock Model Access

1. Open [Amazon Bedrock Console](https://console.aws.amazon.com/bedrock)
2. Navigate to **Model access** → **Manage model access**
3. Request access to **Amazon Nova** models:
   - ✅ Amazon Nova Micro (fastest, cheapest)
   - ✅ Amazon Nova Lite (balanced)
   - ✅ Amazon Nova Pro (most capable)

:::tip Model Selection
For documentation chatbots, **Nova Micro** is recommended due to its low latency and cost-effectiveness. It handles Q&A tasks excellently.
:::

## Step 2: Create Lambda Function

### 2.1 Create Function

1. Go to [AWS Lambda Console](https://console.aws.amazon.com/lambda)
2. Click **Create function**
3. Configure:
   - **Function name**: `nova-chat-api`
   - **Runtime**: Python 3.12
   - **Architecture**: x86_64

### 2.2 Add Function Code

Copy the following code to your Lambda function:

```python
"""
AWS Lambda Backend - Nova AI Chat API
"""

import json
import os
import boto3
from botocore.config import Config

# Configuration
MODEL_ID = os.environ.get('MODEL_ID', 'amazon.nova-micro-v1:0')
MAX_TOKENS = int(os.environ.get('MAX_TOKENS', '1024'))

# Initialize Bedrock client
config = Config(retries={'max_attempts': 3, 'mode': 'adaptive'})
bedrock = boto3.client('bedrock-runtime', config=config)

# System prompt - customize for your documentation
SYSTEM_PROMPT = """You are a helpful AI assistant for a technical documentation site.
You help users understand the documentation, answer questions, and provide code examples.
Be concise, friendly, and accurate. If you don't know something, say so."""


def lambda_handler(event, context):
    """Lambda entry point"""
    
    # Handle CORS preflight
    if event.get('requestContext', {}).get('http', {}).get('method') == 'OPTIONS':
        return cors_response(200, {})
    
    try:
        body = json.loads(event.get('body', '{}'))
        user_message = body.get('message', '')
        history = body.get('history', [])
        
        if not user_message:
            return cors_response(400, {'error': 'Missing message'})
        
        # Build messages
        messages = []
        for msg in history[-10:]:  # Keep last 10 messages
            messages.append({
                'role': msg.get('role', 'user'),
                'content': [{'text': msg.get('content', '')}]
            })
        
        messages.append({
            'role': 'user',
            'content': [{'text': user_message}]
        })
        
        # Call Bedrock
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
    """Return response with CORS headers"""
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',  # Replace with your domain in production
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
        'body': json.dumps(body, ensure_ascii=False)
    }
```

### 2.3 Configure Environment Variables

Add these environment variables to your Lambda:

| Variable | Value | Description |
|----------|-------|-------------|
| `MODEL_ID` | `amazon.nova-micro-v1:0` | Bedrock model ID |
| `MAX_TOKENS` | `1024` | Max response tokens |

### 2.4 Add IAM Permissions

Attach this policy to your Lambda execution role:

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

### 2.5 Adjust Timeout and Memory

- **Timeout**: 30 seconds (Nova responses can take a few seconds)
- **Memory**: 256 MB (sufficient for API calls)

## Step 3: Create API Gateway

### 3.1 Create HTTP API

1. Go to [API Gateway Console](https://console.aws.amazon.com/apigateway)
2. Click **Create API** → **HTTP API** → **Build**
3. Add integration:
   - **Integration type**: Lambda
   - **Lambda function**: `nova-chat-api`

### 3.2 Configure Routes

Add the following route:

| Method | Path | Integration |
|--------|------|-------------|
| POST | `/api/nova-chat` | Lambda: nova-chat-api |

### 3.3 Configure CORS

In **CORS** settings:

```
Access-Control-Allow-Origin: https://your-site.github.io
Access-Control-Allow-Methods: POST, OPTIONS
Access-Control-Allow-Headers: Content-Type
```

:::warning Security
In production, replace `*` with your actual domain to prevent unauthorized access.
:::

### 3.4 Deploy API

1. Click **Deploy**
2. Copy the **Invoke URL** (e.g., `https://abc123.execute-api.us-east-1.amazonaws.com`)

## Step 4: Configure Frontend

Update your `docusaurus.config.ts`:

```typescript
const config = {
  // ... other config
  
  customFields: {
    novaChat: {
      apiEndpoint: 'https://abc123.execute-api.us-east-1.amazonaws.com/api/nova-chat',
      welcomeMessage: '👋 Hi! I am Nova AI assistant. How can I help you?',
      placeholder: 'Ask me anything...',
      position: 'bottom-right',
    },
  },
};
```

## Step 5: Test the Integration

1. Run your Docusaurus site: `npm start`
2. Click the chat button in the bottom-right corner
3. Send a test message
4. Verify you receive a response from Nova

## Troubleshooting

### "Access Denied" Error

- Check Lambda IAM role has Bedrock permissions
- Verify model access is enabled in Bedrock console

### CORS Errors

- Ensure API Gateway CORS is configured
- Check `Access-Control-Allow-Origin` matches your domain

### Timeout Errors

- Increase Lambda timeout to 30+ seconds
- Check CloudWatch logs for errors

### No Response

- Verify API Gateway URL is correct in `docusaurus.config.ts`
- Check browser console for network errors

## Cost Estimation

| Model | Input | Output | ~Cost per Chat |
|-------|-------|--------|----------------|
| Nova Micro | $0.035/1M tokens | $0.14/1M tokens | ~$0.00007 |
| Nova Lite | $0.06/1M tokens | $0.24/1M tokens | ~$0.00012 |
| Nova Pro | $0.80/1M tokens | $3.20/1M tokens | ~$0.0016 |

For a documentation site with ~1000 chats/month using Nova Micro:
- Estimated cost: **< $0.10/month**

## Next Steps

- [Customize the System Prompt](/docs/guides/ai/bedrock-intro) for your specific documentation
- Add [RAG (Retrieval Augmented Generation)](/docs/guides/ai/bedrock-intro) for better answers
- Implement rate limiting to control costs

---

:::info Full Source Code
The complete plugin source code is available at:
`src/plugins/docusaurus-nova-ai/`
:::

