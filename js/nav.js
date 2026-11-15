/* ============================================================
 * 导航数据：分类 + 站点
 * devices: ["pc","mobile"] —— 电脑端显示 pc，手机端显示 mobile
 * 只收录非搜索引擎的功能网站
 * ============================================================ */
window.NAV_CATS = [
  { key: "all", name: "全部" },
  { key: "video", name: "视频" },
  { key: "ai", name: "AI" },
  { key: "tool", name: "工具" },
  { key: "study", name: "学习" },
  { key: "community", name: "社区" },
  { key: "resource", name: "资源" },
  { key: "office", name: "办公" },
  { key: "life", name: "生活" }
];

window.NAV_SITES = [
  /* ---- 视频 ---- */
  {
    id: "bilibili",
    name: "哔哩哔哩",
    badge: "哔",
    accent: "#FB7299",
    cat: "video",
    devices: ["pc", "mobile"],
    desc: "弹幕文化发源地，覆盖动画、游戏、知识、科技与生活区；支持关注 UP 主、收藏夹、专栏和直播，适合追番、看教程和找同好。网页版支持弹幕设置、稍后再看和创作中心，追番与学习两不误。",
    url: "https://www.bilibili.com/"
  },
  {
    id: "douyin",
    name: "抖音",
    badge: "抖",
    accent: "#FE2C55",
    cat: "video",
    devices: ["pc", "mobile"],
    desc: "短视频与直播平台，覆盖生活、美食、旅行、才艺和知识内容；算法推荐刷起来很顺，也支持直播、搜索和网页版创作。网页版可看推荐流、搜索和直播，创作者也能直接发布作品。",
    url: "https://www.douyin.com/"
  },
  {
    id: "kuaishou",
    name: "快手",
    badge: "快",
    accent: "#FF8A00",
    cat: "video",
    devices: ["pc", "mobile"],
    desc: "真实生活气息浓厚的短视频社区，记录普通人日常、三农、手艺和才艺；可看直播、同城内容和创作者教程。网页版支持关注、发现和直播，适合看手艺人与乡村生活。",
    url: "https://www.kuaishou.com/"
  },
  {
    id: "youtube",
    name: "YouTube",
    badge: "Y",
    accent: "#FF0000",
    cat: "video",
    devices: ["pc", "mobile"],
    desc: "全球最大的视频平台，4K 视频、音乐、游戏实况、纪录片和公开课都有；支持订阅、播放列表和自动字幕，适合学语言和找国际内容。网页版支持 4K、字幕、倍速和稍后观看，找教程很方便。",
    url: "https://www.youtube.com/"
  },
  {
    id: "chase-drama",
    name: "追剧达人",
    badge: "追",
    accent: "#8B5CF6",
    cat: "video",
    devices: ["mobile"],
    desc: "影视剧集在线观看入口，聚合电影、电视剧和综艺资源；适合找片，页面为第三方站点，广告和版权请自行判断。手机端访问更顺畅，资源链接可能随时间失效。",
    url: "http://www.chqy.org/"
  },

  /* ---- AI ---- */
  {
    id: "deepseek",
    name: "DeepSeek",
    badge: "D",
    accent: "#4D6BFE",
    cat: "ai",
    devices: ["pc", "mobile"],
    desc: "国产大模型助手，强项是推理、数学和代码；支持长上下文、文件阅读和联网搜索，网页版免费，适合写代码、改文章和拆解难题。网页版支持深度思考、联网搜索和文件上传，适合学生和开发者。",
    url: "https://chat.deepseek.com/"
  },
  {
    id: "doubao",
    name: "豆包 AI",
    badge: "豆",
    accent: "#3B7CFF",
    cat: "ai",
    devices: ["pc", "mobile"],
    desc: "字节跳动推出的 AI 助手，支持对话、写作、翻译、图片理解和语音；网页版内置多种智能体，适合日常问答和灵感草稿。网页版支持联网、图片生成和文档阅读，适合日常问答。",
    url: "https://www.doubao.com/"
  },
  {
    id: "kimi",
    name: "Kimi",
    badge: "K",
    accent: "#111827",
    cat: "ai",
    devices: ["pc", "mobile"],
    desc: "月之暗面出品的长文本 AI 助手，擅长读论文、合同、书籍和网页；支持长上下文、文件上传和联网搜索，适合资料整理和写作。网页版支持联网、文件上传和长文总结，适合论文与报告。",
    url: "https://kimi.moonshot.cn/"
  },
  {
    id: "tongyi",
    name: "通义千问",
    badge: "通",
    accent: "#615CED",
    cat: "ai",
    devices: ["pc", "mobile"],
    desc: "阿里云的通义千问，覆盖问答、写作、代码、翻译和办公；网页版支持文档解析、表格和图片理解，适合中文场景。网页版支持文档、图片和表格理解，适合办公与学习。",
    url: "https://tongyi.aliyun.com/"
  },
  {
    id: "jimeng",
    name: "即梦 AI",
    badge: "即",
    accent: "#00B3A6",
    cat: "ai",
    devices: ["pc", "mobile"],
    desc: "字节跳动的 AI 图片与视频创作平台，支持文生图、图生视频、智能画布和风格参考；适合做封面、插画和短视频素材。网页版支持图生视频、智能画布和模板，适合短视频创作者。",
    url: "https://jimeng.jianying.com/"
  },
  {
    id: "kling",
    name: "可灵 AI",
    badge: "可",
    accent: "#7C5CFF",
    cat: "ai",
    devices: ["pc", "mobile"],
    desc: "快手推出的 AI 视频生成平台，支持文生视频、图生视频、运镜控制和首尾帧；画面质感强，适合短片、广告和创意分镜。网页版支持首尾帧、运镜和延长视频，适合广告与短片。",
    url: "https://klingai.com/"
  },

  /* ---- 工具 ---- */
  {
    id: "cli-im",
    name: "草料二维码",
    badge: "草",
    accent: "#2F80ED",
    cat: "tool",
    devices: ["pc", "mobile"],
    desc: "草料二维码，支持网址、文本、文件、名片和表单生成二维码；可做活码、统计扫码量、批量生码，适合活动物料和门店。网页版支持批量生码、活码管理和扫码统计，适合门店与活动。",
    url: "https://cli.im/"
  },
  {
    id: "tinypng",
    name: "TinyPNG",
    badge: "T",
    accent: "#3DB39E",
    cat: "tool",
    devices: ["pc", "mobile"],
    desc: "老牌在线图片压缩工具，支持 PNG、JPG、WebP 和 AVIF；压缩后画质损失小，可批量处理，适合网页和公众号配图。网页版支持批量拖拽和 API，适合前端与新媒体配图。",
    url: "https://tinypng.com/"
  },
  {
    id: "iloveimg",
    name: "iLoveIMG",
    badge: "i",
    accent: "#5B8DEF",
    cat: "tool",
    devices: ["pc", "mobile"],
    desc: "在线图片工具箱，支持压缩、裁剪、旋转、格式转换、加水印和批量处理；界面简单，适合日常修图和素材整理。网页版支持批量处理和多格式转换，适合日常素材整理。",
    url: "https://www.iloveimg.com/zh-cn"
  },
  {
    id: "remove-bg",
    name: "remove.bg",
    badge: "R",
    accent: "#00A86B",
    cat: "tool",
    devices: ["pc", "mobile"],
    desc: "AI 一键抠图工具，上传图片自动去掉背景；支持人物、商品、动物和 logo，可换背景，适合做海报和电商图。网页版支持批量抠图和背景替换，适合电商与设计。",
    url: "https://www.remove.bg/zh"
  },
  {
    id: "photopea",
    name: "Photopea",
    badge: "P",
    accent: "#6C5CE7",
    cat: "tool",
    devices: ["pc"],
    desc: "浏览器里的免费 PS，支持 PSD、图层、蒙版、滤镜和矢量编辑；无需安装，适合临时改图和处理设计稿。网页版支持 PSD、AI、Sketch 和 XD，适合临时处理设计稿。",
    url: "https://www.photopea.com/"
  },
  {
    id: "processon",
    name: "ProcessOn",
    badge: "流",
    accent: "#FF9F43",
    cat: "tool",
    devices: ["pc"],
    desc: "在线流程图和思维导图工具，支持流程图、UML、泳道图、原型和 Markdown；可多人协作，适合画架构和整理思路。网页版支持模板、团队空间和导出，适合画架构与流程图。",
    url: "https://www.processon.com/"
  },
  {
    id: "genshin-music",
    name: "原琴模拟器",
    badge: "琴",
    accent: "#F59E0B",
    cat: "tool",
    devices: ["pc", "mobile"],
    desc: "原神风物之诗琴网页模拟器，支持键盘和鼠标演奏、乐谱导入和自动播放；适合练琴、录视频和分享谱子。网页版支持自定义键位、录音和分享，适合练琴与整活。",
    url: "https://specy.github.io/genshinMusic"
  },

  /* ---- 学习 ---- */
  {
    id: "runoob",
    name: "菜鸟教程",
    badge: "菜",
    accent: "#2ECC71",
    cat: "study",
    devices: ["pc", "mobile"],
    desc: "菜鸟教程，覆盖 HTML、CSS、JavaScript、Python、Java、SQL 和 Linux 等入门教程；每节都有在线示例，适合零基础快速上手。网页版支持在线运行示例和测验，适合边学边练。",
    url: "https://www.runoob.com/"
  },
  {
    id: "mdn",
    name: "MDN Web Docs",
    badge: "M",
    accent: "#111827",
    cat: "study",
    devices: ["pc"],
    desc: "Mozilla 的 Web 开发权威文档，覆盖 HTML、CSS、JavaScript、API 和浏览器兼容性；有中文翻译和示例，前端查资料首选。网页版支持搜索、示例和兼容性表，适合查 API 与标准。",
    url: "https://developer.mozilla.org/zh-CN/"
  },
  {
    id: "mooc",
    name: "中国大学 MOOC",
    badge: "课",
    accent: "#1E88E5",
    cat: "study",
    devices: ["pc", "mobile"],
    desc: "中国大学 MOOC，汇聚 985 和 211 高校公开课，覆盖计算机、外语、经管和通识；可免费旁听，部分课程有证书。网页版支持课程搜索、讨论和测验，适合系统补基础。",
    url: "https://www.icourse163.org/"
  },
  {
    id: "zhihu",
    name: "知乎",
    badge: "知",
    accent: "#0084FF",
    cat: "study",
    devices: ["pc", "mobile"],
    desc: "中文问答社区，覆盖科技、职场、生活、教育和兴趣话题；有专栏、盐选和视频，适合查经验、看深度讨论。网页版支持搜索、关注和专栏，适合查经验与深度内容。",
    url: "https://www.zhihu.com/"
  },

  /* ---- 社区 ---- */
  {
    id: "sspai",
    name: "少数派",
    badge: "少",
    accent: "#E64A19",
    cat: "community",
    devices: ["pc", "mobile"],
    desc: "少数派，专注数字生活、效率工具、软件评测和生活方式；文章质量高，适合找 App、工作流和折腾灵感。网页版支持搜索、专栏和社区，适合找工具与效率方法。",
    url: "https://sspai.com/"
  },
  {
    id: "v2ex",
    name: "V2EX",
    badge: "V",
    accent: "#37474F",
    cat: "community",
    devices: ["pc", "mobile"],
    desc: "开发者与创意工作者的社区，讨论编程、产品、职场、硬件和生活方式；节点丰富，适合提问、招聘和看行业动态。网页版支持节点、搜索和回复，适合开发者和产品交流。",
    url: "https://www.v2ex.com/"
  },
  {
    id: "xiaohongshu",
    name: "小红书",
    badge: "红",
    accent: "#FF2442",
    cat: "community",
    devices: ["mobile"],
    desc: "生活方式社区，覆盖穿搭、美妆、旅行、美食、家居和探店；图文笔记和短视频为主，适合找攻略和灵感。网页版支持搜索、收藏和发布，适合找攻略与灵感。",
    url: "https://www.xiaohongshu.com/"
  },

  /* ---- 资源 ---- */
  {
    id: "github",
    name: "GitHub",
    badge: "G",
    accent: "#24292F",
    cat: "resource",
    devices: ["pc"],
    desc: "全球最大的代码托管平台，托管开源项目、Actions、Packages 和 Pages；可搜项目、读源码、提 issue，开发者必备。网页版支持搜索、Issues、Actions 和 Pages，适合开源协作。",
    url: "https://github.com/"
  },
  {
    id: "gitee",
    name: "Gitee",
    badge: "码",
    accent: "#C71D23",
    cat: "resource",
    devices: ["pc"],
    desc: "国内代码托管平台，支持 Git 仓库、Pull Request、CI/CD 和 Pages；访问速度快，适合国内团队和开源项目。网页版支持仓库、PR、Issues 和 Pages，适合国内协作。",
    url: "https://gitee.com/"
  },
  {
    id: "juejin",
    name: "掘金",
    badge: "掘",
    accent: "#1E80FF",
    cat: "resource",
    devices: ["pc", "mobile"],
    desc: "中文技术社区，覆盖前端、后端、AI、移动端和工程实践；有沸点、专栏和课程，适合看技术文章和面试经验。网页版支持搜索、专栏和沸点，适合看技术趋势。",
    url: "https://juejin.cn/"
  },
  {
    id: "animal-well",
    name: "动物井",
    badge: "动",
    accent: "#10B981",
    cat: "resource",
    devices: ["pc"],
    desc: "像素风解谜游戏《动物井》的下载页，蓝奏云网盘；游戏口碑好，适合喜欢银河城和烧脑谜题的玩家。下载后解压即可游玩，建议支持正版并注意网盘广告。",
    url: "https://wwrj.lanzouw.com/iuxMK2wy9ptc"
  },

  /* ---- 办公 ---- */
  {
    id: "qqdocs",
    name: "腾讯文档",
    badge: "文",
    accent: "#3B7CFF",
    cat: "office",
    devices: ["pc", "mobile"],
    desc: "腾讯文档，支持在线文档、表格、幻灯片、收集表和思维导图；可多人实时协作，适合团队办公和作业。网页版支持模板、收集表和权限管理，适合团队协作。",
    url: "https://docs.qq.com/"
  },
  {
    id: "yuque",
    name: "语雀",
    badge: "语",
    accent: "#00B96B",
    cat: "office",
    devices: ["pc", "mobile"],
    desc: "语雀，阿里旗下的知识库与文档工具，支持 Markdown、表格、画板和团队空间；适合写笔记、整理资料和做 wiki。网页版支持知识库、模板和团队空间，适合写文档与 wiki。",
    url: "https://www.yuque.com/"
  },

  /* ---- 生活 ---- */
  {
    id: "amap",
    name: "高德地图",
    badge: "图",
    accent: "#1A73E8",
    cat: "life",
    devices: ["mobile"],
    desc: "高德地图，提供驾车、公交、步行导航、实时路况、地点搜索和打车；手机端体验好，适合出行查路线。网页版支持路线规划、地点搜索和路况，适合出行前查询。",
    url: "https://www.amap.com/"
  },
  {
    id: "rail12306",
    name: "12306",
    badge: "123",
    accent: "#1B6EC2",
    cat: "life",
    devices: ["mobile"],
    desc: "中国铁路 12306，支持火车票查询、购票、改签、退票和行程管理；官方渠道，节假日抢票必备。网页版支持车票查询、购票和改签，建议提前登录。",
    url: "https://www.12306.cn/"
  }
];
