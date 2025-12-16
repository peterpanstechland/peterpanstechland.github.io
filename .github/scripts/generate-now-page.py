#!/usr/bin/env python3
"""
Auto-generate Now page content using GitHub activity and ZhipuAI.

This script:
1. Fetches recent GitHub activity (commits, issues, PRs)
2. Uses ZhipuAI GLM-4 to summarize and generate content
3. Updates the Now page in both English and Chinese
"""

import os
import json
from datetime import datetime, timedelta
from github import Github
from zhipuai import ZhipuAI

# Configuration
ZHIPU_API_KEY = os.environ.get('ZHIPU_API_KEY')
GITHUB_TOKEN = os.environ.get('GITHUB_TOKEN')
REPO_NAME = os.environ.get('GITHUB_REPOSITORY', 'peterpanstechland/peterpanstechland.github.io')

# File paths
EN_NOW_PATH = 'docs/start-here/now.md'
ZH_NOW_PATH = 'i18n/zh-Hans/docusaurus-plugin-content-docs/current/start-here/now.md'

def get_github_activity(days=30):
    """Fetch recent GitHub activity."""
    g = Github(GITHUB_TOKEN)
    user = g.get_user()
    
    activity = {
        'commits': [],
        'repos_updated': set(),
        'issues': [],
        'prs': [],
    }
    
    since = datetime.now() - timedelta(days=days)
    
    # Get recent commits from all repos
    for repo in user.get_repos(sort='updated')[:10]:
        try:
            for commit in repo.get_commits(author=user, since=since)[:5]:
                activity['commits'].append({
                    'repo': repo.name,
                    'message': commit.commit.message.split('\n')[0][:100],
                    'date': commit.commit.author.date.strftime('%Y-%m-%d'),
                })
                activity['repos_updated'].add(repo.name)
        except Exception:
            continue
    
    # Get recent issues and PRs
    for issue in user.get_issues(state='all', since=since)[:10]:
        if issue.pull_request:
            activity['prs'].append({
                'title': issue.title,
                'repo': issue.repository.name,
                'state': issue.state,
            })
        else:
            activity['issues'].append({
                'title': issue.title,
                'repo': issue.repository.name,
                'state': issue.state,
            })
    
    activity['repos_updated'] = list(activity['repos_updated'])
    return activity


def generate_content_with_ai(activity: dict, language: str = 'zh') -> str:
    """Use ZhipuAI to generate Now page content."""
    
    if not ZHIPU_API_KEY:
        print("Warning: ZHIPU_API_KEY not set, using template content")
        return None
    
    client = ZhipuAI(api_key=ZHIPU_API_KEY)
    
    current_month = datetime.now().strftime('%Y年%m月' if language == 'zh' else '%B %Y')
    
    # Prepare activity summary
    activity_summary = f"""
Recent GitHub Activity (last 30 days):
- Repositories updated: {', '.join(activity['repos_updated'][:5]) or 'None'}
- Recent commits: {len(activity['commits'])}
- Open issues: {len([i for i in activity['issues'] if i['state'] == 'open'])}
- Pull requests: {len(activity['prs'])}

Recent commit messages:
{chr(10).join(['- ' + c['message'] for c in activity['commits'][:10]])}
"""

    if language == 'zh':
        prompt = f"""你是一个技术博主的助手。根据以下 GitHub 活动数据，生成一个"近况"页面的内容。

{activity_summary}

请生成一个 Markdown 格式的近况页面，包含以下部分：
1. 当前重点（3-4 个要点，基于活动推断）
2. 进行中的项目（从仓库活动中推断，2-3 个项目）
3. 学习中（基于技术栈推断）

要求：
- 使用中文
- 风格：专业但友好
- 主题围绕：AWS、边缘计算、AI/ML、IoT
- 当前月份：{current_month}
- 只输出 Markdown 内容，不要包含 frontmatter
- 使用 emoji 让内容更生动

输出格式示例：
## {current_month}

### 当前重点

- 🔧 ...
- 📚 ...

### 进行中的项目

1. **项目名称**
   - 描述
   
### 学习中

- 学习内容 1
- 学习内容 2
"""
    else:
        prompt = f"""You are a tech blogger's assistant. Generate a "Now" page based on the following GitHub activity.

{activity_summary}

Generate a Markdown "Now" page with:
1. Current Focus (3-4 bullet points)
2. Ongoing Projects (2-3 projects inferred from activity)
3. Currently Learning

Requirements:
- Use English
- Style: Professional but friendly
- Topics: AWS, Edge Computing, AI/ML, IoT
- Current month: {current_month}
- Output only Markdown content, no frontmatter
- Use emojis to make it engaging

Output format:
## {current_month}

### Current Focus

- 🔧 ...
- 📚 ...

### Ongoing Projects

1. **Project Name**
   - Description
   
### Currently Learning

- Learning item 1
- Learning item 2
"""

    try:
        response = client.chat.completions.create(
            model="glm-4-flash",  # 使用免费的 flash 模型
            messages=[
                {"role": "system", "content": "You are a helpful assistant that generates blog content."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=2000,
        )
        return response.choices[0].message.content
    except Exception as e:
        print(f"Error calling ZhipuAI: {e}")
        return None


def get_template_content(language: str = 'zh') -> str:
    """Fallback template content."""
    current_month = datetime.now().strftime('%Y年%m月' if language == 'zh' else '%B %Y')
    
    if language == 'zh':
        return f"""## {current_month}

### 当前重点

- 🔧 使用 AWS 和边缘设备构建智能 IoT 系统
- 📚 为 AWS Builder 社区撰写技术内容
- 🤖 探索 Amazon Bedrock 和 Nova 模型在边缘 AI 中的应用

### 进行中的项目

1. **云边协同监控系统**
   - ESP32 + AWS IoT Core + Greengrass
   - 实时数据可视化

2. **AI 驱动的交互装置**
   - 使用 Amazon Nova 进行多模态 AI
   - 在边缘设备上进行推理

### 学习中

- AWS 解决方案架构师认证备考
- Bedrock 高级功能和 RAG 应用
- 边缘 ML 部署策略
"""
    else:
        return f"""## {current_month}

### Current Focus

- 🔧 Building intelligent IoT systems with AWS and edge devices
- 📚 Creating technical content for the AWS Builder community
- 🤖 Exploring Amazon Bedrock and Nova models for edge AI applications

### Ongoing Projects

1. **Cloud-Edge Monitoring System**
   - ESP32 + AWS IoT Core + Greengrass
   - Real-time data visualization

2. **AI-Driven Interactive Installation**
   - Using Amazon Nova for multimodal AI
   - Edge inference on embedded devices

### Currently Learning

- Preparing for AWS Solutions Architect certification
- Bedrock advanced features and RAG applications
- Edge ML deployment strategies
"""


def update_now_file(filepath: str, new_content: str, language: str = 'zh'):
    """Update the Now page file with new content."""
    
    if language == 'zh':
        frontmatter = """---
sidebar_position: 2
title: 近况
slug: now
---

# 我的近况

> 本页面定期自动更新，反映我当前的工作重点和活动。

"""
        footer = """
---

## 联系方式

想要合作或交流？可以通过以下方式找到我：

- GitHub: [@peterpanstechland](https://github.com/peterpanstechland)

---

_本页面由 GitHub Actions + 智谱 AI 自动生成_
_灵感来自 [nownownow.com](https://nownownow.com)_
"""
    else:
        frontmatter = """---
sidebar_position: 2
title: Now
slug: now
---

# What I'm Doing Now

> This page is automatically updated to reflect my current work focus and activities.

"""
        footer = """
---

## Contact

Want to collaborate or chat? Find me here:

- GitHub: [@peterpanstechland](https://github.com/peterpanstechland)

---

_This page is auto-generated by GitHub Actions + ZhipuAI_
_Inspired by [nownownow.com](https://nownownow.com)_
"""

    full_content = frontmatter + new_content + footer
    
    # Ensure directory exists
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(full_content)
    
    print(f"Updated: {filepath}")


def main():
    print("🚀 Starting Now page auto-update...")
    
    # Fetch GitHub activity
    print("📊 Fetching GitHub activity...")
    try:
        activity = get_github_activity(days=30)
        print(f"   Found {len(activity['commits'])} commits, {len(activity['repos_updated'])} repos")
    except Exception as e:
        print(f"   Error fetching activity: {e}")
        activity = {'commits': [], 'repos_updated': [], 'issues': [], 'prs': []}
    
    # Generate Chinese content
    print("🇨🇳 Generating Chinese content...")
    zh_content = generate_content_with_ai(activity, 'zh')
    if not zh_content:
        print("   Using template content")
        zh_content = get_template_content('zh')
    
    # Generate English content
    print("🇺🇸 Generating English content...")
    en_content = generate_content_with_ai(activity, 'en')
    if not en_content:
        print("   Using template content")
        en_content = get_template_content('en')
    
    # Update files
    print("📝 Updating files...")
    update_now_file(EN_NOW_PATH, en_content, 'en')
    update_now_file(ZH_NOW_PATH, zh_content, 'zh')
    
    print("✅ Done!")


if __name__ == '__main__':
    main()

