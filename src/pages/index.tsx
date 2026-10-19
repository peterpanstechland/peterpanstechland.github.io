import React, {useEffect, useRef, useState} from 'react';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import styles from './index.module.css';

type PortalId = 'projects' | 'blog' | 'challenge' | 'guides' | 'workshop' | 'luckycat' | 'pan' | 'flipfate' | 'bmo' | 'roomba' | 'courtside';
type SceneMessage = {channel?: string; type?: string; id?: PortalId};
const portals: Record<PortalId,{to:string;en:string;zh:string;descriptionEn:string;descriptionZh:string;index:string}> = {
  luckycat:{to:'/docs/about',en:'NEKO / Garage Host',zh:'赛博招财猫 NEKO',descriptionEn:'The resident lucky cat waves hello — and welcomes new makers into the garage.',descriptionZh:'会挥手的赛博招财猫，是整间创客车库的迎宾店长。',index:'✦'},
  pan:{to:'/docs/hackathons/2026/aix-origin-apex-hand',en:'PΛN / AI Mixologist',zh:'PΛN 智能调酒机器人',descriptionEn:'An interactive robotic bartender with a retro telephone, dexterous hand and AI personality.',descriptionZh:'结合老式电话、灵巧手、AI 交互和饮品调制的具身智能机器人。',index:'05'},
  flipfate:{to:'/docs/projects',en:'FlipFate / Tarot Machine',zh:'FlipFate AI 翻牌机',descriptionEn:'A playful physical tarot experience with card flips, AI interpretation and printed receipts.',descriptionZh:'机械翻牌、AI 解读和热敏小票融合的互动硬件作品。',index:'06'},
  bmo:{to:'/docs/projects',en:'BMO / AI Companion',zh:'BMO 智能陪伴',descriptionEn:'A quirky, expressive, little screen-faced AI companion character.',descriptionZh:'结合 AI 语音与可爱外形的互动陪伴角色。',index:'07'},
  roomba:{to:'/docs/hackathons/2026/roomba-vllm',en:'Roomba-VLLM / Cameraman',zh:'Roomba 智能摄影机器人',descriptionEn:'A roaming, camera-equipped robotic companion with local VLM intelligence.',descriptionZh:'Roomba 底盘、相机与本地视觉大模型打造的移动摄影助手。',index:'08'},
  courtside:{to:'/docs/hackathons/2026/courtside-iq',en:'Courtside IQ / NBA AI',zh:'Courtside IQ · NBA AI 分析台',descriptionEn:'A basketball broadcast companion that turns footage and data into useful story cues.',descriptionZh:'从篮球比赛画面和数据提取解说线索的 AI 工作台。',index:'09'},
  workshop:{to:'/docs/about',en:'The Maker Garage',zh:'赛博创客车库',descriptionEn:'Welcome to the workshop. AI, hardware, experiments and a little creative chaos.',descriptionZh:'欢迎进入创客车库：AI、硬件、实验，以及恰到好处的混乱。',index:'00'},
  projects:{to:'/docs/projects',en:'Projects',zh:'项目作品',descriptionEn:'Meet the robots, interactive installations and AI-powered oddities built here.',descriptionZh:'在这里认识机器人、交互装置，以及各种 AI 驱动的怪东西。',index:'01'},
  blog:{to:'/blog',en:'The Techland Journal',zh:'科技日记',descriptionEn:'Maker culture, experiments, build logs, reflections and creative detours.',descriptionZh:'创客文化、实验记录、踩坑总结，以及层出不穷的脑洞。',index:'02'},
  challenge:{to:'/challenge',en:'Makers Challenge',zh:'创客挑战',descriptionEn:'BEG. BUILD. SHOW. Turn found parts and community help into a working demo.',descriptionZh:'化缘、造物、开演。把全场找来的零件变成一个真实 Demo。',index:'03'},
  guides:{to:'/docs/guides',en:'Guides & Blueprints',zh:'技术指南',descriptionEn:'Schematics, practical tutorials and reusable lessons from the workbench.',descriptionZh:'从接线图到可复用的技术教程，记录动手过程。',index:'04'},
};
const portalOrder:PortalId[] = ['projects','blog','challenge','guides'];

export default function Home(): React.JSX.Element {
  const {i18n} = useDocusaurusContext();
  const zh = i18n.currentLocale === 'zh-Hans';
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [ready,setReady] = useState(false);
  const [entered,setEntered] = useState(false);
  const [selected,setSelected] = useState<PortalId|null>(null);
  const [reducedMotion,setReducedMotion] = useState(false);
  const send = (action:'enter'|'reset'|'focus',id?:PortalId) => {
    if(typeof window !== 'undefined')frameRef.current?.contentWindow?.postMessage(
      {channel:'techland-maker-house',action,id},window.location.origin
    );
  };
  useEffect(()=>{
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(motion.matches);
    const onMessage = (event:MessageEvent<SceneMessage>)=>{
      if(event.origin!==window.location.origin || event.source!==frameRef.current?.contentWindow || event.data?.channel!=='techland-maker-house')return;
      if(event.data.type==='ready')setReady(true);
      if(event.data.type==='select' && event.data.id && portals[event.data.id]){
        setSelected(event.data.id);
        setEntered(true);
      }
    };
    window.addEventListener('message',onMessage);
    return ()=>window.removeEventListener('message',onMessage);
  },[]);
  const goIn = () => {setEntered(true);setSelected(null);send('enter');};
  const reset = () => {setEntered(false);setSelected(null);send('reset');};
  const active = selected ? portals[selected] : null;
  const lang = (en:string,cn:string)=>zh?cn:en;
  return <Layout
    title={lang('The Cyber Maker Garage','赛博创客车库')}
    description={lang("Peter Pan's Techland: an interactive maker universe of AI, robotics, creative coding and hardware.","彼得潘的科技谷：一个关于 AI、机器人、创意编程与开源硬件的互动创客宇宙。")}>
    <main className={styles.page}>
      <section className={styles.world} aria-labelledby="hero-heading">
        <div className={styles.worldBackdrop} aria-hidden="true"/>
        <iframe className={styles.worldFrame} ref={frameRef} title={lang('Interactive cyber maker garage','交互式赛博创客车库')} src="/maker-house/scene.html" loading="eager"/>
        <div className={styles.edgeFade} aria-hidden="true"/>
        <div className={styles.hudTop}>
          <span className={styles.microLabel}><span className={styles.signal}/> PETER PAN'S TECHLAND <span className={styles.separator}>/</span> WORLD 001</span>
          <span className={styles.location}>{lang('SHENZHEN • 3D MAKER GARAGE','深圳 · 3D 创客车库')}</span>
        </div>
        {!entered && <div className={styles.intro}>
          <p className={styles.introEyebrow}>{lang('WELCOME TO MY LITTLE UNIVERSE','欢迎来到我的小宇宙')}</p>
          <h1 id="hero-heading">MADE OF <em>IDEAS.</em><span>BUILT BY HAND.</span></h1>
          <p className={styles.introText}>{lang(
            "I'm Peter Pan. I build robots, interactive machines, and unusual things with AI. Come have a look around.",
            '我是彼得潘。我用 AI、机器人和各种硬件捣鼓稀奇古怪的东西。欢迎来我的车库逛逛。'
          )}</p>
          <div className={styles.introActions}>
            <button type="button" onClick={goIn} className={styles.enterButton}>{lang('ENTER THE GARAGE','进入创客车库')} <span aria-hidden="true">↗</span></button>
            <Link className={styles.skipLink} to="/blog">{lang('JUST READ THE BLOG','直接看博客')} <span aria-hidden="true">→</span></Link>
          </div>
        </div>}
        {entered && <div className={styles.exploreHint}>
          <span className={styles.miniLabel}>EXPLORE MODE / 01</span>
          <strong>{lang('Welcome inside.','欢迎进来。')}</strong>
          <span>{lang('Tap a neon sign, pet the lucky cat, or explore a project.','点击霓虹招牌、招财猫，或者探索一个真实项目。')}</span>
          <button onClick={reset} type="button">{lang('← BACK TO ENTRANCE','← 返回入口')}</button>
        </div>}
        {selected && active && <aside className={styles.selection} aria-label={lang('Selected destination','已选择的入口')}>
          <button onClick={()=>setSelected(null)} className={styles.dismiss} type="button" aria-label="Close">×</button>
          <span className={styles.miniLabel}>FOUND / {active.index}</span>
          <h2>{zh?active.zh:active.en}</h2>
          <p>{zh?active.descriptionZh:active.descriptionEn}</p>
          <Link to={active.to} className={styles.openDestination}>{lang('OPEN SECTION','打开栏目')} <span aria-hidden="true">↗</span></Link>
        </aside>}
        <div className={styles.hudBottom}>
          <p className={styles.controls}>{ready ? lang('DRAG TO LOOK · TAP THE CHARACTERS','拖动探索 · 点击可爱角色和项目') : lang('THE GARAGE IS LOADING…','车库加载中…')}{reducedMotion ? lang(' · REDUCED MOTION',' · 低动态模式') : ''}</p>
          <div className={styles.portalBar} aria-label={lang('Quick navigation','快捷导航')}>
            {portalOrder.map(id=><Link key={id} to={portals[id].to} className={styles.portalLink}>
              <span className={styles.portalNumber}>{portals[id].index}</span>
              {zh?portals[id].zh:portals[id].en}
              <span className={styles.portalArrow}>↗</span>
            </Link>)}
          </div>
        </div>
      </section>
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