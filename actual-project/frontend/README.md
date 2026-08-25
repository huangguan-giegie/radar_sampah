# Radar Sampah — Web App（Iteration 1）

基于 `Radar Sampah Iteration 1` 原型实现的前端。
React + Vite + TypeScript，移动优先，桌面上收成一台手机的构图。

## 跑起来

```bash
npm install
npm run dev
```

打开 http://localhost:5173 。**不需要后端** —— 默认走 `src/api/mock/` 的假数据。

## 接后端

```bash
cp .env.example .env
# 填上 VITE_API_BASE_URL=https://your-api.example.com
npm run dev
```

只要后端满足 [API.md](./API.md) 里的契约，页面代码一行都不用改。
接口规范已定稿，直接发给后端即可；机器可读版本是 [openapi.yaml](./openapi.yaml)
（能导入 Swagger UI，也能用来生成服务端骨架）。
字段对不上时，改动限定在这三个文件：

- `src/api/endpoints.ts` —— 路径
- `src/api/real.ts` —— 请求/响应映射
- `src/types.ts` —— 数据类型

## 目录

```
src/
├─ main.tsx        程序入口
├─ App.tsx         路由表：哪个网址显示哪个页面
├─ api.ts          ★ 所有和后端打交道的代码都在这一个文件
├─ mockData.ts     假数据（后端做好就用不到了）
├─ scoring.ts      US4.3 公布的评分规则
├─ types.ts        数据类型（= 和后端约定的数据长什么样）
├─ theme.ts        颜色、字体、小工具函数
├─ AppContext.tsx  全局状态：当前用户、记录草稿、提示条
├─ screens/        15 个页面，一个文件一个
└─ components/     复用的小组件：按钮、图标、地图、底部导航、弹层
```

代码写法上刻意保持简单，方便讲解和答辩：

- **不装状态管理库**，用 React 自带的 Context
- **不装 UI 框架**，样式全是内联 style + `theme.ts` 里的颜色常量
- **不封装数据请求**，每个页面就是最普通的 `useState` + `useEffect`：

  ```tsx
  const [beaches, setBeaches] = useState<BeachSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getBeaches()
      .then((list) => setBeaches(list))
      .catch(() => setBeaches([]))
      .finally(() => setLoading(false));
  }, []);
  ```

- **`api.ts` 里每个函数都是同一个结构**，一眼能看懂真假数据是怎么切换的：

  ```ts
  export async function getBeaches(): Promise<BeachSummary[]> {
    if (USE_MOCK) {
      await delay();
      return BEACHES.map(toSummary);   // 假数据
    }
    return request('/beaches');        // 真后端
  }
  ```

## 界面清单

启动页 · 欢迎 · 匿名领号/找回 · 首页 · 地图（垃圾/生物两图层）· 海滩详情 ·
评分说明 · 拍照 · 定位授权 · 确认海滩 · 记录垃圾 · 复核修正 · 保存成功 ·
我的记录 · 账户

边缘状态：定位被拒、手动选海滩、离线（账户页可手动开启用于演示）、上传失败、
必填校验、证据不足、数据过期。

## 和原型的差异

- **地图可以拖动缩放**。原型里是锁死的静态图，Web App 上放开更合理。
- **照片是真的拍/真的传**。原型用渐变占位；这里走 `<input type="file" capture>`，
  移动端直接开相机，桌面端退化为选文件。
- **定位是真的**。走 `navigator.geolocation`，用户拒绝时进手选分支。
- **不收集任何个人数据**。匿名参与者编号 + 恢复密钥，无姓名/邮箱/密码（API.md §1）。
- **海滩封面**优先用后端的 `coverImageUrl`，没配图时自动退回设计稿的 CSS 渐变占位，
  所以新海滩没图也不会开天窗。

## 导出截图

```bash
npm run dev          # 先跑起来
npm run screenshots  # 另开一个终端
```

会在 `screenshots/` 生成 28 张 PNG（390×844 的手机尺寸，2 倍图），
按流程顺序编号，文件名说明是哪一屏。海滩详情和评分说明另外各有一张整页长图。

脚本在 `tools/screenshots.mjs`，用的是电脑上已装的 Chrome（不会额外下载浏览器）。
改了界面之后重新跑一次就能更新全部截图。
