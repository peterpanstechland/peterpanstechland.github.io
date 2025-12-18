---
sidebar_position: 1
title: AWS GameDay 2025
description: Cloud architecture competition focusing on resilience and cost optimization
keywords: [hackathon, aws, gameday, cloud, architecture]
---

# 🎮 AWS GameDay 2025

> A cloud architecture competition where teams compete to build and maintain resilient systems.

## 📋 Event Info

| Field | Details |
|-------|---------|
| **Event** | AWS GameDay |
| **Date** | March 2025 |
| **Duration** | 8 hours |
| **Team Size** | 4 members |
| **Result** | 🥈 2nd Place |

---

## 🎯 Challenge Overview

The challenge focused on:
1. **System Resilience** - Handle component failures gracefully
2. **Cost Optimization** - Minimize AWS spending while maintaining performance
3. **Auto Scaling** - Respond to traffic spikes automatically
4. **Observability** - Monitor and debug issues in real-time

---

## 🏗️ Architecture

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

## 🛠️ Tech Stack

- **Compute:** ECS Fargate (Auto Scaling)
- **Database:** DynamoDB with Global Tables
- **CDN:** CloudFront
- **IaC:** AWS CDK (TypeScript)
- **Monitoring:** CloudWatch, X-Ray
- **CI/CD:** CodePipeline

---

## 💻 Key Code Snippets

### Auto Scaling Configuration

```typescript
// ECS Service Auto Scaling
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

### DynamoDB Global Table

```typescript
const table = new dynamodb.Table(this, 'GameTable', {
  partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
  sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
  replicationRegions: ['us-west-2', 'eu-west-1'],
});
```

---

## 📊 Results

| Metric | Score |
|--------|-------|
| Uptime | 99.8% |
| Avg Response Time | 45ms |
| Cost Efficiency | 92/100 |
| Chaos Engineering | 88/100 |
| **Final Score** | **94.2/100** |

---

## 📝 Lessons Learned

1. **Pre-warm your services** - Cold starts killed our response time initially
2. **Set up alarms early** - We caught issues faster with proper alerting
3. **Use reserved capacity** - Spot instances are risky during competitions
4. **Practice chaos engineering** - Inject failures during practice runs

---

## 🔗 Resources

- [GitHub Repository](https://github.com/peterpanstechland/aws-gameday-2025)
- [AWS GameDay Official](https://aws.amazon.com/gameday/)
- [Architecture Decision Records](/docs/hackathons/2025/aws-gameday-adr)

---

## 👥 Team

- **Peter Pan** - Team Lead, Architecture
- Member 2 - Backend Development
- Member 3 - DevOps, Monitoring
- Member 4 - Frontend, Documentation

