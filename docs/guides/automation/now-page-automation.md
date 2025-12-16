---
sidebar_position: 1
title: Now Page Auto-Update
description: Automatically update your Now page using GitHub Actions and ZhipuAI
keywords: [github-actions, automation, zhipuai, glm, now-page]
---

# Now Page Auto-Update with GitHub Actions

This guide explains how to set up automatic updates for your "Now" page using GitHub Actions and [ZhipuAI](https://open.bigmodel.cn/) (智谱 AI).

## Overview

The automation workflow:
1. **Triggers** weekly (every Monday) or manually
2. **Fetches** your recent GitHub activity (commits, issues, PRs)
3. **Generates** content using ZhipuAI GLM-4 model
4. **Updates** both English and Chinese Now pages
5. **Commits** and pushes changes automatically

## Prerequisites

- GitHub repository with Actions enabled
- ZhipuAI API key (free tier available)

## Setup

### 1. Get ZhipuAI API Key

1. Visit [智谱AI开放平台](https://open.bigmodel.cn/)
2. Register and verify your account
3. Navigate to **API Keys** in your dashboard
4. Create a new API key

:::tip Free Tier
ZhipuAI offers a free tier with GLM-4-Flash model, which is sufficient for this use case.
:::

### 2. Add GitHub Secret

1. Go to your repository **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Name: `ZHIPU_API_KEY`
4. Value: Your ZhipuAI API key
5. Click **Add secret**

### 3. Workflow Configuration

The workflow file is located at `.github/workflows/update-now.yml`:

```yaml
name: Auto Update Now Page

on:
  schedule:
    - cron: '0 0 * * 1'  # Every Monday at UTC 00:00
  workflow_dispatch:      # Manual trigger

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

## How It Works

### Content Generation

The Python script (`generate-now-page.py`) performs these steps:

1. **GitHub Activity Collection**
   - Fetches commits from the last 30 days
   - Lists recently updated repositories
   - Gathers open issues and pull requests

2. **AI Content Generation**
   - Sends activity data to ZhipuAI GLM-4-Flash
   - Generates structured content in both languages
   - Falls back to template if API fails

3. **File Updates**
   - Updates `docs/start-here/now.md` (English)
   - Updates `i18n/zh-Hans/.../now.md` (Chinese)

### Prompt Engineering

The AI prompt is designed to:
- Focus on AWS, Edge Computing, AI/ML, IoT topics
- Infer projects from repository activity
- Maintain a professional but friendly tone
- Use emojis for visual appeal

## Customization

### Change Schedule

Edit the cron expression in `update-now.yml`:

```yaml
schedule:
  - cron: '0 0 1 * *'  # Monthly (1st of each month)
  - cron: '0 0 * * 0'  # Weekly (Sundays)
```

### Modify Content Focus

Edit the prompt in `generate-now-page.py`:

```python
prompt = f"""
...
- Topics: AWS, Edge Computing, AI/ML, IoT  # Change this
...
"""
```

### Add More Sections

Extend the prompt to include additional sections:

```python
prompt += """
### Reading List
- Include books or articles you're reading

### Goals for Next Month
- What you plan to accomplish
"""
```

## Manual Trigger

To run the workflow manually:

1. Go to **Actions** tab in your repository
2. Select **Auto Update Now Page**
3. Click **Run workflow**
4. Optionally check **Force update**

## Troubleshooting

### API Rate Limits

ZhipuAI has rate limits on the free tier. If you hit limits:
- Reduce update frequency
- Consider upgrading to paid tier

### No Changes Detected

If the workflow runs but doesn't commit:
- The AI might have generated identical content
- Check workflow logs for details

### Permission Issues

Ensure the workflow has write permissions:

```yaml
permissions:
  contents: write
```

## Cost

| Service | Cost |
|---------|------|
| ZhipuAI GLM-4-Flash | Free (with limits) |
| GitHub Actions | Free (public repos) |

## Related

- [ZhipuAI Documentation](https://open.bigmodel.cn/dev/api)
- [GitHub Actions Scheduling](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#schedule)
- [nownownow.com](https://nownownow.com) - The Now page movement

