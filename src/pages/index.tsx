import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

import styles from './index.module.css';

// Feature Card 数据
const features = [
  {
    icon: '🤖',
    title: 'Edge Intelligence',
    description: 'Deep integration with ESP32-S3. On-device VAD, Opus encoding, and low-latency MQTT voice streaming.',
  },
  {
    icon: '☁️',
    title: 'Cloud Native',
    description: 'Serverless architecture powered by AWS Lambda and Bedrock. Scalable, cost-effective, and resilient.',
  },
  {
    icon: '🎭',
    title: 'Cyber Puppetry',
    description: 'Revitalizing traditional shadow puppetry with PixiJS and Motion Capture. A bridge between heritage and future.',
  },
];

// Project Card 数据
const projects = [
  {
    tag: 'AI × IoT',
    tagClass: 'tagIot',
    title: 'ESP32 Voice Terminal',
    description: 'A dedicated hardware endpoint for LLM voice interaction with < 200ms latency.',
    link: '/docs/projects',
    linkText: 'View Architecture →',
    linkColor: 'primary',
  },
  {
    tag: 'Digital Art',
    tagClass: 'tagArt',
    title: 'Cyber Shadow System',
    description: 'Real-time motion capture system driving digital shadow puppets for immersive exhibitions.',
    link: '/docs/projects',
    linkText: 'Watch Demo →',
    linkColor: 'accent',
  },
];

function FeatureCard({ icon, title, description }) {
  return (
    <div className={styles.featureCard}>
      <div className={styles.iconBox}>{icon}</div>
      <h3 className={styles.featureTitle}>{title}</h3>
      <p className={styles.featureDesc}>{description}</p>
    </div>
  );
}

function ProjectCard({ tag, tagClass, title, description, link, linkText, linkColor }) {
  return (
    <div className={styles.projectCard}>
      <div className={styles.projectContent}>
        <span className={clsx(styles.projectTag, styles[tagClass])}>{tag}</span>
        <h3 className={styles.projectTitle}>{title}</h3>
        <p className={styles.projectDesc}>{description}</p>
      </div>
      <Link 
        to={link} 
        className={clsx(styles.projectLink, linkColor === 'accent' ? styles.linkAccent : styles.linkPrimary)}
      >
        {linkText}
      </Link>
    </div>
  );
}

function HomepageHeader() {
  return (
    <header className={styles.hero}>
      <Heading as="h1" className={styles.heroTitle}>
        Building the<br />
        <span className={styles.heroGradient}>Soul of Machines</span>
      </Heading>
      <p className={styles.heroSubtitle}>
        连接 AIoT 边缘计算与数字艺术的实验场。在这里，我们探索硅基智能与传统皮影艺术的赛博融合。
      </p>
      <div className={styles.heroBtns}>
        <Link className={clsx(styles.btn, styles.btnPrimary)} to="/docs/start-here/intro">
          Start Reading
        </Link>
        <Link className={clsx(styles.btn, styles.btnSecondary)} href="https://github.com/peterpanstechland">
          View GitHub
        </Link>
      </div>
    </header>
  );
}

function FeaturesSection() {
  return (
    <section className={styles.sectionContainer}>
      <div className={styles.sectionTitle}>
        <Heading as="h2">Core Technologies</Heading>
        <p>基于现代 Web 技术栈与 AWS 云服务的全链路解决方案</p>
      </div>
      <div className={styles.features}>
        {features.map((props, idx) => (
          <FeatureCard key={idx} {...props} />
        ))}
      </div>
    </section>
  );
}

function ProjectsSection() {
  return (
    <section className={styles.sectionContainer}>
      <div className={styles.sectionTitle}>
        <Heading as="h2">Featured Projects</Heading>
        <p>最新落地的 AI 互动装置与开源硬件项目</p>
      </div>
      <div className={styles.showcaseGrid}>
        {projects.map((props, idx) => (
          <ProjectCard key={idx} {...props} />
        ))}
      </div>
    </section>
  );
}

export default function Home(): JSX.Element {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title="Home"
      description="连接 AIoT 边缘计算与数字艺术的实验场">
      {/* 动态光效背景 */}
      <div className={styles.ambientLight} />
      <div className={styles.ambientLightAccent} />
      
      <HomepageHeader />
      <main>
        <FeaturesSection />
        <ProjectsSection />
      </main>
    </Layout>
  );
}
