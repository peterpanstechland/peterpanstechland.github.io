import React, {useEffect, useRef, useState} from 'react';
import Link from '@docusaurus/Link';
import useBaseUrl from '@docusaurus/useBaseUrl';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import GarageLoader from '../GarageLoader';
import styles from './styles.module.css';

type AssetCounts = {
  loaded: number;
  total: number;
  failed: number;
  ready?: boolean;
  initial?: {completed: number; total: number};
};
type PreviewStatus = 'loading' | 'ready' | 'error';

function readCounts(data: unknown): AssetCounts | null {
  if (!data || typeof data !== 'object') return null;
  const message = data as Record<string, unknown>;
  if (message.type !== 'techland-garage-status') return null;
  const {loaded, total, failed} = message;
  if (![loaded, total, failed].every(value =>
    typeof value === 'number' && Number.isSafeInteger(value) && value >= 0,
  )) return null;
  if ((loaded as number) + (failed as number) > (total as number)) return null;
  const initial = message.initial as AssetCounts['initial'];
  const validInitial = initial &&
    Number.isSafeInteger(initial.completed) && Number.isSafeInteger(initial.total) &&
    initial.total > 0 && initial.total <= Number(total) &&
    initial.completed >= 0 && initial.completed <= initial.total;
  return {
    loaded: loaded as number, total: total as number, failed: failed as number,
    ready: typeof message.ready === 'boolean' ? message.ready : undefined,
    initial: validInitial ? {completed: initial.completed, total: initial.total} : undefined,
  };
}

export default function GarageHero({home = false}: {home?: boolean}): React.JSX.Element {
  const {i18n} = useDocusaurusContext();
  const zh = i18n.currentLocale === 'zh-Hans';
  const text = (en: string, cn: string) => zh ? cn : en;
  const sceneUrl = useBaseUrl('/maker-garage-preview/scene/');
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<PreviewStatus>('loading');
  const [counts, setCounts] = useState<AssetCounts | null>(null);
  const [showLoader, setShowLoader] = useState(true);

  useEffect(() => {
    if (status === 'loading') { setShowLoader(true); return; }
    if (status === 'error') { setShowLoader(false); return; }
    const exit = window.setTimeout(() => setShowLoader(false), 220);
    return () => window.clearTimeout(exit);
  }, [status]);

  useEffect(() => {
    setStatus('loading');
    setCounts(null);
    let timeout: number;
    let lastProgress = 0;
    const armTimeout = () => {
      window.clearTimeout(timeout);
      timeout = window.setTimeout(() => setStatus('error'), 45000);
    };
    armTimeout();
    const onMessage = (event: MessageEvent<unknown>) => {
      if (event.origin !== window.location.origin ||
          event.source !== frameRef.current?.contentWindow) return;
      const next = readCounts(event.data);
      if (!next) return;
      setCounts(next);
      const progress = next.loaded + next.failed;
      if (progress > lastProgress) { lastProgress = progress; armTimeout(); }
      if (next.loaded > 0 && next.ready !== false) {
        window.clearTimeout(timeout);
        setStatus('ready');
      } else if (next.total > 0 && next.failed === next.total) {
        window.clearTimeout(timeout);
        setStatus('error');
      }
    };
    window.addEventListener('message', onMessage);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener('message', onMessage);
    };
  }, [attempt]);

  const reload = () => {
    setShowLoader(true);
    setStatus('loading');
    setCounts(null);
    setAttempt(value => value + 1);
  };
  const boot = counts?.initial;
  const bootProgress = boot ? Math.round(boot.completed / boot.total * 100) : undefined;
  const statusText = status === 'error'
    ? text('Preview unavailable', '预览暂不可用')
    : status === 'loading'
      ? text('Opening the garage…', '正在打开车库…')
      : home ? text('LIVE GARAGE', '互动创客车库') : text('LIVE PREVIEW', '交互预览');
  const loadingDescription = counts && counts.total > 0
    ? text(`${counts.loaded} of ${counts.total} assets loaded.`, `已载入 ${counts.loaded} / ${counts.total} 个资产。`)
    : statusText;
  const destinations = [
    {to: '/docs/projects', en: 'Projects', zh: '项目作品'},
    {to: '/blog', en: 'Blog', zh: '科技日记'},
    {to: '/challenge', en: 'Challenge', zh: '创客挑战'},
    {to: '/docs/guides', en: 'Guides', zh: '技术指南'},
    {to: '/docs/about', en: 'About Peter', zh: '认识彼得潘'},
  ];

  return (
      <div className={`${styles.page} ${home ? styles.home : ''}`}>
        <section className={styles.hero} aria-labelledby="garage-headline">
          <header className={styles.heroCopy}>
            <p className={styles.eyebrow}>{home ? text('WELCOME TO MY LITTLE UNIVERSE', '欢迎来到我的小宇宙') : text('A MAKER’S PLAYGROUND IN SHENZHEN', '深圳 · 创客的游乐场')}</p>
            <h1 id="garage-headline" className={styles.headline} aria-label="MADE OF IDEAS. BUILT BY HAND.">
              <span>MADE OF</span>{' '}
              <strong>IDEAS.</strong>{' '}
              <span className={styles.headlineLast}>BUILT BY HAND.</span>
            </h1>
            <p className={styles.intro}>{home ? text(
              "I'm Peter Pan. I build robots, interactive machines, and unusual things with AI. Come have a look around.",
              '我是彼得潘。我用 AI、机器人和各种硬件捣鼓稀奇古怪的东西。欢迎来我的车库逛逛。',
            ) : text(
              'A cyber maker garage. Robots, tools, and everyday experiments. Same world. More to build.',
              '把想法造出来。机器人、电子工具和日常创客实验，都从这里开始。',
            )}</p>
            <div className={styles.actions}>
              <a className={styles.primaryAction} href="#garage-scene">
                <span aria-hidden="true">↗</span>{text('ENTER THE GARAGE', '走进车库')}
              </a>
              <Link className={styles.secondaryAction} to="/blog">
                {text('READ THE BLOG', '阅读科技日记')}<span aria-hidden="true">→</span>
              </Link>
            </div>
            <p className={styles.previewLabel}>
              <span className={styles.signal} aria-hidden="true" />
              CYBER MAKER GARAGE <span aria-hidden="true">/</span> {home ? text('EXPLORE', '自由探索') : text('PREVIEW', '制作预览')}
            </p>
          </header>

          <section id="garage-scene" className={styles.viewer} aria-label={text('Interactive garage preview', '交互式车库预览')}>
            <div className={styles.stage}>
              <iframe
                key={attempt}
                ref={frameRef}
                className={styles.frame}
                src={`${sceneUrl}?lang=${encodeURIComponent(i18n.currentLocale)}&embedded=1&v=mobile-garage-v1`}
                title={text('Cyber Maker Garage 3D scene', '赛博创客车库 3D 场景')}
                aria-describedby="garage-controls"
                loading="eager"
                allow="camera 'self'"
                allowFullScreen
                onError={() => setStatus('error')}
              />
              {showLoader && status !== 'error' && (
                <div className={`${styles.loading} ${status === 'ready' ? styles.loadingLeaving : ''}`}>
                  <GarageLoader zh={zh} progress={bootProgress} completed={boot?.completed}
                    total={boot?.total} finishing={status === 'ready'} />
                </div>
              )}
              {status === 'error' && (
                <div className={styles.errorCard} role="alert">
                  <span className={styles.errorLabel}>{text('PREVIEW UNAVAILABLE', '预览暂时不可用')}</span>
                  <h2>{text('Let’s try opening it again.', '再试一次，打开车库。')}</h2>
                  <p>{text(
                    'Reload the scene, or explore the projects and stories below.',
                    '可以重新载入，也可以通过下方入口继续探索作品与故事。',
                  )}</p>
                  <button type="button" onClick={reload} className={styles.primaryButton}>
                    {text('Try again', '重新载入')} <span aria-hidden="true">↻</span>
                  </button>
                </div>
              )}
            </div>
            <div className={styles.viewerTools}>
              <div className={styles.status} title={loadingDescription}>
                <span className={`${styles.statusDot} ${status === 'ready' ? styles.statusReady : ''} ${status === 'error' ? styles.statusError : ''}`} aria-hidden="true" />
                <span>{statusText}</span>
              </div>
              <a className={styles.expandButton}
                href={`${sceneUrl}?lang=${encodeURIComponent(i18n.currentLocale)}&v=mobile-garage-v1`}
                target="_blank" rel="noopener noreferrer"
                aria-label={text('Open an immersive garage view', '打开沉浸车库视图')}>
                <span aria-hidden="true">⤢</span>{text('Expand', '展开')}
              </a>
              <button type="button" onClick={reload} className={styles.reloadButton}
                title={text('Reload preview', '刷新预览')} aria-label={text('Reload preview', '刷新预览')}>↻</button>
            </div>
            <span className={styles.srOnly} role="status" aria-live="polite" aria-atomic="true">
              {loadingDescription}
              {counts && counts.failed > 0 && text(` ${counts.failed} assets unavailable.`, ` ${counts.failed} 项暂不可用。`)}
            </span>
          </section>

          <p id="garage-controls" className={styles.interactionHint}>
            <span aria-hidden="true">↔</span>
            {text('Drag to explore. Scroll or pinch to zoom.', '拖动环顾，滚轮或双指缩放。')}
            <span className={styles.assetHint}>
              {text('Open “Assets” in the scene for production status.', '打开场景内的「资产清单」查看制作状态。')}
            </span>
          </p>
        </section>
        <nav className={styles.destinations} aria-label={text('Explore Techland', '探索科技谷')}>
          <p>{text('SAME WORLD. MORE TO BUILD.', '同一个世界，还有更多值得造。')}</p>
          <div className={styles.destinationLinks}>
            {destinations.map(destination => (
              <Link key={destination.to} to={destination.to} className={styles.destination}>
                {zh ? destination.zh : destination.en}<span aria-hidden="true">↗</span>
              </Link>
            ))}
          </div>
        </nav>
      </div>
  );
}
