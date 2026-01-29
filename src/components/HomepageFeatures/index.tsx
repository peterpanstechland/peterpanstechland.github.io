import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

type FeatureItem = {
  title: string;
  emoji: string;
  description: React.JSX.Element;
};

const FeatureList: FeatureItem[] = [
  {
    title: 'AI x Edge x AWS',
    emoji: '⚡',
    description: (
      <>
        ESP32-S3 语音交互、Jetson 边缘推理、AWS IoT Core 无缝集成，
        构建真正的云边协同智能系统。
      </>
    ),
  },
  {
    title: 'Cyber Puppetry',
    emoji: '🤖',
    description: (
      <>
        机械臂、LED 矩阵、传感器融合——将传统皮影艺术与现代机器人技术相结合，
        打造沉浸式交互装置。
      </>
    ),
  },
  {
    title: 'GenAI + Nova',
    emoji: '🧠',
    description: (
      <>
        深度集成 Amazon Bedrock、Nova 模型与 Claude API，
        从 RAG 应用到多模态推理，探索生成式 AI 的无限可能。
      </>
    ),
  },
];

function Feature({title, emoji, description}: FeatureItem) {
  return (
    <div className={clsx('col col--4')}>
      <div className={styles.featureCard}>
        <span className={styles.featureEmoji}>{emoji}</span>
        <Heading as="h3" className={styles.featureTitle}>{title}</Heading>
        <p className={styles.featureDescription}>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): React.JSX.Element {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
