# 🌟 互動課堂大挑戰 - 架設與部署指南 (GitHub Pages)

本專案已完成 **Serverless (無伺服器) 即時連線改版**。我們使用 MQTT over WebSockets 協定透過免費公共傳輸伺服器進行即時數據同步，因此 **不需架設任何後端伺服器**，即可讓老師與多位學生在不同裝置（如手機、平板、電腦）上進行即時互動。

您可以將專案直接上傳至 **GitHub Pages** 免費託管，網站載入速度極快且完全免費！以下是詳細的架設步驟：

---

## 📂 專案檔案說明
您的專案資料夾內包含以下三個主要檔案：
1. **[index.html](file:///d:/ClassroomChallenge/index.html)** - 系統的主結構頁面（包含角色選擇、教師看板與學生答題精靈）。
2. **[style.css](file:///d:/ClassroomChallenge/style.css)** - 精美視覺設計（包含毛玻璃質感、漸層發光按鈕、動態長條圖、卡片式排行榜與便利貼悄悄話牆）。
3. **[client.js](file:///d:/ClassroomChallenge/client.js)** - 即時連線與動態邏輯（包含 MQTT 即時通訊、在線人數心跳偵測、語音辨識輸入與五彩紙屑煙火特效）。

---

## 🚀 部署至 GitHub Pages 步驟

因為您本機尚未安裝 Git 命令列工具，您可以使用 **GitHub 網頁版** 進行滑鼠拖曳上傳，非常簡單快速：

### 第一步：建立 GitHub 儲存庫 (Repository)
1. 登入您的 [GitHub 帳號](https://github.com/)。
2. 點擊網頁右上角的 **「+」** 按鈕，選擇 **「New repository」**（新增儲存庫）。
3. 設定儲存庫名稱，例如：`classroom-challenge`。
4. 將權限設為 **Public**（公開），這是一啟用 GitHub Pages 的必要設定。
5. 不要勾選任何初始化選項（不要新增 README、.gitignore 或 License）。
6. 點擊最下方的 **「Create repository」**。

### 第二步：上傳專案檔案
1. 建立成功後，您會看到一個引導頁面。點擊中間藍色字體的 **「uploading an existing file」**（上傳現有檔案）。
2. 開啟您電腦中的 `d:\ClassroomChallenge` 資料夾。
3. 將以下三個檔案選取，並**拖曳**到瀏覽器上傳區域中：
   - `index.html`
   - `style.css`
   - `client.js`
4. 網頁下方會顯示正在上傳。上傳完成後，在 Commit 留言處填寫（例如：`Initial commit`）。
5. 點擊綠色的 **「Commit changes」** 按鈕。

### 第三步：啟用 GitHub Pages 網頁託管
1. 在您剛剛建立的 GitHub 專案頁面上方，點選 **「Settings」**（設定，齒輪圖示）。
2. 在左側選單中，點選 **「Pages」**。
3. 在 **Build and deployment** 下方的 **Branch** 設定中：
   - 將原本的 `None` 改為 **`main`**（或 `master`）。
   - 後方資料夾保持選擇 **`/ (root)`**。
   - 點擊右側的 **「Save」**（儲存）。
4. 儲存後，等待約 1-2 分鐘，重新整理頁面。在 Pages 設定頁面頂端將會出現您的專屬網址！
   - 網址格式通常為：`https://你的GitHub帳號.github.io/classroom-challenge/`

---

## 🎮 如何開始使用？

1. **教師端**：
   - 使用瀏覽器開啟您的 GitHub Pages 網址。
   - 點選 **「我是老師」**，輸入一組房間代碼（例如：`1234`），接著點擊 **「啟動大螢幕看板」**。
   - 將此大螢幕畫面投影到教室投影幕上。

2. **學生端**：
   - 讓學生使用手機或平板掃描您的網址（或手動輸入網址）。
   - 點選 **「我是學生」**，輸入相同的房間代碼（例如：`1234`），選擇自己的班級後進入。
   - 學生開始進行挑戰，答題時老師的看板會**即時**更新作答人數、統計圖表、排行榜與悄悄話便利貼！

---

## 🛠️ 本地測試方法
在尚未上傳至 GitHub 之前，您也可以在電腦上直接雙擊打開 **[index.html](file:///d:/ClassroomChallenge/index.html)** 進行測試：
1. 用瀏覽器開啟 `index.html`，選擇老師模式，輸入房間號碼 `999`。
2. 另外開啟一個**新的瀏覽器視窗**（或使用手機掃描電腦的 IP，如果在同個網路下），同樣開啟 `index.html`。
3. 選擇學生模式，輸入房間號碼 `999` 並作答。
4. 送出後，老師的視窗就會立刻響應，呈現即時統計與煙火回饋！
