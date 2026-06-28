# Architecture

RhodeLogisticsSteward 是明日方舟基建排班表的可视化编辑器。用户在左侧侧边栏选择设施和布局，在右侧画布上编辑干员排班，最终导出为 16:9 PNG 图片。

## 技术栈

React 19 + TypeScript + Vite (Bun 包管理)，CSS Modules，@base-ui/react (Select/Dialog/Switch)，dnd-kit (拖拽)，html-to-image (PNG 导出)。

## 目录结构

```
src/
├── app/                    # 入口 + 路由
│   ├── App.tsx             # BrowserRouter，/ 和 /sample/:id 两个路由
│   └── routes.tsx
├── components/
│   ├── canvas/             # 画布渲染组件
│   ├── dnd/                # 拖拽 (dnd-kit 封装)
│   ├── editor/             # 编辑器外壳 + 工具栏 + 侧边栏
│   ├── picker/             # 干员选择弹窗
│   ├── shared/             # 跨组件复用的展示组件
│   └── ui/                 # 基础 UI 组件 (ContourButton)
├── domain/                 # 纯业务逻辑，不依赖 React
├── state/                  # React 状态管理
├── export/                 # 导入/导出 (JSON, PNG, MAA)
├── styles/                 # CSS Modules (一个组件一个文件)
└── data/                   # 静态数据 (mock samples)
public/                     # 字体、干员头像、游戏数据 JSON
```

## 数据模型

核心类型定义在 `domain/types.ts`：

```
ScheduleDocument          ← 顶层文档
├── layoutId              # "243" / "153" / "252" / "333" / "342"
├── queueCount            # 1-4 个班次
├── canvas                # BentoCanvasState (便当画布 6×4 网格)
│   └── rooms[]           # BentoRoomNode[] (房间位置、类型、产物)
├── queues[]              # ScheduleQueue[] (每个班次的干员分配)
│   └── roomAssignments[] # RoomAssignment[] (每个房间的槽位 + 效率)
├── posterCanvas?          # PosterCanvasState (海报组件布局)
└── productionSummary      # 产出摘要
```

## 数据流

```
用户操作
  → useScheduleStore (state/useScheduleStore.ts)
    → scheduleDocument.ts (domain/scheduleDocument.ts)  # 不可变更新
      → setState + 写 localStorage (state/useLocalDraft.ts)
        → React 重渲染所有组件
```

所有数据变更走 `scheduleDocument.ts` 里的纯函数（`assignOperator`、`setLayout`、`setRoomProduct` 等），返回新文档实例。`useScheduleStore` 封装 state + 自动持久化 + 海报画布撤销/重做。

## 核心组件

### EditorShell (`components/editor/EditorShell.tsx`)
全局编排器：加载干员/Building 数据、管理 zoom/sidebar/focus 状态、连接 store 与所有子组件。

### PosterCanvas (`components/canvas/PosterCanvas.tsx`)
海报画布——绝对定位的 PosterComponent 层叠。处理拖拽缩放（pointer event）+ 吸附网格 + 右键菜单。渲染路径：
- **列组件** → `PosterSectionColumn`（按队列分行，每列含多个房间）
- **单房间** → `renderSingleRoom`（侧边栏独立拖出的房间）
- **旧 section** → `renderInfrastructureSection`（向后兼容）

### BentoCanvas (`components/canvas/BentoCanvas.tsx`)
便当盒 6×4 网格，房间可拖拽/缩放。仅 Card 模板或侧边栏添加房间时显示。

### PosterSectionColumn (`components/canvas/PosterSectionColumn.tsx`)
一列基建房间——header 含产品下拉（制造/贸易），槽位行（控制中枢 3+2 拆分），效率编辑框。

### OperatorPickerDialog (`components/picker/OperatorPickerDialog.tsx`)
干员选择弹窗，支持按房间类型/产物公式/名称搜索筛选，精英状态选择（自动/精0/精一/精二）。

## 关键 domain 文件

| 文件 | 职责 |
|---|---|
| `types.ts` | 所有 TypeScript 类型定义 |
| `scheduleDocument.ts` | 数据变更（assign/clear/swap、移动房间、海报组件操作） |
| `createBentoSchedule.ts` | 根据 layoutId + queueCount 创建新文档 |
| `posterCanvas.ts` | 海报构建（默认布局、列定义、规范化、列宽计算） |
| `posterInteraction.ts` | 拖拽/缩放数学（delta 计算、吸附、rect 裁剪） |
| `posterViewModel.ts` | ScheduleDocument → 海报视图模型（sections/lanes/blocks） |
| `bentoDefinitions.ts` | 房间类型定义、网格常量、产品标签 |
| `bentoGrid.ts` | 网格打包算法（贪心 first-fit） |
| `operatorFilters.ts` | 干员筛选（按名称/房间/产物/已上板） |
| `mockCalculator.ts` | 纸面效率/折算效率/产能模拟计算 |
| `migrateScheduleDocument.ts` | V1 → V2 数据迁移 |

## CSS 模块

```
styles/
├── shared.module.css              # 公共表单 (field/fieldLabel/textInput/selectTrigger)
├── EditorShell.module.css         # 工作区布局、缩放、工具栏
├── PosterCanvas.module.css        # 海报 + 所有 poster* 样式、主题色
├── Toolbar.module.css             # 顶部工具栏 + 自定义 Select
├── BuildingPalette.module.css     # 左侧设施面板
├── OperatorPickerDialog.module.css # 干员选择弹窗
├── ScheduleCanvas.module.css      # 画布外壳
├── BentoCanvas.module.css         # 便当网格
├── BentoRoomCard.module.css       # 便当房间卡片
├── BentoRoomSlot.module.css       # 便当槽位
├── EditableText.module.css        # 可编辑文本
├── contourButton.module.css       # ContourButton
├── operatorPortrait.module.css    # 干员头像
└── drag.module.css               # 拖拽预览
```

## 列布局 (Poster Columns)

每种 layoutId 硬编码列定义在 `getPosterColumns()` (posterCanvas.ts) 中。列宽 = 有 `widthFraction` 的固定比例 + 其余按最大槽位权重自动分配。

## 构建 & 部署

```bash
bun install        # 安装依赖
bun run dev        # 开发服务器
bun run build      # 生产构建 → dist/
bun run preview    # 本地预览构建产物
```

dist/ 可直接部署到 Cloudflare Pages（拖拽上传或 wrangler CLI）。
