import React from 'react';
import useBaseUrl from '@docusaurus/useBaseUrl';
import styles from './styles.module.css';

type GarageLoaderProps = {
  zh: boolean;
  progress?: number;
  completed?: number;
  total?: number;
  finishing?: boolean;
  className?: string;
};

export default function GarageLoader({zh, progress, completed, total, finishing = false, className = ''}: GarageLoaderProps): React.JSX.Element {
  const catUrl = useBaseUrl('/maker-garage-preview/loader-neko.svg');
  const determinate = typeof progress === 'number' && Number.isFinite(progress);
  const percent = determinate ? Math.min(100, Math.max(0, progress)) : 0;
  const hasCount = typeof completed === 'number' && Number.isFinite(completed) && typeof total === 'number' && Number.isFinite(total) && total > 0;
  const phase = finishing
    ? (zh ? '电量就绪，欢迎回家' : 'All powered up. Welcome in.')
    : (zh ? '把灵感点亮，再等一小会儿' : 'A little spark, a little magic. Almost there.');

  return (
    <div className={`${styles.loader} ${finishing ? styles.finishing : ''} ${className}`}>
      <div className={styles.bootLabel}><span className={styles.statusDot} /> CYBERNETICS <span className={styles.labelDivider}>/</span> BOOT SEQUENCE</div>
      <div className={styles.stage} aria-hidden="true">
        <span className={styles.stageCorner} />
        <img src={catUrl} alt="" width="240" height="208" draggable={false} className={styles.cat} />
        <span className={styles.serial}>NEKO / 01</span>
        <span className={styles.stageReadout}>♥ ONLINE</span>
      </div>
      <h2 className={styles.title}>{zh ? '给车库通个电' : 'Waking up the garage'}</h2>
      <p className={styles.subtitle}>{phase}</p>
      <div className={styles.progressArea}>
        <div className={styles.progressMeta}>
          <span>{zh ? '正在唤醒小世界' : 'Bringing the little world to life'}</span>
          <span className={styles.progressNumber}>{determinate ? `${Math.round(percent)}%` : (zh ? '连接中' : 'Connecting')}</span>
        </div>
        <div className={`${styles.track} ${determinate ? '' : styles.indeterminate}`} role="progressbar" aria-label={zh ? '车库加载进度' : 'Garage loading progress'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={determinate ? Math.round(percent) : undefined} aria-valuetext={determinate ? undefined : (zh ? '正在连接车库' : 'Connecting to the garage')}>
          <span className={styles.fill} style={determinate ? {width: `${percent}%`} : undefined} />
          <span className={styles.trackSegments} aria-hidden="true" />
        </div>
        <div className={styles.progressFoot}>
          <span>{zh ? '每个奇妙想法，都从一点电开始' : 'Every bright idea starts with a little spark'}</span>
          {hasCount && <span className={styles.count}>{completed} / {total}</span>}
        </div>
      </div>
    </div>
  );
}
