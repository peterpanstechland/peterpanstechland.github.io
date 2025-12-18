---
sidebar_position: 1
title: AWS GameDay 2025
description: 专注于弹性和成本优化的云架构比赛
keywords: [黑客松, aws, gameday, 云, 架构]
---

# 🎮 AWS GameDay 2025

> 云架构比赛，团队竞争构建和维护弹性系统。

## 📋 赛事信息

| 项目 | 详情 |
|------|------|
| **赛事** | AWS GameDay |
| **日期** | 2025 年 3 月 |
| **时长** | 8 小时 |
| **团队规模** | 4 人 |
| **成绩** | 🥈 亚军 |

---

## 🎯 挑战概述

比赛重点关注：
1. **系统弹性** - 优雅地处理组件故障
2. **成本优化** - 在保持性能的同时最小化 AWS 开支
3. **自动伸缩** - 自动响应流量峰值
4. **可观测性** - 实时监控和调试问题

---

## 🏗️ 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                      CloudFront CDN                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Application Load Balancer                  │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        ┌──────────┐   ┌──────────┐   ┌──────────┐
        │  ECS     │   │  ECS     │   │  ECS     │
        │ Fargate  │   │ Fargate  │   │ Fargate  │
        └──────────┘   └──────────┘   └──────────┘
              │               │               │
              └───────────────┼───────────────┘
                              ▼
                    ┌──────────────────┐
                    │    DynamoDB      │
                    │  (Global Table)  │
                    └──────────────────┘
```

---

## 🛠️ 技术栈

- **计算：** ECS Fargate（自动伸缩）
- **数据库：** DynamoDB 全球表
- **CDN：** CloudFront
- **IaC：** AWS CDK (TypeScript)
- **监控：** CloudWatch, X-Ray
- **CI/CD：** CodePipeline

---

## 💻 关键代码片段

### 自动伸缩配置

```typescript
// ECS 服务自动伸缩
const scaling = service.autoScaleTaskCount({
  minCapacity: 2,
  maxCapacity: 10,
});

scaling.scaleOnCpuUtilization('CpuScaling', {
  targetUtilizationPercent: 70,
  scaleInCooldown: Duration.seconds(60),
  scaleOutCooldown: Duration.seconds(60),
});

scaling.scaleOnRequestCount('RequestScaling', {
  requestsPerTarget: 1000,
  targetGroup: targetGroup,
});
```

### DynamoDB 全球表

```typescript
const table = new dynamodb.Table(this, 'GameTable', {
  partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
  sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
  replicationRegions: ['us-west-2', 'eu-west-1'],
});
```

---

## 📊 比赛结果

| 指标 | 得分 |
|------|------|
| 可用性 | 99.8% |
| 平均响应时间 | 45ms |
| 成本效率 | 92/100 |
| 混沌工程 | 88/100 |
| **最终得分** | **94.2/100** |

---

## 📝 经验教训

1. **预热服务** - 冷启动一开始严重影响了响应时间
2. **尽早设置告警** - 通过合理的告警更快发现问题
3. **使用预留容量** - 竞赛期间竞价实例风险较大
4. **练习混沌工程** - 在练习中注入故障

---

## 🔗 相关资源

- [GitHub 仓库](https://github.com/peterpanstechland/aws-gameday-2025)
- [AWS GameDay 官方](https://aws.amazon.com/gameday/)

---

## 👥 团队成员

- **Peter Pan** - 队长，架构设计
- 成员 2 - 后端开发
- 成员 3 - DevOps，监控
- 成员 4 - 前端，文档

