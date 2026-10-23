import React from 'react';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import GarageHero from '../components/GarageHero';
import styles from './index.module.css';

export default function Home(): React.JSX.Element {
  const {i18n} = useDocusaurusContext();
  const zh = i18n.currentLocale === 'zh-Hans';
  const lang = (en: string, cn: string) => zh ? cn : en;
  return <Layout
    title={lang('The Cyber Maker Garage', '赛博创客车库')}
    description={lang("Peter Pan's Techland: an interactive maker universe of AI, robotics, creative coding and hardware.", '彼得潘的科技谷：一个关于 AI、机器人、创意编程与开源硬件的互动创客宇宙。')}>
    <main className={styles.page}>
      <GarageHero home />
      <section className={styles.nextChapter}>
        <div className={styles.nextIntro}>
          <div className={styles.nextEyebrow}>SCROLL FOR THE STORIES / 002</div>
          <h2>{lang('The garage is just the entrance.','车库只是入口。')}</h2>
          <p>{lang('Behind every blinking LED is a build log, an unexpected failure, and something new to learn.','每一颗闪烁的 LED 背后，都是一次实验、一次翻车，以及一个值得记录的故事。')}</p>
        </div>
        <div className={styles.editorialGrid}>
          <Link className={styles.editorialItem} to="/docs/projects">
            <span className={styles.cardStep}>01 — MAKE</span><strong>{lang('Machines with a soul','给机器注入灵魂')}</strong>
            <p>{lang('Robots, interactive installations, AI hardware and projects that escaped the notebook.','机器人、交互装置、AI 硬件，以及走出笔记本的疯狂想法。')}</p><span className={styles.cardAction}>{lang('Explore Projects','浏览项目')} ↗</span>
          </Link>
          <Link className={styles.editorialItem} to="/challenge">
            <span className={styles.cardStep}>02 — CONNECT</span><strong>BEG. BUILD. SHOW.</strong>
            <p>{lang('The Makers Challenge: a community-powered quest to assemble a real demo from donated parts.','Makers Challenge：逛遍展位化缘零件，现场组装真实 Demo。')}</p><span className={styles.cardAction}>{lang('Join the Challenge','进入挑战')} ↗</span>
          </Link>
          <Link className={styles.editorialItem} to="/docs/guides">
            <span className={styles.cardStep}>03 — LEARN</span><strong>{lang('Notes from the bench','工作台上的笔记')}</strong>
            <p>{lang('Hardware tutorials, creative coding, AI experiments and the lessons worth sharing.','硬件教程、创意编程、AI 实验和可以复用的经验。')}</p><span className={styles.cardAction}>{lang('Read Guides','阅读指南')} ↗</span>
          </Link>
        </div>
        <div className={styles.chapterBottom}><span>TECHNOLOGY IGNITES THE SOUL OF MACHINES.</span><Link to="/docs/projects/maker-garage-3d">{lang("3D GARAGE BLUEPRINT","3D 车库设计图")} ↗</Link><Link to="/docs/about">{lang('ABOUT THE MAKER','关于彼得潘')} ↗</Link></div>
      </section>
    </main>
  </Layout>;
}
