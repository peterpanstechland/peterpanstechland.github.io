---
sidebar_position: 1
title: 近况页面自动更新
description: 使用 GitHub Actions 和智谱 AI 自动更新近况页面
keywords: [github-actions, 自动化, 智谱ai, glm, 近况页面]
---

# 使用 GitHub Actions 自动更新近况页面

本指南介绍如何使用 GitHub Actions 和[智谱 AI](https://open.bigmodel.cn/) 自动更新你的"近况"页面。

## 概述

自动化工作流程：
1. **触发** - 每周一自动运行或手动触发
2. **获取** - 收集你最近的 GitHub 活动（commits、issues、PRs）
3. **生成** - 使用智谱 AI GLM-4 模型生成内容
4. **更新** - 同时更新中英文近况页面
5. **提交** - 自动提交并推送更改

## 前置条件

- 启用了 Actions 的 GitHub 仓库
- 智谱 AI API 密钥（有免费额度）

## 配置步骤

### 1. 获取智谱 AI API Key

1. 访问[智谱AI开放平台](https://open.bigmodel.cn/)
2. 注册并验证你的账户
3. 在控制台中找到 **API Keys**
4. 创建一个新的 API Key

:::tip 免费额度
智谱 AI 提供 GLM-4-Flash 模型的免费额度，足以满足此场景使用。
:::

### 2. 添加 GitHub Secret

1. 进入仓库 **Settings** → **Secrets and variables** → **Actions**
2. 点击 **New repository secret**
3. 名称：`ZHIPU_API_KEY`
4. 值：你的智谱 AI API Key
5. 点击 **Add secret**

### 3. 工作流配置

工作流文件位于 `.github/workflows/update-now.yml`：

```yaml
name: Auto Update Now Page

on:
  schedule:
    - cron: '0 0 * * 1'  # 每周一 UTC 00:00（北京时间周一早8点）
  workflow_dispatch:      # 手动触发

jobs:
  update-now:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
      - run: pip install zhipuai requests PyGithub
      - run: python .github/scripts/generate-now-page.py
        env:
          ZHIPU_API_KEY: ${{ secrets.ZHIPU_API_KEY }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## 工作原理

### 内容生成

Python 脚本 (`generate-now-page.py`) 执行以下步骤：

1. **GitHub 活动收集**
   - 获取过去 30 天的提交记录
   - 列出最近更新的仓库
   - 收集打开的 issues 和 pull requests

2. **AI 内容生成**
   - 将活动数据发送给智谱 AI GLM-4-Flash
   - 同时生成中英文结构化内容
   - API 失败时使用模板作为后备

3. **文件更新**
   - 更新 `docs/start-here/now.md`（英文）
   - 更新 `i18n/zh-Hans/.../now.md`（中文）

### Prompt 工程

AI Prompt 设计要点：
- 聚焦 AWS、边缘计算、AI/ML、IoT 主题
- 从仓库活动推断项目进展
- 保持专业但友好的语气
- 使用 emoji 增强视觉效果

## 自定义配置

### 修改调度时间

编辑 `update-now.yml` 中的 cron 表达式：

```yaml
schedule:
  - cron: '0 0 1 * *'  # 每月（每月1号）
  - cron: '0 0 * * 0'  # 每周（周日）
```

### 修改内容主题

编辑 `generate-now-page.py` 中的 prompt：

```python
prompt = f"""
...
- Topics: AWS, Edge Computing, AI/ML, IoT  # 修改这里
...
"""
```

### 添加更多章节

扩展 prompt 以包含额外章节：

```python
prompt += """
### 阅读清单
- 包含你正在阅读的书籍或文章

### 下月目标
- 你计划完成的事项
"""
```

## 手动触发

要手动运行工作流：

1. 进入仓库的 **Actions** 标签页
2. 选择 **Auto Update Now Page**
3. 点击 **Run workflow**
4. 可选：勾选 **Force update**

## 故障排除

### API 速率限制

智谱 AI 免费版有速率限制。如果遇到限制：
- 降低更新频率
- 考虑升级到付费版

### 未检测到更改

如果工作流运行但没有提交：
- AI 可能生成了相同的内容
- 查看工作流日志了解详情

### 权限问题

确保工作流有写入权限：

```yaml
permissions:
  contents: write
```

## 成本

| 服务 | 费用 |
|------|------|
| 智谱 AI GLM-4-Flash | 免费（有限额） |
| GitHub Actions | 免费（公开仓库） |

## 相关链接

- [智谱 AI 文档](https://open.bigmodel.cn/dev/api)
- [GitHub Actions 定时任务](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#schedule)
- [nownownow.com](https://nownownow.com) - Now 页面运动起源

