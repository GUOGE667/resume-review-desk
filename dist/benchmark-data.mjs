// Frozen, fictional challenge cases. Keep separate from the ten walkthrough
// examples and do not tune the default keyword rules against these labels.
// "expected: null" means the evidence should be escalated to a person.
export const BENCHMARK_CASES = [
  { id:'F01', scenario:'常规', expected:'frontend', text:'主要负责管理台前端，使用 React、TypeScript 和 CSS 开发页面与组件。' },
  { id:'F02', scenario:'常规', expected:'frontend', text:'在浏览器端构建 Vue 页面，使用 JavaScript 编写交互并抽取组件。' },
  { id:'F03', scenario:'技术别名', expected:'frontend', text:'负责 Angular 和 RxJS 的网页交互、路由与可访问性，目标岗位为客户端界面开发。' },
  { id:'F04', scenario:'跨岗位经历', expected:'frontend', text:'主要用 React、TypeScript 做界面，也曾用 Node.js 编写 API 代理。希望继续做界面开发。' },
  { id:'F05', scenario:'技术别名', expected:'frontend', text:'维护浏览器页面的 HTML、CSS 和原生 JS，负责布局与交互。' },
  { id:'F06', scenario:'技术别名', expected:'frontend', text:'以 Svelte 和 Vite 实现交互页面、设计系统与可访问性组件。' },
  { id:'F07', scenario:'常规', expected:'frontend', text:'使用 Vue 与前端组件库制作报名系统，旧项目接触过 Java。' },
  { id:'F08', scenario:'常规', expected:'frontend', text:'负责 React 页面、CSS 响应式布局和可复用组件的实现。' },

  { id:'B01', scenario:'常规', expected:'backend', text:'使用 Java、Spring 和 PostgreSQL 构建订单 API。' },
  { id:'B02', scenario:'常规', expected:'backend', text:'使用 Python、FastAPI 和 PostgreSQL 开发服务端接口。' },
  { id:'B03', scenario:'技术别名', expected:'backend', text:'以 Go、Redis 和 gRPC 实现微服务，负责服务端缓存与鉴权。' },
  { id:'B04', scenario:'常规', expected:'backend', text:'主要维护 Node.js API，偶尔调整 React 管理台页面。' },
  { id:'B05', scenario:'跨岗位经历', expected:'backend', text:'主要负责 Java、Spring 服务端；培训时做过 React、Vue 练习。' },
  { id:'B06', scenario:'技术别名', expected:'backend', text:'使用 Kotlin、Ktor 和 MySQL 开发服务端，目标是后端岗位。' },
  { id:'B07', scenario:'常规', expected:'backend', text:'维护 Python API 与部署脚本，也写过少量 SQL 报表。' },
  { id:'B08', scenario:'技术别名', expected:'backend', text:'设计微服务、消息队列、鉴权和缓存策略，负责服务端接口稳定性。' },

  { id:'D01', scenario:'常规', expected:'data', text:'使用 SQL、Pandas 和 ETL 流程清洗运营数据。' },
  { id:'D02', scenario:'常规', expected:'data', text:'使用 Tableau 与 Power BI 制作数据分析仪表盘。' },
  { id:'D03', scenario:'跨岗位经历', expected:'data', text:'主要使用 SQL、Pandas 做分析，偶尔用 Python 编写取数脚本。' },
  { id:'D04', scenario:'技术别名', expected:'data', text:'使用 Spark、Hive 维护指标口径和数据仓库，负责分析报表。' },
  { id:'D05', scenario:'跨岗位经历', expected:'data', text:'主要用 SQL、Power BI 做分析，也接触 PostgreSQL 数据库和 API 取数。' },
  { id:'D06', scenario:'常规', expected:'data', text:'负责 ETL、数据分析和指标监控；使用 Python 辅助清洗。' },
  { id:'D07', scenario:'技术别名', expected:'data', text:'使用 Excel、A/B 实验和可视化方法分析转化漏斗，目标岗位为商业分析。' },
  { id:'D08', scenario:'常规', expected:'data', text:'使用 Tableau、SQL 和数据仓库进行渠道分析。' },

  { id:'A01', scenario:'常规', expected:'ai', text:'使用 PyTorch 进行模型训练，并搭建 RAG 检索实验。' },
  { id:'A02', scenario:'常规', expected:'ai', text:'使用 TensorFlow 实现机器学习实验，负责算法评估。' },
  { id:'A03', scenario:'常规', expected:'ai', text:'实现 Agent 工具调用、LLM 提示词实验和 RAG 检索。' },
  { id:'A04', scenario:'跨岗位经历', expected:'ai', text:'主要用 PyTorch 做模型实验；还使用 Python、FastAPI 和 API 封装推理服务。' },
  { id:'A05', scenario:'技术别名', expected:'ai', text:'研究 Hugging Face、LoRA 微调和大模型推理，目标岗位是生成式人工智能研发。' },
  { id:'A06', scenario:'技术别名', expected:'ai', text:'用 LangChain 和向量检索实现 Agent 工作流，负责模型效果复盘。' },
  { id:'A07', scenario:'跨岗位经历', expected:'ai', text:'主要做机器学习和模型训练，也用 SQL、Pandas 分析实验数据。' },
  { id:'A08', scenario:'常规', expected:'ai', text:'使用 PyTorch、TensorFlow 做算法实验与性能对比。' },

  { id:'R01', scenario:'无技术证据', expected:null, text:'负责会议纪要、活动安排和跨团队沟通，目标岗位尚未确定。' },
  { id:'R02', scenario:'跨岗位并列', expected:null, text:'实习时同时做过 React、Vue 页面和 Java、Spring 接口，尚未确定主攻方向。' },
  { id:'R03', scenario:'弱证据', expected:null, text:'最近只参加过 React 入门分享，没有可核实的项目经历。' },
  { id:'R04', scenario:'否定描述', expected:null, text:'培训大纲列出 React、Vue、Java、Spring，但本人尚未参加这些课程。' },
  { id:'R05', scenario:'否定描述', expected:null, text:'明确写明不熟悉 Java、Spring，当前希望讨论非技术岗位。' },
  { id:'R06', scenario:'否定描述', expected:null, text:'岗位清单中列有 SQL、Pandas，但本人只负责协调，没有实际使用。' },
  { id:'R07', scenario:'弱证据', expected:null, text:'希望将来学习 AI，目前没有模型或算法项目经历。' },
  { id:'R08', scenario:'否定描述', expected:null, text:'学习计划包含 React、TypeScript、CSS；目前尚无相关实践，请人工确认。' },
];
