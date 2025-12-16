import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import Translate, {translate} from '@docusaurus/Translate';

import styles from './index.module.css';

// Feature Card 数据
const features = [
  {
    icon: '🤖',
    titleKey: 'homepage.features.edge.title',
    titleDefault: 'Edge Intelligence',
    descKey: 'homepage.features.edge.description',
    descDefault: 'Deep integration with ESP32-S3. On-device VAD, Opus encoding, and low-latency MQTT voice streaming.',
  },
  {
    icon: '☁️',
    titleKey: 'homepage.features.cloud.title',
    titleDefault: 'Cloud Native',
    descKey: 'homepage.features.cloud.description',
    descDefault: 'Serverless architecture powered by AWS Lambda and Bedrock. Scalable, cost-effective, and resilient.',
  },
  {
    icon: '🎭',
    titleKey: 'homepage.features.puppetry.title',
    titleDefault: 'Cyber Puppetry',
    descKey: 'homepage.features.puppetry.description',
    descDefault: 'Revitalizing traditional shadow puppetry with PixiJS and Motion Capture. A bridge between heritage and future.',
  },
];

// Project Card 数据
const projects = [
  {
    tagKey: 'homepage.projects.esp32.tag',
    tagDefault: 'AI × IoT',
    tagClass: 'tagIot',
    titleKey: 'homepage.projects.esp32.title',
    titleDefault: 'ESP32 Voice Terminal',
    descKey: 'homepage.projects.esp32.description',
    descDefault: 'A dedicated hardware endpoint for LLM voice interaction with < 200ms latency.',
    link: '/docs/projects',
    linkTextKey: 'homepage.projects.viewArchitecture',
    linkTextDefault: 'View Architecture →',
    linkColor: 'primary',
  },
  {
    tagKey: 'homepage.projects.shadow.tag',
    tagDefault: 'Digital Art',
    tagClass: 'tagArt',
    titleKey: 'homepage.projects.shadow.title',
    titleDefault: 'Cyber Shadow System',
    descKey: 'homepage.projects.shadow.description',
    descDefault: 'Real-time motion capture system driving digital shadow puppets for immersive exhibitions.',
    link: '/docs/projects',
    linkTextKey: 'homepage.projects.watchDemo',
    linkTextDefault: 'Watch Demo →',
    linkColor: 'accent',
  },
];

function FeatureCard({ icon, titleKey, titleDefault, descKey, descDefault }) {
  return (
    <div className={styles.featureCard}>
      <div className={styles.iconBox}>{icon}</div>
      <h3 className={styles.featureTitle}>
        <Translate id={titleKey}>{titleDefault}</Translate>
      </h3>
      <p className={styles.featureDesc}>
        <Translate id={descKey}>{descDefault}</Translate>
      </p>
    </div>
  );
}

function ProjectCard({ tagKey, tagDefault, tagClass, titleKey, titleDefault, descKey, descDefault, link, linkTextKey, linkTextDefault, linkColor }) {
  return (
    <div className={styles.projectCard}>
      <div className={styles.projectContent}>
        <span className={clsx(styles.projectTag, styles[tagClass])}>
          <Translate id={tagKey}>{tagDefault}</Translate>
        </span>
        <h3 className={styles.projectTitle}>
          <Translate id={titleKey}>{titleDefault}</Translate>
        </h3>
        <p className={styles.projectDesc}>
          <Translate id={descKey}>{descDefault}</Translate>
        </p>
      </div>
      <Link 
        to={link} 
        className={clsx(styles.projectLink, linkColor === 'accent' ? styles.linkAccent : styles.linkPrimary)}
      >
        <Translate id={linkTextKey}>{linkTextDefault}</Translate>
      </Link>
    </div>
  );
}

function HomepageHeader() {
  return (
    <header className={styles.hero}>
      <Heading as="h1" className={styles.heroTitle}>
        <Translate id="homepage.hero.title.line1">Building the</Translate><br />
        <span className={styles.heroGradient}>
          <Translate id="homepage.hero.title.line2">Soul of Machines</Translate>
        </span>
      </Heading>
      <p className={styles.heroSubtitle}>
        <Translate id="homepage.hero.subtitle">
          A laboratory connecting AIoT edge computing and digital art. Exploring the cyber fusion of silicon intelligence and traditional shadow puppetry.
        </Translate>
      </p>
      <div className={styles.heroBtns}>
        <Link className={clsx(styles.btn, styles.btnPrimary)} to="/docs/start-here/intro">
          <Translate id="homepage.hero.cta.start">Start Reading</Translate>
        </Link>
        <Link className={clsx(styles.btn, styles.btnSecondary)} href="https://github.com/peterpanstechland">
          <Translate id="homepage.hero.cta.github">View GitHub</Translate>
        </Link>
      </div>
    </header>
  );
}

function FeaturesSection() {
  return (
    <section className={styles.sectionContainer}>
      <div className={styles.sectionTitle}>
        <Heading as="h2">
          <Translate id="homepage.features.title">Core Technologies</Translate>
        </Heading>
        <p>
          <Translate id="homepage.features.subtitle">
            Full-stack solutions based on modern web technologies and AWS cloud services
          </Translate>
        </p>
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
        <Heading as="h2">
          <Translate id="homepage.projects.title">Featured Projects</Translate>
        </Heading>
        <p>
          <Translate id="homepage.projects.subtitle">
            Latest AI interactive installations and open-source hardware projects
          </Translate>
        </p>
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
      title={translate({id: 'homepage.meta.title', message: 'Home'})}
      description={translate({id: 'homepage.meta.description', message: 'A laboratory connecting AIoT edge computing and digital art'})}>
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
