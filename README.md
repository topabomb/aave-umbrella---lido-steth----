# DeFi 收益分析器 (DeFi Yield Analyst)

这是一个使用 React, TypeScript 和 Vite 构建的 Web 应用，用于分析和追踪在 Aave Umbrella 安全模块和 Lido 协议中的 DeFi 质押资产的收益情况。应用能够自动发现指定钱包地址的质押头寸，并回溯历史数据来精准计算收益。

## 功能特性

- **自动资产发现**: 自动扫描钱包地址，发现其在 Aave Umbrella 和 Lido 上的活跃质押资产。
- **历史收益回溯**: 获取过去 N 天（可配置）的每日链上数据快照。
- **精准收益计算**:
  - 区分并计算两种主要的收益来源：
    1.  **内生性收益 (Lending Gain)**: 来自于凭证代币（如 aToken, stETH）自身价值的增长。
    2.  **外源性激励 (Incentive Rewards)**: 来自于外部奖励合约的额外代币奖励。
  - 计算每日收益、区间总收益、日均收益和动态年化收益率 (APY)。
- **数据可视化**:
  - 通过图表清晰展示每日收益的构成（价值增长 vs. 激励）。
  - 在图表提示框中提供每日持仓价值和当日 APY 等详细信息。
- **多维度汇总**:
  - 提供全局、Lido 和 Aave Umbrella 三个维度的汇总数据卡片，方便从不同角度审视资产表现。
- **可配置 RPC 节点**: 用户可以自定义以太坊 RPC 节点 URL，以提高数据获取的稳定性和可靠性。
- **本地持久化**: 自动保存用户输入的钱包地址和 RPC URL，方便下次使用。
- **详细日志**: 在开发者控制台中提供详细的操作和计算日志，便于调试和验证。

## 技术栈

- **前端框架**: [React](https://reactjs.org/)
- **语言**: [TypeScript](https://www.typescriptlang.org/)
- **构建工具**: [Vite](https://vitejs.dev/)
- **区块链交互**: [Ethers.js](https://docs.ethers.io/)
- **UI 组件**: [Lucide React](https://lucide.dev/) (图标), [Recharts](https://recharts.org/) (图表)
- **样式**: [Tailwind CSS](https://tailwindcss.com/)

## 如何开始

1.  **克隆仓库**
    ```bash
    git clone <repository-url>
    cd aave-umbrella-及-lido-steth资产追踪
    ```

2.  **安装依赖**
    ```bash
    npm install
    ```
    或者
    ```bash
    pnpm install
    ```

3.  **启动开发服务器**
    ```bash
    npm run dev
    ```
    应用将在 `http://localhost:5173` (或其他可用端口) 上运行。

4.  **使用应用**
    - 在输入框中填入一个以太坊钱包地址。
    - （可选）修改 RPC 节点 URL。
    - 选择分析周期（例如，最近 7 天）。
    - 点击“开始全景扫描”按钮。

## 项目结构

```
.
├── public/                # 静态资源
├── src/
│   ├── components/        # React 组件 (图表, 卡片, 日志面板等)
│   │   ├── EarningsChart.tsx
│   │   ├── LogPanel.tsx
│   │   └── StatsCard.tsx
│   ├── services/          # 服务和业务逻辑
│   │   ├── blockchainService.ts  # 核心的区块链数据获取和收益计算逻辑
│   │   └── storageService.ts     # 浏览器本地存储服务
│   ├── App.tsx            # 主应用组件
│   ├── constants.ts       # 常量 (合约地址, ABI 等)
│   ├── index.css          # 全局样式
│   ├── main.tsx           # 应用入口
│   └── types.ts           # TypeScript 类型定义
├── index.html             # HTML 入口文件
├── package.json           # 项目依赖和脚本
└── README.md              # 项目说明文件
```

## 核心逻辑简述

### 1. 数据获取 (`fetchOnChainData`)

- 应用首先会获取过去 N 天的每日链上数据快照。
- **Lido (stETH)**:
  - 获取每日的 `sharesOf` (份额) 和 `getPooledEthByShares` (用于计算 stETH/ETH 汇率)。
  - 其收益主要体现在汇率的增长上。
- **Aave Umbrella (stk-Assets)**:
  - 获取每日的 `balanceOf` (凭证代币余额) 和 `previewRedeem` (用于计算与底层资产的汇率)。
  - 同时调用奖励合约的 `calculateCurrentUserRewards` 获取累积的未领取奖励。

### 2. 收益计算 (`processData`)

- 遍历每日数据，通过与前一天对比来计算每日收益。
- **每日借贷收益** = `(当日汇率 - 昨日汇率) * 当日余额`
- **每日激励收益** = `当日未领取奖励 - 昨日未领取奖励`
- **每日总收益** = `借贷收益 + 激励收益`
- **周期 APY** = `(日均总收益 * 365) / 当前总本金` (以资产单位计算)
- **图表持仓价值 (USD)** = `每日持仓价值(资产单位) * 资产美元价格`

---
*该项目旨在提供一个清晰、透明的 DeFi 收益分析工具。*
