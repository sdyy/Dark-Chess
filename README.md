# 🀄 暗棋大師 (Chinese Banqi Master)

[![Deploy to GitHub Pages](https://github.com/sdyy/Dark-Chess/actions/workflows/deploy.yml/badge.svg)](https://github.com/sdyy/Dark-Chess/actions/workflows/deploy.yml)
[![Demo Online](https://img.shields.io/badge/Demo-Online-brightgreen.svg)](https://sdyy.github.io/Dark-Chess/)

一款基於中國象棋半盤開發的暗棋對戰網頁遊戲。具備極致的現代暗色國風視覺美學，並搭載基於概率預測的 **Expectiminimax (期望極大極小) 博弈演算法** 大師級 AI。

👉 **[立即在線上遊玩！](https://sdyy.github.io/Dark-Chess/)**

---

## 🎨 遊戲三大特色

### 1. 🔮 極致暗色國風視覺 (Dark Oriental Design)
*   **玻璃擬物質感**：面板採用半透明玻璃質感搭配琥珀金描邊，營造深邃沉浸的博弈氛圍。
*   **3D 棋子卡片**：棋子未翻開時顯示金色太極八卦花紋，翻開時觸發順暢的 3D 翻轉動畫；陣亡時則有碎裂淡出動畫。
*   **白玉與墨玉棋子**：紅方棋子採用微晶白玉質感，黑方棋子採用墨玉質感，字體雕刻凹凸分明。

### 2. 💥 「大小碰撞制」暗吃機制
玩家可主動命令已翻開的棋子去暗吃相鄰（或炮隔子跳吃）的**未翻開蓋牌**：
*   **暗吃成功**：我方棋子階級 $\ge$ 敵方隱藏棋子階級（或兵吃將、炮跳吃），對方陣亡，我方佔位。
*   **暗吃失敗**：我方棋子階級 $<$ 敵方隱藏棋子階級，我方攻擊棋子陣亡，對方在**原地翻開揭露**。
*   **同色碰撞**：若暗吃的目標真實身分為我方同色子，視為暗吃失敗（我方攻擊子陣亡，該子原地翻開），有效防範透視試探。

### 3. 🧠 Expectiminimax 機率博弈 AI
*   **休閒 AI (Easy)**：採用啟發式規則，避開危險，優先進行安全的吃子。
*   **大師 AI (Hard)**：使用 `Expectiminimax` 演算法。AI 會在記憶體中維護場上「尚未翻開的棋子池」，計算翻棋或暗吃可能遭遇各棋子的概率分佈，並以此計算下一步的最優評估期望值。

---

## ⚙️ 可客製化規則開關
您可以在遊戲右側面板隨時調整以下規則：
*   **將帥吃兵卒**：關閉（預設，兵卒剋將帥）/ 開啟（將帥可吃兵卒）。
*   **仕士吃車俥**：關閉（預設）/ 開啟（仕士可吃車，車不可吃仕士，用以平衡車的強度）。
*   **炮跳吃暗棋**：開啟（預設，炮可跳吃蓋牌）/ 關閉。
*   **長打限制**：開啟（預設，禁止同一個棋子連續重複往返 3 次）/ 關閉。

---

## 🛠️ 本地開發指引

本專案採用 **Vite + Vanilla HTML5/CSS3/JavaScript (ES6)** 架構，無繁重的框架相依。

### 1. 安裝依賴
```bash
npm install
```

### 2. 啟動本地開發伺服器
```bash
npm run dev
```
瀏覽器將自動開啟：`http://localhost:3000/`

### 3. 編譯生產環境包
```bash
npm run build
```
輸出檔案將生成在 `dist/` 目錄中。

---

## 🚀 GitHub Actions 自動部署
本專案已配置好 GitHub Actions 流水線（於 `.github/workflows/deploy.yml`）。每當您將變更推送到 `main` 分支時，Action 會自動打包並發布至您的 **GitHub Pages** 網站。
