"""
AWS Lambda 后端 - Nova AI 聊天 API

使用 Amazon Bedrock 调用 Nova 模型进行对话

部署步骤：
1. 创建 Lambda 函数 (Python 3.12)
2. 配置 IAM 角色，添加 Bedrock 访问权限
3. 创建 API Gateway HTTP API
4. 配置 CORS 允许你的域名

环境变量：
- MODEL_ID: 使用的模型 ID (默认: amazon.nova-micro-v1:0)
- MAX_TOKENS: 最大输出 token 数 (默认: 1024)
"""

import json
import os
import boto3
from botocore.config import Config

# 配置
MODEL_ID = os.environ.get('MODEL_ID', 'amazon.nova-micro-v1:0')
MAX_TOKENS = int(os.environ.get('MAX_TOKENS', '1024'))

# 初始化 Bedrock 客户端
config = Config(
    retries={'max_attempts': 3, 'mode': 'adaptive'}
)
bedrock = boto3.client(
    service_name='bedrock-runtime',
    config=config
)

# 系统提示词
SYSTEM_PROMPT = """你是一个专业的技术文档助手，名为 Nova AI。你的职责是帮助用户理解和使用这个技术文档站点。

你的特点：
- 友好、专业、简洁
- 精通 AWS、IoT、边缘计算、AI/ML 相关技术
- 能够用中英文回答问题
- 提供代码示例时使用正确的语法高亮

站点主要内容：
- AWS 云服务教程 (EC2, S3, Lambda, Bedrock, IoT Core)
- 边缘设备开发 (ESP32, Raspberry Pi, Jetson)
- AI/ML 应用 (Bedrock, Nova, Claude, SageMaker)
- 硬件项目 (语音助手, 赛博皮影, 智能家居)

请用简洁、有帮助的方式回答用户的问题。"""


def lambda_handler(event, context):
    """Lambda 入口函数"""
    
    # 处理 CORS preflight
    if event.get('requestContext', {}).get('http', {}).get('method') == 'OPTIONS':
        return cors_response(200, {})
    
    try:
        # 解析请求体
        body = json.loads(event.get('body', '{}'))
        user_message = body.get('message', '')
        conversation_history = body.get('history', [])
        
        if not user_message:
            return cors_response(400, {'error': 'Missing message'})
        
        # 构建消息列表
        messages = []
        
        # 添加历史消息
        for msg in conversation_history[-10:]:  # 只保留最近10条
            messages.append({
                'role': msg.get('role', 'user'),
                'content': [{'text': msg.get('content', '')}]
            })
        
        # 添加当前用户消息
        messages.append({
            'role': 'user',
            'content': [{'text': user_message}]
        })
        
        # 调用 Bedrock Nova API
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
        
        # 提取回复
        assistant_message = response['output']['message']['content'][0]['text']
        
        # 返回结果
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
            'Access-Control-Allow-Origin': '*',  # 生产环境应限制为你的域名
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
        'body': json.dumps(body, ensure_ascii=False)
    }

