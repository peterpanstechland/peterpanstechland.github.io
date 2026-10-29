// Current bench wiring, 2026-10-29. Teaching only; no device requests or credentials.
export const boards = {
  xiao: {label:'XIAO ROBOT BOARD',version:'V1.0 · 2026-10-29 接线',first:'climate'},
  indicator: {label:'SENSECAP INDICATOR D1',version:'D1 · 土壤 / 内置蜂鸣器',first:'indicator-adc'},
};
const doc='/docs/projects/2026/roboplanter/hardware-wiring';
export const routes=[
  {
    id:'water',board:'xiao',port:'SERVO2',title:'超声波水箱距离',kind:'water',protocol:'单 SIG / 3.3 V',
    status:'测距已验证 · 水箱待标定',line:'“先量距离，再谈还有多少水。”',
    address:'J5 pin1 · D9 / GPIO8 · Grove Ultrasonic Ranger v2.0',
    pins:[['power','独立 3.3 V','红线 VCC','3V3'],['ground','公共 GND','黑线 GND'],['signal','GPIO8 / J5 pin1','黄线 SIG'],['unused','白线 / Servo 5V','不接']],
    steps:[
      ['先移除旧 Air 模块','SERVO2已改接Grove Ultrasonic Ranger v2.0。红线另接3.3V、黑线共地、白线不接，不沿用Servo的5V电源。'],
      ['一个 SIG 负责触发和回波','黄线SIG接D9/GPIO8。不是I²C模块，也不是HC-SR04的TRIG/ECHO两线；M2/J9不使用。'],
      ['先移动平面，再装水箱','距离随平面移动已通过。探头保持干燥；水箱完成后测满水、空箱和停泵三个距离。未标定不报余水百分比。'],
    ],
    caution:'当前水箱未完成，探头不浸水；示意液面不是实际安装或水位测量。',doc,
  },
  {
    id:'climate',board:'xiao',port:'IIC1',title:'SEN54 环境感知',kind:'climate',protocol:'I²C 0x69 / 独立 5 V',
    status:'温湿度 / PM2.5 / VOC 已接通',line:'“一个模块，照看工位的空气。”',
    address:'J11或J12 · SDA GPIO5 / SCL GPIO6 · 信号3.3V',
    pins:[['external','独立 5 V','SEN54 红线 VCC'],['ground','公共 GND','黑线 GND'],['signal','GPIO5 / pin2 SDA','SDA'],['signal2','GPIO6 / pin1 SCL','SCL'],['unused','IIC pin3 的3.3V','与模块红线分离']],
    steps:[
      ['供电单独取 5V','SEN54本体需要4.5–5.5V，不能整根Grove线插IIC的3.3V供电。红线分离接5V，黑线共地，信号上拉保持3.3V。'],
      ['接原 I²C 总线','SDA接GPIO5，SCL接GPIO6，地址0x69。IIC1/IIC2共总线，可任选一个；不能改作打印UART。'],
      ['替代 DHT20 和旧 Air','温湿度、PM2.5、VOC已经有效显示。旧DHT20和Air Quality可拆下备用；SEN54不提供CO₂或NOx，VOC不是ppm。'],
    ],
    caution:'5V不得反灌IIC的3.3V电源脚。图中外置5V支路与信号线分开。',doc,
  },
  {
    id:'light',board:'xiao',port:'RGB',title:'WS2813 氛围灯',kind:'light',protocol:'DATA / 5 V',
    status:'10颗 · 亮度24/255',line:'“嘴上说没事，灯先呼吸了。”',
    address:'J7 · D13 / GPIO40 → 板载缓冲 → DIN',
    pins:[['power','适配的 5 V','灯带 5V'],['ground','公共 GND','灯带 GND'],['signal','J7 pin1 / GPIO40','DIN'],['unused','其他信号按灯带实物','不混接 DIN / DOUT']],
    steps:[
      ['保留已验收的低亮度配置','当前为10颗Grove WS2813，亮度上限24/255。核对灯带供电和总电流，不把所有Grove灯条当成同一协议。'],
      ['找输入箭头 DIN','GPIO40经板载缓冲从RGB口输出，接灯带输入端。电源和地按已验证线束连接，不能接输出端。'],
      ['本地效果与语音分开验证','常亮、呼吸、流动、彩虹代码已有。本地开关已记录；手机YOYO开关与情绪联动仍需单独验收。'],
    ],
    caution:'网页灯效为教学动画，不连接真实灯带；不是标定过的植物生长灯。',doc:'/docs/projects/2026/roboplanter/ws2812-lighting',
  },
  {
    id:'printer',board:'xiao',port:'SERVO4 + UART RX',title:'EM5826H 小票打印',kind:'printer',protocol:'TTL UART / 独立 12 V',
    status:'中文 / 128行比例 / 切纸已通过',line:'“给今天留一张摸得着的回应。”',
    address:'J14 pin1 D8/GPIO7 → 打印RX；J10 pin2 GPIO44 ← 打印TX',
    pins:[['external','独立 12 V','打印机电源'],['ground','公共 GND','打印机 GND'],['signal','D8 / GPIO7 / SERVO4','打印机 RX'],['signal2','UART RX / GPIO44','打印机 TX（3.3V）','UART'],['unused','GPIO43 / Servo5V','不接打印机']],
    steps:[
      ['打印机独立供电','12V电源只接打印机电源端，共地。本机返回TX已由资料确认3.3V；其他型号先核对电平，不能给Grove脚接12V。'],
      ['发送改到 D8，避开启动日志','SERVO4/GPIO7由固件映射为发送，接打印RX；打印TX返回原UART GPIO44。GPIO43留空，SERVO4不再接泵。'],
      ['预览、出纸和切刀逐项观察','中文、Logo、状态、待办、78牌日签和自动切纸已通过。128行光栅修正压扁，Indicator七页预览与纸面一致。'],
    ],
    caution:'接返回线不等于已实现缺纸或机械反馈；超时只查原请求，不自动重印。',doc:'/docs/projects/2026/roboplanter/uart-printer',
  },
  {
    id:'soil',board:'xiao',port:'SERVO3',title:'Light v1.2 环境光',kind:'lux',protocol:'模拟 ADC / 3.3 V',
    status:'遮挡 / 照亮变化已通过',line:'“今天工位的光，先看真实变化。”',
    address:'J13 pin1 · D0 / GPIO1 · 已替换 UV',
    pins:[['power','独立 3.3 V','红线 VCC','3V3'],['ground','公共 GND','黑线 GND'],['signal','GPIO1 / J13 pin1','黄线 OUT'],['unused','白线 / Servo5V','不接']],
    steps:[
      ['这里接光照，土壤在屏幕端','当前Light Sensor v1.2替代UV。红线另取3.3V，黑线共地，白线不接；Servo电源是5V，不能整根直插。'],
      ['黄线进 GPIO1','OUT接SERVO3/D0/GPIO1。该脚只接这一只模拟输出，不能再并接土壤或UV。'],
      ['遮住，再照亮','Indicator环境光页面已确认随明暗变化。只报告原始ADC，不加lux或PAR单位。'],
    ],
    caution:'土壤探头已移到Indicator的RP2040 GPIO27，不能按旧图接回SERVO3。',doc,
  },
  {
    id:'pump',board:'xiao',port:'SERVO1',title:'Grove Relay v1.2',kind:'pump',protocol:'GPIO42 / 高电平吸合',
    status:'12V / 150mA泵已接 · 待水箱',line:'“水箱做好、校准完成，再测试浇水。”',
    address:'J1 pin1 · D15 / GPIO42 → Relay SIG',
    pins:[['power','已确认的3.3–5V','Relay VCC'],['ground','公共 GND','Relay GND'],['signal','GPIO42 / J1 pin1','Relay SIG'],['power','两颗常开负载端子','独立12V泵回路']],
    steps:[
      ['独立12V负载供电','用户确认泵已接、铭牌150mA。12V正极经继电器常开触点接泵正极，泵负极接12V负极，12V不接Grove电源脚。'],
      ['控制改到 SERVO1','SIG接D15/GPIO42，高电平吸合。SERVO4/GPIO7已经用于打印，M2/J9也不使用。'],
      ['等待实体水箱与校准','空载吸合已验证，泵保持禁用。水箱做好后从Indicator设置采满水、缺水和空箱距离；另需检查启动电流、保护与进水条件，再进行负载测试。'],
    ],
    caution:'接线已确认不等于带水运行已通过；校准工具不会启动水泵，软件保护不能代替负载试验。',doc,
  },
  {
    id:'air',board:'xiao',port:'IIC2',title:'共用 I²C 预留口',kind:'reserved',reserved:true,protocol:'同 GPIO5 / GPIO6',
    status:'预留 · 非独立总线',line:'“空位留着，不必为了插满而接。”',
    address:'J12 · 与IIC1和板载IMU共用I²C；SEN54可择一接入',
    pins:[['unused','IIC2未使用时','留空'],['unused','板口电源3.3V','不能给SEN54直接供电']],
    steps:[
      ['确认总线供电','IIC1和IIC2都是3.3V口，SEN54仍需另取5V。空余插座不用接线。'],
      ['共用总线，不改 UART','GPIO5/6还连接板载IMU，不能牺牲其中一个插座改作打印串口。新增模块核对地址和逻辑电平。'],
      ['只核对预留状态','旧DHT20和Air Quality已被SEN54替代，不需要为了显示温湿度再接回。这里的练习仅确认留空。'],
    ],
    caution:'两个IIC口并非两条独立总线；不能互接Indicator的I²C口。',doc,
  },
  {
    id:'indicator-adc',board:'indicator',port:'Grove ADC',title:'电容式土壤探头',kind:'soil',protocol:'RP2040 GPIO27 / 3.3 V',
    status:'上传 + YOYO读取已通过',line:'“数据走无线，根留在土里。”',
    address:'Indicator左侧Grove黄线 → RP2040 GPIO27',
    pins:[['power','3.3 V','传感器 VCC'],['ground','GND','传感器 GND'],['signal','RP2040 GPIO27','黄线模拟 OUT'],['unused','白线 GPIO26','不用']],
    steps:[
      ['认准 Indicator 的 ADC 口','两个Grove口归RP2040，不是屏幕ESP32的GPIO。土壤传感器按3.3V供电，模拟OUT不能超过3.3V。'],
      ['只接 GPIO27 这一通道','黄色信号接GPIO27，白线GPIO26不用。RP2040程序经内部UART向屏幕发送带校验的采样。'],
      ['沿真实链路读一遍','屏幕通过Wi-Fi HTTP上传XIAO，YOYO再用加密BLE读取。链路已通过，土壤未标定，因此仅显示原始值。'],
    ],
    caution:'两板无需外部串口/I²C线。D1内置GPIO19无源蜂鸣器已接好，提示音默认关闭，听音待测。',doc,
  },
  {
    id:'indicator-i2c',board:'indicator',port:'Grove I²C',title:'RP2040 扩展预留',kind:'reserved',reserved:true,protocol:'SDA20 / SCL21',
    status:'当前留空',line:'“温湿度由SEN54负责，这里先留白。”',
    address:'RP2040 GPIO20 SDA / GPIO21 SCL，与Robot总线独立',
    pins:[['unused','Grove I²C','当前不接模块']],
    steps:[
      ['当前没有额外模块','D1环境数据来自Robot上的SEN54，不需要在这里重复接DHT20。'],
      ['保持两板总线独立','两块板通过Wi-Fi通信，不把I²C直接互接。未来扩展先确认模块电压、地址和驱动。'],
      ['确认留空即可','土壤走另一侧ADC口；内置蜂鸣器使用RP2040 GPIO19，不占这个Grove插座。'],
    ],
    caution:'扩展预留不是已接通的传感器功能。',doc,
  },
];
