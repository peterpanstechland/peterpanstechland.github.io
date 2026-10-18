import React from 'react';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import styles from './challenge.module.css';

type Copy = {
  eyebrow: string; title: string; subtitle: string; status: string; statusText: string;
  explore: string; sponsor: string; statTeams: string; statBooths: string; statDates: string;
  firstTitle: string; firstDescription: string; stepsTitle: string;
  steps: {num:string; word:string; title:string; text:string}[];
  supportEyebrow: string; supportTitle: string; supportText: string;
  supportTypes: {icon:string; title:string; text:string}[];
  supportCta: string; rulesTitle: string; rulesText: string; rulesCta: string;
  footnote: string;
};
const copy: Record<'en'|'zh',Copy> = {
  en: {
    eyebrow: 'PETER PAN’S TECHLAND / COMMUNITY CHALLENGE / 2026',
    title: 'MAKERS\nCHALLENGE',
    subtitle: 'BEG. BUILD. SHOW. Collect components from willing exhibitor booths. Remix the impossible. Make a real, working demo.',
    status: 'PROPOSAL · LOOKING FOR PARTNERS',
    statusText: 'An independent community concept aligned with Maker Faire Shenzhen 2026. Challenge admission, on-site space and organizer approval are not yet confirmed.',
    explore: 'Read the complete challenge plan', sponsor: 'Looking for sponsors →',
    statTeams: 'proposed teams', statBooths: 'voluntary booths', statDates: 'Maker Faire dates',
    firstTitle: '2026 Shenzhen Maker Faire · Makers Challenge',
    firstDescription: 'December 12–13, 2026 · Nanshan, Shenzhen. An experimental two-day build where every booth could become a collaborator. The official fair dates are confirmed; the Makers Challenge remains a proposal.',
    stepsTitle: 'THE THREE-PHASE MISSION',
    steps: [
      {num:'01',word:'BEG',title:'Find your weird ingredients',text:'Visit voluntary booths. Ask for one available component, material, or an approved tool loan. Log the maker who helped in your Maker Passport.'},
      {num:'02',word:'BUILD',title:'Make the pieces talk',text:'Use the shared workshop, trade responsibly, and seek technical advice. Integrate seemingly incompatible parts into one fresh prototype.'},
      {num:'03',word:'SHOW',title:'Demo or it didn’t happen',text:'Run the real device in front of people. Tell its origin story, credit contributors, explain failures, and show what you actually built.'}
    ],
    supportEyebrow:'OPEN CALL / IN-KIND + EQUIPMENT + CASH SUPPORT',
    supportTitle:'LOOKING FOR\nSPONSORS',
    supportText:'Not just a logo on a wall. Put your technology into makers’ hands, see it used in unexpected ways, and become part of the story.',
    supportTypes:[
      {icon:'⌘',title:'Products & components',text:'Boards, sensors, LEDs, motors, displays, cameras, cables, enclosures, scraps.'},
      {icon:'⚒',title:'Tools & equipment',text:'Soldering stations, 3D printers, test gear, benches and safe shared access.'},
      {icon:'↗',title:'Exhibitors & mentors',text:'One donated item per team when available, booth challenges and expert guidance.'},
      {icon:'✦',title:'Funds & logistics',text:'Workshop operations, safety, consumables, awards, documentation and media.'}
    ],
    supportCta:'Explore sponsor & exhibitor opportunities →',
    rulesTitle:'NO PRE-BUILT WINNERS.', rulesText:'No fixed bill of materials, no forced booth donations, no unfair access to premium tools. Creativity and responsible collaboration matter more than purchase power.',
    rulesCta:'Rules, scoring, safety & schedule →',
    footnote:'Independent proposal by Peter Pan’s Techland. Not an official Maker Faire Shenzhen program unless expressly approved by its organizers.'
  },
  zh: {
    eyebrow: '彼得潘的科技谷 / 创客社区挑战 / 2026',
    title: 'MAKERS\nCHALLENGE',
    subtitle: 'BEG. BUILD. SHOW.｜化缘、造物、开演。逛遍自愿参与的展位，向 Maker 化缘零件、借用设备，把不可能拼成一个真的能跑的 Demo。',
    status: '独立企划 · 寻找赞助与合作伙伴',
    statusText: '拟在 2026 深圳 Maker Faire 期间举行。挑战赛尚未获得主办方正式确认，现场区域、入场与具体执行安排均待批准。',
    explore: '查看完整活动企划与规则', sponsor: 'LOOKING FOR SPONSORS →',
    statTeams: '拟招募队伍', statBooths: '拟邀自愿参与展位', statDates: '官方展会日期',
    firstTitle: '2026 深圳 Maker Faire · Makers Challenge',
    firstDescription: '2026 年 12 月 12–13 日 · 深圳南山区。让展会不只是看展，而是一场贯穿全场的「赛博化缘造物游戏」。展会日期已公布；挑战赛仍为独立提案。',
    stepsTitle: '三阶段极限造物',
    steps: [
      {num:'01',word:'BEG',title:'全场化缘',text:'拜访自愿参与的展位，礼貌询问可提供的模块、材料或允许借用的设备，并在 Maker Passport 记录来源。'},
      {num:'02',word:'BUILD',title:'现场缝合',text:'开放工坊里焊接、打印、编程、联调；合理交换零件、求助技术导师，把来自不同展位的技术集成起来。'},
      {num:'03',word:'SHOW',title:'现场开演',text:'3 分钟讲清创意，真正运行 Demo，展示物料来源、协作过程、故障与修复，感谢每一位贡献者。'}
    ],
    supportEyebrow:'全球征集 / 实物赞助 + 设备借用 + 资金与资源支持',
    supportTitle:'LOOKING FOR\nSPONSORS',
    supportText:'这不是简单贴 Logo。让产品真正被 Maker 拿去创造，把你的展位变成故事的一部分。欢迎提供产品、设备使用、材料、技术指导与活动资源。',
    supportTypes:[
      {icon:'⌘',title:'展位产品 / 硬件模块',text:'开发板、传感器、LED、驱动电机、屏幕、摄像头、线材、结构件。'},
      {icon:'⚒',title:'设备借用 / 共享工坊',text:'焊台、3D 打印机、仪表、工具、工作台与安全操作支持。'},
      {icon:'↗',title:'展商 / 技术导师',text:'自愿提供一件物资、展位任务或工程师现场技术支持。'},
      {icon:'✦',title:'经费 / 后勤 / 内容',text:'耗材、场地、现场执行、安全保障、奖品、拍摄与传播资源。'}
    ],
    supportCta:'查看赞助与展位合作详情 →',
    rulesTitle:'不是买齐零件再比赛。', rulesText:'没有预设 BOM、不能带预先完成的参赛整机；所有捐赠完全自愿，高价值设备通过共享借用机制保障公平。',
    rulesCta:'阅读参赛规则、评审、安全和完整日程 →',
    footnote:'由 Peter Pan’s Techland 独立策划；除非获得主办方明确批准，否则不属于 Maker Faire Shenzhen 官方赛事。'
  }
};

export default function ChallengePage(): React.JSX.Element {
  const {i18n} = useDocusaurusContext();
  const zh = i18n.currentLocale.startsWith('zh');
  const t = copy[zh ? 'zh' : 'en'];
  return (
    <Layout title="Makers Challenge 2026" description="Beg. Build. Show. — proposed Shenzhen Maker Faire 2026 community maker challenge and open sponsor call.">
      <main className={styles.page}>
        <div className={styles.topGrid} aria-hidden="true" />
        <section className={styles.hero}>
          <div className={styles.heroInner}>
            <div className={styles.eyebrow}>{t.eyebrow}</div>
            <div className={styles.heroSplit}>
              <div>
                <div className={styles.sticker}>MAKE<br/>SOMETHING<br/>RIDICULOUS <span>✳</span></div>
                <h1 className={styles.display}>{t.title.split('\n').map((line,i)=><React.Fragment key={line}>{i>0&&<br/>}{line}</React.Fragment>)}</h1>
                <p className={styles.lead}>{t.subtitle}</p>
                <div className={styles.actions}>
                  <Link className={styles.primaryButton} to="/docs/challenges/2026-shenzhen-maker-faire">{t.explore} ↗</Link>
                  <Link className={styles.secondaryButton} to="/docs/challenges/sponsors">{t.sponsor}</Link>
                </div>
              </div>
              <div className={styles.art} aria-hidden="true">
                <div className={styles.orbitOne} /><div className={styles.orbitTwo} />
                <div className={styles.artCore}><span>BEG</span><b>×</b><span>BUILD</span><b>×</b><span>SHOW</span></div>
                <div className={styles.artCorner}>2026 / SZ<br/>DIY OR DIE*<small>* SAFELY.</small></div>
              </div>
            </div>
            <div className={styles.status}><strong>↗ {t.status}</strong><span>{t.statusText}</span></div>
          </div>
        </section>
        <section className={styles.overview}>
          <div className={styles.sectionHeader}><span>01 / THE EVENT</span><h2>{t.firstTitle}</h2><p>{t.firstDescription}</p></div>
          <div className={styles.statGrid}>
            <div><strong>8–12</strong><span>{t.statTeams}</span></div>
            <div><strong>20–30</strong><span>{t.statBooths}</span></div>
            <div><strong>12.12—13</strong><span>{t.statDates}</span></div>
          </div>
        </section>
        <section className={styles.stageSection}>
          <div className={styles.sectionHeader}><span>02 / MISSION LOG</span><h2>{t.stepsTitle}</h2></div>
          <div className={styles.stageGrid}>{t.steps.map(s=><article className={styles.stage} key={s.num}><div className={styles.stageNum}>{s.num} / {s.word}</div><h3>{s.title}</h3><p>{s.text}</p></article>)}</div>
          <p className={styles.centerLink}><Link to="/docs/challenges/2026-shenzhen-maker-faire">{t.rulesCta}</Link></p>
        </section>
        <section className={styles.sponsorSection} id="sponsors">
          <div className={styles.sectionHeader}><span>{t.supportEyebrow}</span><h2 className={styles.sponsorHeadline}>{t.supportTitle.split('\n').map((line,i)=><React.Fragment key={line}>{i>0&&<br/>}{line}</React.Fragment>)}</h2><p>{t.supportText}</p></div>
          <div className={styles.sponsorGrid}>{t.supportTypes.map(s=><article key={s.title} className={styles.sponsorCard}><div className={styles.sponsorIcon}>{s.icon}</div><h3>{s.title}</h3><p>{s.text}</p></article>)}</div>
          <Link className={styles.primaryButton} to="/docs/challenges/sponsors">{t.supportCta}</Link>
        </section>
        <section className={styles.ruleBanner}><div><span>03 / FAIR PLAY</span><h2>{t.rulesTitle}</h2><p>{t.rulesText}</p></div><Link className={styles.secondaryButton} to="/docs/challenges/2026-shenzhen-maker-faire">{t.rulesCta}</Link></section>
        <div className={styles.disclaimer}>{t.footnote} <a href="https://www.shenzhenmakerfaire.com/" target="_blank" rel="noopener noreferrer">Maker Faire Shenzhen ↗</a></div>
      </main>
    </Layout>
  );
}
