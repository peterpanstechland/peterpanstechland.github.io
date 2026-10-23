// Curated entry points into existing bilingual articles, never model-generated links.
export const vendingProjects = [
  {slot:'A1',title:'Roomba-VLLM',category:['ROBOTICS','机器人'],path:'/docs/hackathons/2026/roomba-vllm/',image:'/img/hackathons/2026/roomba-vllm-robot-hero.png',description:['A Roomba, a Jetson and a vision-language model: the build story of a cyber butler at a Shenzhen hackathon.','把 Roomba、Jetson 和视觉语言模型装到一起：一台赛博管家的黑客松制作记录。']},
  {slot:'A2',title:'VoiceButler',category:['VOICE × EDGE AI','语音 × 边缘 AI'],path:'/docs/projects/2026/voicebutler-jetson/',image:'/img/projects/2026/voicebutler-rig-top.jpg',description:['An offline Chinese voice assistant on Jetson: wake word, speech recognition, local language model and speech synthesis.','在 Jetson 上跑通离线中文对话：从唤醒词、语音识别，到本地大模型和语音合成。']},
  {slot:'B1',title:'Apex Hand',category:['DEXTEROUS HAND','灵巧手'],path:'/docs/hackathons/2026/aix-origin-apex-hand/',image:'/img/hackathons/2026/apex-hand/aix-origin-demo-show.jpg',description:['From Isaac Lab to a real dexterous hand: teleoperation, the Kapandji test and baoding-ball rotation. Explore the five-part series.','从 Isaac Lab 仿真到真实灵巧手：遥操作、拇指对掌测试与转保定球。进入五篇实战系列。']},
  {slot:'B2',title:'Cyber Boss',category:['AI AGENTS','AI 智能体'],path:'/docs/hackathons/2026/cyber-boss/',image:'/img/hackathons/2026/cyber-boss-hero.png',description:['Meet Tie-ge, the AI boss built with OpenClaw and Feishu: assigning tasks, chasing deadlines and running a one-person company.','用 OpenClaw 和飞书做一个会派活、催进度的 AI 老板「铁哥」，看看一人公司的工作流。']},
  {slot:'C1',title:'PanoTwin',category:['3D VISION · WIP','三维视觉 · 持续制作'],path:'/docs/projects/2026/panotwin-jetson-x5/',image:'/img/hackathons/2026/roomba-vllm-my-workshop.png',description:['Building an edge-side digital twin with Jetson and Insta360 X5: fisheye calibration, panoramic depth and Gaussian splatting. Measurements remain in progress.','用 Jetson 和影石 X5 重建房间：鱼眼标定、全景深度与高斯泼溅。性能复测仍在进行中。']},
  {slot:'C2',title:'Courtside IQ',category:['BASKETBALL × AWS','篮球 × AWS'],path:'/docs/hackathons/2026/courtside-iq/',image:'/img/hackathons/2026/courtside-iq/host-workspace.png',description:['A basketball commentary desk led by a human host, with AI-assisted evidence and an interactive AWS architecture walkthrough.','由真人主持、AI 辅助找证据的篮球解说工作台，以及可以交互探索的 AWS 架构。']},
];

export function projectArticlePath(project, zh) {
  return `${zh ? '/zh-Hans' : ''}${project.path}`;
}

export function createProjectVending(zh) {
  const lang=zh?1:0;
  const dialog=document.createElement('dialog');
  dialog.id='project-vending';dialog.setAttribute('aria-labelledby','vending-title');
  // All variable content below is assigned as text, attributes or local URLs.
  dialog.innerHTML=`<button class="vending-close" type="button">×</button>
    <header><span class="vending-kicker">PETER PAN’S TECHLAND / PROJECTS</span><h2 id="vending-title"></h2><p class="vending-intro"></p></header>
    <div class="vending-body"><div class="vending-slots" role="group"></div>
    <section class="vending-selection" aria-live="polite" aria-atomic="true"><div class="vending-photo"><img alt=""><span class="vending-number"></span></div><p class="vending-category"></p><h3></h3><p class="vending-description"></p><a class="vending-read" target="_top"></a></section></div>
    <footer><span>06 / READY</span><a class="vending-all" target="_top"></a></footer>`;
  const find=(s)=>dialog.querySelector(s);
  find('.vending-close').setAttribute('aria-label',zh?'关闭项目贩卖机':'Close project vending machine');
  find('#vending-title').textContent=zh?'挑一个项目，看看怎么做的。':'Pick a project. See how it was made.';
  find('.vending-intro').textContent=zh?'选择货位，阅读我的制作故事与实战记录。':'Choose a slot for a build story from my workshop.';
  find('.vending-slots').setAttribute('aria-label',zh?'选择项目货位':'Choose a project slot');
  find('.vending-all').textContent=zh?'浏览全部文章 ↗':'Browse all articles ↗';
  find('.vending-all').href=`${zh?'/zh-Hans':''}/docs/projects/`;
  const buttons=[];
  function select(project) {
    buttons.forEach((button)=>button.setAttribute('aria-pressed',String(button.dataset.slot===project.slot)));
    const photo=find('.vending-photo img');photo.hidden=false;photo.src=project.image;photo.alt=project.title;
    find('.vending-number').textContent=project.slot;
    find('.vending-category').textContent=project.category[lang];find('h3').textContent=project.title;
    find('.vending-description').textContent=project.description[lang];
    find('.vending-read').textContent=zh?'阅读这篇文章 →':'Read the article →';
    find('.vending-read').href=projectArticlePath(project,zh);
  }
  for(const project of vendingProjects) {
    const button=document.createElement('button');button.type='button';button.className='vending-slot';button.dataset.slot=project.slot;
    const code=document.createElement('span');code.className='slot-code';code.textContent=project.slot;
    const title=document.createElement('strong');title.textContent=project.title;
    const category=document.createElement('small');category.textContent=project.category[lang];
    button.append(code,title,category);button.addEventListener('click',()=>select(project));
    buttons.push(button);find('.vending-slots').append(button);
  }
  find('.vending-photo img').addEventListener('error',(event)=>{event.currentTarget.hidden=true;});
  find('.vending-close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',(event)=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
  document.body.append(dialog);select(vendingProjects[0]);
  // Native dialog handles Escape, focus containment and focus return on close.
  return {open(){if(!dialog.open)dialog.showModal();},isOpen:()=>dialog.open};
}
