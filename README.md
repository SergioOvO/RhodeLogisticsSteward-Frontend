# RhodeLogisticsSteward-Frontend

明日方舟基建排班表前端编辑器。项目使用 React + Vite 构建，用来编辑罗德岛基建排班画布、配置干员槽位，并导出可分享的 16:9 PNG 图片或可再次导入的 JSON 排班文档。

## 主要功能

- 支持 `153`、`243`、`252`、`333`、`342` 基建布局预设。
- 支持 `1` 到 `3` 个换班队列，并按画布尺寸自动压缩排版。
- 提供干员池、干员头像、职业图标、稀有度图标和基建技能筛选。
- 支持按名称、别名、房间技能、产物公式和“仅显示已上板干员”筛选干员。
- 支持拖拽干员到槽位、槽位互换、清空槽位，以及在选择弹窗里设置精英化阶段。
- 支持编辑标题、副标题、产出摘要、无人机说明、队列标签和房间效率文本。
- 自动把当前草稿保存到 `localStorage`。
- 支持导出 `ScheduleDocument` v1 JSON，并可重新导入继续编辑。
- 支持把排班画布导出为 2x 像素密度的 PNG 图片。

## 技术栈

- React 19
- Vite 8
- TypeScript 6
- Base UI
- dnd-kit
- Phosphor Icons
- html-to-image
- Vitest
- Playwright

## 本地运行

```bash
bun install
bun run dev
```

开发服务器启动后，按终端输出的本地地址访问页面。

仓库已经包含生成后的 `public/` 静态数据和 WebP 图片资源，也包含 `assets/operator-source/` 下的原始 PNG 素材。只有在需要刷新干员、头像或基建数据时，才需要重新运行数据生成脚本。

## 刷新静态数据

```bash
bun run generate:data
```

该命令会依次运行：

- `bun run generate:operators`
- `bun run generate:building`

默认数据来源是仓库内素材和本机基建数据：

- `assets/operator-source`
- `D:\Code Rep\arknights\arknights-building-data\data`

如果你的数据目录不同，可以用环境变量覆盖。`RLS_AVATARS_DIR` 需要指向包含 `operators.json`、`portraits/`、`profession/`、`rarity/` 和 `elite/` 的目录；旧的 `avatars/` 头像目录名也兼容。

```bash
$env:RLS_AVATARS_DIR="D:\path\to\avatars"
$env:RLS_BUILDING_DATA_DIR="D:\path\to\arknights-building-data\data"
bun run generate:data
```

生成结果会写入：

- `public/operators/manifest.json`
- `public/operators/portraits/`
- `public/operators/profession/`
- `public/operators/rarity/`
- `public/operators/elite/`
- `public/data/building-reference.json`

`public/operators/` 是站点运行时资源目录，图片会由原始 PNG 转换为 WebP；原始 PNG 素材保留在 `assets/operator-source/`，方便查看和重新生成。

## 常用脚本

```bash
bun run dev
bun run lint
bun run test
bun run build
bun run e2e
bun run preview
```

脚本说明：

- `bun run dev`：启动 Vite 开发服务器。
- `bun run lint`：运行 ESLint。
- `bun run test`：运行 Vitest 单元测试和组件测试。
- `bun run build`：执行 TypeScript 构建检查并生成生产包。
- `bun run e2e`：运行 Playwright 端到端测试，配置会自动启动 `bun run preview`。
- `bun run preview`：预览生产构建产物。

## 项目结构

```text
.
├── public/                  # 静态资源、生成后的干员数据和基建参考数据
├── scripts/                 # 数据生成脚本
├── src/
│   ├── app/                 # 应用入口路由
│   ├── components/          # 编辑器、画布、拖拽、弹窗和 UI 组件
│   ├── data/                # 布局预设和示例排班
│   ├── domain/              # 排班文档、筛选、布局和计算相关逻辑
│   ├── export/              # JSON / PNG 导入导出
│   ├── state/               # 排班状态和本地草稿
│   └── styles/              # CSS Modules 和设计 token
├── tests/
│   ├── components/          # 组件测试
│   ├── domain/              # 领域逻辑测试
│   └── e2e/                 # Playwright 测试
├── package.json
└── bun.lock
```

## 数据格式

JSON 导入导出使用 `ScheduleDocument` v1。校验逻辑位于 `src/domain/scheduleDocument.ts`，类型定义位于 `src/domain/types.ts`。

导出的 JSON 会保留布局、队列数量、房间分配、干员槽位、标题、摘要、无人机说明和备注等可编辑内容。

## 当前限制

产出总量和效率标签目前仍是前端侧的 mock 估算，适合排版和展示，但还没有和 `RhodeLogisticsSteward` 的真实生产计算完全对齐。后续可以把最小生产计算逻辑移植到 TypeScript，并加入与后端/脚本侧一致的 parity fixtures。
