export const siteContent = {
  brand: "YOUR NAME",
  role: "AI 电商设计师 × 品牌视觉设计师",
  heroLines: ["Creative", "E-commerce", "Director"],
  heroStatementPhrases: ["让产品视觉更高级，", "也更高效。"],
  heroDescription:
    "聚焦品牌策略、电商视觉、产品表现与 AIGC 设计工作流，把卖点、审美、转化诉求和生产效率整合成清晰可落地的视觉系统。",
  profile: {
    titlePhrases: [
      "从品牌策略到",
      "AI 提效，",
      "把电商视觉做成",
      "可持续的生产系统。"
    ],
    paragraphs: [
      "你好，我是一名专注商业视觉与电商内容的设计师。擅长从产品定位和核心卖点出发，建立兼顾品牌感、信息效率与转化目标的视觉表达。",
      "目前页面中的经历、项目和联系方式均为演示内容。替换为你的真实资料后，即可作为正式个人作品集使用。"
    ],
    timeline: [
      {
        period: "2023 — NOW",
        company: "独立设计项目",
        role: "视觉方向 / AIGC 工作流",
        description:
          "负责品牌视觉方向、电商页面规划、核心创意与 AI 辅助生产流程搭建。"
      },
      {
        period: "2020 — 2023",
        company: "品牌设计团队",
        role: "高级视觉设计",
        description:
          "参与消费品牌视觉升级、平台活动页面和产品内容体系的设计与落地。"
      },
      {
        period: "2018 — 2020",
        company: "创意设计机构",
        role: "视觉设计",
        description:
          "负责电商详情页、店铺首页、活动视觉与线下传播物料等商业设计项目。"
      }
    ],
    stats: [
      { value: "10+", label: "商业视觉项目类型" },
      { value: "03", label: "核心业务方向" },
      { value: "AIGC", label: "设计流程搭建" },
      { value: "3D", label: "产品表现与渲染" }
    ]
  },
  contact: {
    titlePhrases: ["一起把产品视觉", "推进到更高效、", "更有判断力的版本。"],
    email: "hello@yourname.com",
    wechat: "your_wechat",
    availability: "Open for selected projects"
  }
};

export const workFilters = [
  { id: "all", label: "全部" },
  { id: "video", label: "视频" },
  { id: "detail", label: "详情页" },
  { id: "home", label: "首页" }
];

export const workGroups = [
  {
    id: "video",
    index: "01",
    title: "视频作品",
    typeLabel: "Video",
    projects: [
      {
        id: "ice-01",
        title: "制冰机产品视觉",
        label: "产品主图视频 / 功能卖点",
        artwork: "ice",
        word: "ICE",
        code: "01",
        accent: "#71dce5"
      },
      {
        id: "kitchen-r1",
        title: "厨房电器氛围片",
        label: "厨房电器 / 氛围视觉",
        artwork: "kitchen",
        word: "R1",
        code: "02",
        accent: "#bda66b"
      },
      {
        id: "vacuum-v2",
        title: "真空包装机演示",
        label: "产品演示 / 转化视频",
        artwork: "vacuum",
        word: "VAC",
        code: "03",
        accent: "#8dc3d6"
      },
      {
        id: "fresh-sensor",
        title: "果蔬净化科技片",
        label: "产品检测 / 科技表达",
        artwork: "fresh",
        word: "FRESH",
        code: "04",
        accent: "#77dfbd"
      },
      {
        id: "home-scene",
        title: "高端家居场景短片",
        label: "短视频 / 场景种草",
        artwork: "motion",
        word: "HOME",
        code: "05",
        accent: "#e8c48b"
      },
      {
        id: "live-motion",
        title: "直播间动态视觉",
        label: "直播场景 / 视觉节奏",
        artwork: "live",
        word: "LIVE",
        code: "06",
        accent: "#9bb5ff"
      }
    ]
  },
  {
    id: "detail",
    index: "02",
    title: "详情页作品",
    typeLabel: "Detail",
    projects: [
      {
        id: "detail-clean",
        title: "净护产品详情页",
        label: "AIGC 产品视觉 / 卖点规划",
        artwork: "fresh",
        word: "CLEAN",
        code: "01",
        accent: "#76dfc4"
      },
      {
        id: "detail-ice",
        title: "制冰机详情页",
        label: "小家电 / 清凉场景",
        artwork: "ice",
        word: "ICE",
        code: "02",
        accent: "#71dce5"
      },
      {
        id: "detail-air",
        title: "空气系统详情页",
        label: "家电 / 科技表达",
        artwork: "air",
        word: "AIR",
        code: "03",
        accent: "#a3c1ff"
      },
      {
        id: "detail-water",
        title: "净饮产品详情页",
        label: "小家电 / 纯净视觉",
        artwork: "water",
        word: "PURE",
        code: "04",
        accent: "#9de6ef"
      },
      {
        id: "detail-winter",
        title: "冬季场景详情页",
        label: "场景视觉 / 季节内容",
        artwork: "winter",
        word: "WINTER",
        code: "05",
        accent: "#d4e6ef"
      },
      {
        id: "detail-aura",
        title: "AURA 新品详情页",
        label: "新品上市 / 品牌视觉",
        artwork: "aura",
        word: "AURA",
        code: "06",
        accent: "#dfc49e"
      }
    ]
  },
  {
    id: "home",
    index: "03",
    title: "首页 / 活动页作品",
    typeLabel: "Home",
    projects: [
      {
        id: "home-brand",
        title: "品牌旗舰店首页",
        label: "首页 / 品牌视觉升级",
        artwork: "brand",
        word: "NOVA",
        code: "01",
        accent: "#80dbe3"
      },
      {
        id: "home-sale",
        title: "年度大促活动页",
        label: "首页 / 营销活动",
        artwork: "sale",
        word: "SALE",
        code: "02",
        accent: "#dfc06f"
      },
      {
        id: "home-mobile",
        title: "品牌 APP 首页",
        label: "首页 / 移动端",
        artwork: "mobile",
        word: "APP",
        code: "03",
        accent: "#96b0ff"
      },
      {
        id: "home-tech",
        title: "科技新品预售页",
        label: "首页 / 新品预售",
        artwork: "live",
        word: "X1",
        code: "04",
        accent: "#88a4ff"
      },
      {
        id: "home-event",
        title: "节点主题活动页",
        label: "首页 / 节点活动",
        artwork: "event",
        word: "DAY",
        code: "05",
        accent: "#e9b886"
      },
      {
        id: "home-editorial",
        title: "内容专题承接页",
        label: "首页 / 内容视觉",
        artwork: "editorial",
        word: "EDIT",
        code: "06",
        accent: "#8cdbc8"
      }
    ]
  }
];
