// Teaching assignments, checked against the supplied Robot Board V1.0 schematic
// and Seeed's original SenseCAP Indicator RP2040 Grove documentation.
// No device state, credentials, discovery, or hardware commands belong here.
export const boards = {
  xiao: { label: 'XIAO ROBOT BOARD', version: 'V1.0 · 4 Grove + 4 Servo', first: 'water' },
  indicator: { label: 'SENSECAP INDICATOR', version: '原款 480 × 480 · 2 Grove / RP2040', first: 'indicator-adc' },
};
const quickstart = '/docs/projects/2026/roboplanter/hardware-quickstart';
export const routes = [
  {
    id: 'water', board: 'xiao', port: 'IIC2', title: '水箱水位', kind: 'water', protocol: 'I²C / 3.3 V',
    status: '规划 · 驱动待实现', line: '“老板，饮水机还有多少存款？”',
    address: 'SDA GPIO5 · SCL GPIO6 / 与 IIC1 共用总线',
    pins: [['power', '3.3 V', '模块 VCC'], ['ground', 'GND', '模块 GND'], ['signal', 'GPIO5 · SDA', '模块 SDA'], ['signal2', 'GPIO6 · SCL', '模块 SCL']],
    steps: [
      ['先确认它装得下', '候选为 Grove 电容式 Water Level Sensor 10cm。检测范围 10cm，整板长 133mm；先量水箱，再定型号。断电后核对 3.3V 和 GND。'],
      ['接到同一条 I²C 总线', 'SDA → GPIO5，SCL → GPIO6。这款模块同时使用 0x77 和 0x78 两个地址；IIC1 / IIC2 是同一条总线的两个插座。'],
      ['空箱、半箱、满箱都要试', '水位驱动、标定及低水位停泵还需实现。用实际水箱验证读数，并测试传感器掉线；掉线应显示“未知”，不能当成空箱。'],
    ],
    caution: '普通 Grove 超声波使用数字 SIG，不能直接套用这个 I²C 接法。图中液面仅为教学示意。',
    doc: 'https://wiki.seeedstudio.com/Grove-Water-Level-Sensor/', docLabel: '候选水位模块官方规格 ↗',
  },
  {
    id: 'climate', board: 'xiao', port: 'IIC1', title: '空气温湿度', kind: 'climate', protocol: 'I²C / 3.3 V',
    status: '可选驱动 · 待实测', line: '“我怕热，也怕你闷着。”',
    address: 'SHT31 候选 · 0x44 / 0x45 · GPIO5 / GPIO6',
    pins: [['power', '3.3 V', 'VCC'], ['ground', 'GND', 'GND'], ['signal', 'GPIO5 · SDA', 'SDA'], ['signal2', 'GPIO6 · SCL', 'SCL']],
    steps: [
      ['先认芯片，再接电', '现有可选驱动针对 SHT31。先核对你手上的型号和 3.3V 兼容性；Grove 温湿度模块不一定都是 I²C。'],
      ['SDA、SCL 各归各位', 'SDA → GPIO5，SCL → GPIO6，使用对应 0x44 或 0x45 配置。板载 IMU 使用 0x6A，新增设备避免地址冲突。'],
      ['确认读数有效且会变化', '启用 SHT31 配置后检查有效标记、CRC 和现场温湿度。轻微改变环境，观察合理响应；不要把未启用显示成 0。'],
    ],
    caution: 'DHT11 / DHT22 使用不同接口，不能直接插 I²C 口。AHT 等 I²C 型号也需要对应驱动。', doc: quickstart,
  },
  {
    id: 'light', board: 'xiao', port: 'RGB', title: 'WS2812 氛围灯', kind: 'light', protocol: '单线 DATA / 5 V',
    status: '灯效已实现 · 待实测', line: '“嘴上说没事，灯先呼吸了。”',
    address: 'J7 · GPIO40 → 板载缓冲 → DIN',
    pins: [['power', '匹配的 5 V 电源', '灯带 5V'], ['ground', '公共 GND', '灯带 GND'], ['signal', 'J7 pin1 · 缓冲输出', '灯带 DIN'], ['unused', 'NC', '不接']],
    steps: [
      ['数清灯珠，核算供电', '只对确认适配的 5V、GRB 800kHz 灯带使用此接法。按灯数和亮度核算最大电流，大灯带使用合适的独立供电。'],
      ['看箭头，找 DIN', 'J7 信号接灯带 DIN，不能接 DOUT。GPIO40 的信号已经过板载缓冲；核对电源与公共地后再上电。'],
      ['从低亮度点亮第一颗', '设置实际灯数，从低亮度验证柔绿、呼吸、流动和彩虹。这里的光效仅为教学演示，不会点亮你的真实灯带。'],
    ],
    caution: '不是所有 Grove 灯条都用 WS2812 协议。不要让超额灯带电流经过小连接器。',
    doc: '/docs/projects/2026/roboplanter/ws2812-lighting',
  },
  {
    id: 'printer', board: 'xiao', port: 'UART', title: '热敏小票打印机', kind: 'printer', protocol: 'TTL UART + 外部 12 V',
    status: 'ASCII 已实现 · 待实测', line: '“今日工位诊断：宜准点下班。”',
    address: 'J10 · TX GPIO43 / RX GPIO44（可选）',
    pins: [['external', '独立 12 V 支路', '打印机电源'], ['ground', '公共 GND', '打印机 GND'], ['signal', 'GPIO43 · TX', '打印机 RX'], ['unused', 'GPIO44 · RX（可选）', '电平确认后接 TX']],
    steps: [
      ['电源是 12V，串口未必是', '先核对打印机额定电压、峰值电流、TTL 电平和波特率。打印机独立接 12V；J10 的 3.3V 不能给它供电。'],
      ['发送接接收，并且共地', 'XIAO TX GPIO43 → 打印机 RX。打印机 TX 暂可不接；若需接 GPIO44，先确认不高于 3.3V，否则增加合适电平转换。'],
      ['先打印一行 ASCII', '按实际波特率发送一行 ASCII 和换行，检查供电稳定及出纸。当前固件不读取打印机反馈，中文还需确认字库与编码。'],
    ],
    caution: '教学中的出纸动画不是实际打印回执。12V 是供电标称，不表示 TTL 信号也是 12V。', doc: quickstart,
  },
  {
    id: 'soil', board: 'xiao', port: 'Servo3', title: '土壤湿度', kind: 'soil', protocol: '模拟 ADC / 信号转接',
    status: '已有采集 · 需标定', line: '“我是真口渴，还是只想摸鱼？”',
    address: 'J13 pin1 · D0 / GPIO1 · 不是整口直插',
    pins: [['power', '另取适配的 3.3 V', '传感器 VCC'], ['ground', '公共 GND', '传感器 GND'], ['signal', 'GPIO1 · J13 pin1', '模拟 OUT'], ['unused', 'Servo 的 Motor_5V', '本方案不接']],
    steps: [
      ['传感器的电源另外核对', 'Servo3 的电源脚是 Motor_5V，不是 3.3V。用转接线只取需要的信号与地；按实物规格另接电源。'],
      ['模拟输出进入 GPIO1', 'OUT → J13 pin1 / GPIO1，GND 共地，确认输出不超过 3.3V。不要把模拟输出接到 I²C SDA/SCL。'],
      ['在实际基质中标定', '记录实际探头的干湿参考值再配置。百分比是标定后的相对干湿，不是实验室测得的体积含水率，也不自带土壤温度。'],
    ],
    caution: 'Grove 电容式土壤模块的具体 SKU 仍需确认。图示探头不是指定型号的安装尺寸图。', doc: quickstart,
  },
  {
    id: 'pump', board: 'xiao', port: 'Servo4', title: '12V 水泵与驱动', kind: 'pump', protocol: 'GPIO → 外置驱动 → 泵',
    status: '限时控制已有 · 待实测', line: '“浇水可以，别给我开水漫金山。”',
    address: 'J14 pin1 · D8 / GPIO7 → 外置驱动 IN',
    pins: [['external', '独立 12 V 支路', '泵 / 驱动电源'], ['ground', '公共 GND', '驱动控制地'], ['signal', 'GPIO7 · J14 pin1', '驱动 IN（3.3V 可识别）'], ['unused', 'Servo / 板载电机电源', '不用于这只 12V 泵']],
    steps: [
      ['先接合适的功率驱动', '按泵的额定、启动电流选驱动与电源，确认接受 3.3V 输入、低电平关闭，并配置适合该泵的续流 / 瞬态保护。'],
      ['GPIO 只发控制信号', 'GPIO7 → 外置驱动 IN，控制地共地，泵接独立 12V 支路。图中小驱动板是必经环节，不能把泵直接接 GPIO。'],
      ['从短脉冲和停泵开始', '先验证默认关闭、短脉冲到时停止及断开手机后仍能停止。运行时间不是毫升数；水位检测与低水位停泵还未实现。'],
    ],
    caution: '板载 M1/M2 是 5V 电机输出，不能拿来驱动这只 12V 泵。图中蓝色水流仅为示意。', doc: quickstart,
  },
  {
    id: 'air', board: 'xiao', port: 'Servo2', title: '空气变化参考', kind: 'air', protocol: '模拟 ADC / 信号转接',
    status: '原始 ADC 已有 · 待实测', line: '“窗户开一下，搭子也想透口气。”',
    address: 'J5 pin1 · D9 / GPIO8 · Air Quality v1.3 候选',
    pins: [['power', '核实后的 3.3 V', '模块 VCC'], ['ground', '公共 GND', '模块 GND'], ['signal', 'GPIO8 · J5 pin1', '模拟 OUT'], ['unused', '原 Servo2 舵机', '先断开']],
    steps: [
      ['先断开原舵机', '确认是 Air Quality v1.3，核对模块供电和模拟输出范围。Servo2 只复用信号脚，不能沿用未核对的整口电源接法。'],
      ['把 OUT 接入独立 ADC', 'OUT → GPIO8，GND 共地，确认 ADC 输入不超过 3.3V。该模拟输出不能与其他传感器 OUT 并联。'],
      ['先看原始变化', '核对预热要求，再观察原始 ADC 是否稳定及合理响应。它是宽谱气体变化参考，不能把读数换个标签显示成 CO₂ ppm 或 PM2.5。'],
    ],
    caution: '这不是经过标定的空气质量仪，也不作为气体安全报警器。', doc: quickstart,
  },
  {
    id: 'indicator-adc', board: 'indicator', port: 'Grove ADC', title: 'UV 环境扩展', kind: 'uv', protocol: 'RP2040 模拟 ADC',
    status: '候选接法 · 驱动待实现', line: '“紫外线有多少？先别替太阳下结论。”',
    address: 'RP2040 GPIO26 / GPIO27 · 具体信号脚按插座确认',
    pins: [['power', '按模块规格核对供电', 'UV 模块 VCC'], ['ground', 'GND', 'UV 模块 GND'], ['signal', 'GPIO26 / 27 中确认的一路', '模拟 OUT ≤ 3.3 V'], ['unused', '另一路 ADC', '默认不接']],
    steps: [
      ['这是 RP2040 的接口', '该插座引出 GPIO26 / GPIO27，可配置数字或模拟输入。先确认 UV 模块型号、插座方向、供电及输出不超过 3.3V。'],
      ['模拟 OUT 只接一路', 'OUT 接到按实物确认的一路 ADC，GND 共地。两路 ADC 可分别使用，但普通并联 Hub 不能把两个模块输出合并。'],
      ['还要补齐软件链路', '需新增 RP2040 采集、内部 UART/COBS 传输和屏幕端接收。若让 YOYO 读取，也需汇总到设备服务；现有固件尚未接通。'],
    ],
    caution: '这是后续方案，尚非即插即用。UV 原始值不能替代植物照度、lux 或 PAR。',
    doc: 'https://wiki.seeedstudio.com/SenseCAP_Indicator_RP2040_Grove_ADC/', docLabel: 'Indicator ADC 官方说明 ↗',
  },
  {
    id: 'indicator-i2c', board: 'indicator', port: 'Grove I²C', title: '预留环境感知', kind: 'lux', protocol: 'RP2040 I²C',
    status: '扩展预留 · 尚未选型', line: '“工位的阳光，也值得有个工号。”',
    address: 'RP2040 GPIO20 SDA / GPIO21 SCL',
    pins: [['power', '核对插座供电与模块电压', 'VCC'], ['ground', 'GND', 'GND'], ['signal', 'RP2040 GPIO20', 'SDA'], ['signal2', 'RP2040 GPIO21', 'SCL']],
    steps: [
      ['按用途选传感器', '可用于后续照度或温湿度等 I²C 环境模块。先核对电压、地址和安装位置；图中小板只是泛化模块示意。'],
      ['它是独立的一条总线', 'SDA → RP2040 GPIO20，SCL → GPIO21。不要把 Indicator 与 XIAO 的 I²C 口直接互连，也不要将模拟模块插到这里。'],
      ['补驱动，再显示实测值', '需要对应传感器驱动、RP2040 与 ESP32-S3 的内部通信和界面接入。当前可先留空，完成 XIAO 的核心采集与控制。'],
    ],
    caution: '现有温湿度仍安排在 XIAO；不重复占用同一只模块。具体 Indicator 子型号及内置传感器也需核对。',
    doc: 'https://wiki.seeedstudio.com/SenseCAP_Indicator_RP2040_Grove_IIC/', docLabel: 'Indicator I²C 官方说明 ↗',
  },
];
