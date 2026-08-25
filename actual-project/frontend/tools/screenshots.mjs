// 把 App 的每一屏截成图，存到 screenshots/。
// 跑法：先 npm run dev，然后 node tools/screenshots.mjs
//
// 用的是电脑上已经装好的 Chrome（puppeteer-core 不自己下浏览器）。

import puppeteer from 'puppeteer-core';
import { mkdir, rm } from 'node:fs/promises';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = 'http://localhost:5173';
const OUT = 'screenshots';

// 手机尺寸，截出来就是干净的界面，没有浏览器边框
const VIEWPORT = { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let n = 0;
async function shot(page, name) {
  n += 1;
  const file = `${OUT}/${String(n).padStart(2, '0')}-${name}.png`;
  await page.screenshot({ path: file });
  console.log('  ✓', file);
}

// 长页面的整页截图。
// 页面本身不滚动（每屏都是 position:absolute + 内部容器滚动），
// 所以 puppeteer 的 fullPage 没用 —— 改成把窗口临时拉到内容那么高。
async function shotFull(page, name) {
  const height = await page.evaluate(() => {
    const box = document.querySelector('.screen.scroll-y');
    return box ? box.scrollHeight + 40 : 0;
  });
  if (!height) return shot(page, name);

  await page.setViewport({ ...VIEWPORT, height: Math.min(height, 8000) });
  await sleep(900);
  await shot(page, name);
  await page.setViewport(VIEWPORT);
  await sleep(600);
}

// 按按钮上的文字点它。
// 用页面内的 .click() 而不是模拟鼠标 —— 有些按钮上面盖着半透明遮罩，
// 模拟鼠标会点不中，但功能上是可以点的。
async function click(page, text) {
  const ok = await page.evaluate((t) => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const target = buttons.find((b) => b.innerText.trim().startsWith(t));
    if (!target) return false;
    target.click();
    return true;
  }, text);
  if (!ok) throw new Error(`点不到按钮：${text}`);
}

// 直接改地址栏（单页应用，用 history 切页面不刷新，草稿才不会丢）
async function goto(page, path) {
  await page.evaluate((p) => {
    history.pushState({}, '', p);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
  await sleep(900);
}

async function main() {
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--hide-scrollbars', '--force-device-scale-factor=2'],
  });

  const page = await browser.newPage();
  await page.setViewport(VIEWPORT);

  // 1. 启动页（2.6 秒后会自动跳走，所以要抢在前面截）
  console.log('启动页 / 欢迎页');
  await page.goto(BASE + '/', { waitUntil: 'networkidle2' });
  await sleep(600);
  await shot(page, 'splash');

  await sleep(2400);
  await shot(page, 'welcome');

  // 2. 领号页
  console.log('领号');
  await goto(page, '/identity?next=/report/photo');
  await shot(page, 'identity-get-id');

  await click(page, 'I have an ID');
  await sleep(500);
  await shot(page, 'identity-have-id');

  await click(page, 'Get an ID');
  await sleep(400);
  await click(page, 'Get My Number');
  await sleep(1200);
  await shot(page, 'identity-your-number');

  await click(page, 'Continue');
  await sleep(1000);

  // 3. 拍照
  console.log('记录流程');
  await goto(page, '/report/photo');
  await shot(page, 'report-photo-empty');

  // 塞一张示例照片进去（真的走上传那条路）
  await page.evaluate(async () => {
    const input = document.querySelectorAll('input[type=file]')[1];
    const res = await fetch('/sample-litter.jpg');
    const blob = await res.blob();
    const dt = new DataTransfer();
    dt.items.add(new File([blob], 'litter.jpg', { type: 'image/jpeg' }));
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await sleep(1500);
  await shot(page, 'report-photo-taken');

  // 4. 定位授权
  await click(page, 'Continue');
  await sleep(1200);
  await shot(page, 'report-location-permission');

  // 隐私说明弹层
  await click(page, 'Why do we need this');
  await sleep(700);
  await shot(page, 'privacy-sheet');
  await click(page, 'Got it');
  await sleep(500);

  // 5. 手选海滩
  await click(page, 'Choose Beach Manually');
  await sleep(1200);
  await shot(page, 'report-choose-beach');

  // 6. 填类别数量
  await click(page, 'Pantai Morib');
  await sleep(1000);
  await shot(page, 'report-details-empty');

  // 必填校验
  await click(page, 'Continue');
  await sleep(600);
  await shot(page, 'report-details-required');

  await click(page, 'Plastic');
  await sleep(200);
  await click(page, 'Medium');
  await sleep(400);
  await shot(page, 'report-details-filled');

  // 7. 复核
  await click(page, 'Continue');
  await sleep(1000);
  await shot(page, 'report-review');

  // 8. 保存成功
  await click(page, 'Submit Report');
  await sleep(2200);
  await shot(page, 'report-saved');

  // 9. 首页
  console.log('主要页面');
  await goto(page, '/home');
  await sleep(600);
  await shot(page, 'home');

  // 10. 地图（等瓦片加载完）
  await goto(page, '/map');
  await sleep(3500);
  await shot(page, 'map-litter');

  // 点一个海滩标记，弹出卡片
  await page.evaluate(() => {
    const markers = document.querySelectorAll('.leaflet-marker-icon');
    if (markers.length) markers[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await sleep(1200);
  await shot(page, 'map-beach-card');

  // 生物多样性图层
  await click(page, 'Biodiversity');
  await sleep(1500);
  await page.evaluate(() => {
    const markers = document.querySelectorAll('.leaflet-marker-icon');
    if (markers.length) markers[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await sleep(1200);
  await shot(page, 'map-biodiversity');

  // 11. 海滩详情
  await goto(page, '/beach/morib');
  await sleep(1600);
  await shot(page, 'beach-morib-top');
  await shotFull(page, 'beach-morib-full');

  // 证据不足的那个海滩
  await goto(page, '/beach/kelanang');
  await sleep(1600);
  await shot(page, 'beach-insufficient-data');

  // 12. 评分说明（整页）
  await goto(page, '/method');
  await sleep(1200);
  await shot(page, 'scoring-method-top');
  await shotFull(page, 'scoring-method-full');

  // 13. 我的记录
  await goto(page, '/reports');
  await sleep(1200);
  await shot(page, 'my-reports-all');

  await click(page, 'Excluded');
  await sleep(800);
  await shot(page, 'my-reports-excluded');

  // 14. 账户
  await goto(page, '/account');
  await sleep(1000);
  await shot(page, 'account');

  // 15. 离线状态（账户页那个开关是 checkbox，不是按钮）
  await page.evaluate(() => {
    const box = document.querySelector('input[type=checkbox]');
    if (box) box.click();
  });
  await sleep(500);
  await goto(page, '/map');
  await sleep(3000);
  await shot(page, 'map-offline');

  await browser.close();
  console.log(`\n完成，共 ${n} 张，在 ${OUT}/`);
}

main().catch((err) => {
  console.error('出错了：', err.message);
  process.exit(1);
});
