#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createRequire } = require('module');

function loadPlaywright() {
  const roots = [
    path.join(process.cwd(), 'node_modules'),
    ...(fs.existsSync(path.join(process.env.HOME || '', '.npm/_npx'))
      ? fs.readdirSync(path.join(process.env.HOME, '.npm/_npx')).map((entry) =>
          path.join(process.env.HOME, '.npm/_npx', entry, 'node_modules')
        )
      : []),
  ];

  for (const root of roots) {
    try {
      return createRequire(path.join(root, 'noop.js'))('playwright');
    } catch {
      // Continue trying npx caches.
    }
  }

  throw new Error('Playwright is not available. Run `npx playwright --version` once, then retry.');
}

async function openCanvas(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1024 } });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    localStorage.setItem(
      'openaiteach-session',
      JSON.stringify({
        state: {
          session: {
            ok: true,
            sessionToken: 'verify-session',
            oatProxySid: 'verify-sid',
            userId: 'verify-user',
            username: 'verify-user',
          },
        },
        version: 0,
      })
    );
  });
  await page.reload({ waitUntil: 'networkidle' });
  return { context, page };
}

async function createUploadedImageNode(page) {
  await page.locator('div.fixed.left-4 button').first().click();
  await page.getByText(/Add Nodes|添加节点/).click();
  await page.getByText(/Image|图片/).first().click();
  await page.waitForTimeout(800);
  await expectText(page, '上传素材');
  await page.locator('input[type=file]').setInputFiles(path.join(process.cwd(), 'public/workflow-sample-1.png'));
  await page.waitForTimeout(1000);
  await expectText(page, '多角度');
  await expectText(page, '已引用素材 · 1');
}

async function main() {
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ headless: true });
  const artifactDir = path.join(process.cwd(), '.omx', 'logs', 'liblib-image-node-smoke');
  fs.mkdirSync(artifactDir, { recursive: true });
  const artifacts = [];

  await runCase(browser, 'blank/upload/focus', async (page) => {
    await createUploadedImageNode(page);
    await saveScreenshot(page, artifactDir, artifacts, '01-uploaded-image-node.png', 'Uploaded image node with selected bottom panel.');
    await page.getByRole('button', { name: '聚焦' }).click();
    await page.waitForTimeout(400);
    const preview = await page.locator('img[alt="聚焦模式预览"]').boundingBox();
    if (!preview) throw new Error('focus preview not visible');
    await page.mouse.move(preview.x + preview.width * 0.2, preview.y + preview.height * 0.25);
    await page.mouse.down();
    await page.mouse.move(preview.x + preview.width * 0.55, preview.y + preview.height * 0.6, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(300);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await expectText(page, '已聚焦局部');
    await saveScreenshot(page, artifactDir, artifacts, '02-focus-persisted.png', 'Focus selection persisted back to the image node.');
  });

  await runCase(browser, 'connector-menu', async (page) => {
    await createUploadedImageNode(page);
    const connector = page.locator('[data-connector-side="right"]').first();
    const box = await connector.boundingBox();
    if (!box) throw new Error('right connector not visible');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 260, box.y + 120, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(500);
    await expectText(page, '图生视频');
    await expectText(page, '主路径');
    await saveScreenshot(page, artifactDir, artifacts, '03-connector-menu.png', 'Image connector blank-drop menu with 图生视频 primary path.');
    await page.getByText('图生视频').first().click();
    await page.waitForTimeout(800);
    await expectOneOfText(page, ['首帧素材已接入', '图生视频主路径', '生成视频']);
    await saveScreenshot(page, artifactDir, artifacts, '03b-connector-menu-created-video.png', 'Image connector blank-drop menu created an image-to-video node.');
  });

  await runCase(browser, 'image-to-video-direct', async (page) => {
    await createUploadedImageNode(page);
    await page.locator('div.fixed.left-4 button').first().click();
    await page.getByText(/Add Nodes|添加节点/).click();
    await page.getByText(/Video|视频/).first().click();
    await page.waitForTimeout(800);

    const imageRight = page.locator('[data-node-type="Image"] [data-connector-side="right"]').first();
    const videoLeft = page.locator('[data-node-type="Video"] [data-connector-side="left"]').first();
    const imageRightBox = await imageRight.boundingBox();
    const videoLeftBox = await videoLeft.boundingBox();
    if (!imageRightBox || !videoLeftBox) throw new Error('image/video connector handles not visible');

    await page.mouse.move(imageRightBox.x + imageRightBox.width / 2, imageRightBox.y + imageRightBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(videoLeftBox.x + videoLeftBox.width / 2, videoLeftBox.y + videoLeftBox.height / 2, { steps: 14 });
    await page.mouse.up();
    await page.waitForTimeout(800);
    await expectOneOfText(page, ['图生视频主路径', '首帧素材已接入', '生成视频']);
    await saveScreenshot(page, artifactDir, artifacts, '04-direct-image-to-video.png', 'Direct image node to video node connection entered image-to-video state.');
  });

  await runCase(browser, 'nine-grid', async (page) => {
    await createUploadedImageNode(page);
    await page.evaluate(() => [...document.querySelectorAll('button')].find((el) => el.textContent?.includes('九宫格'))?.click());
    await page.waitForTimeout(300);
    await page.evaluate(() => [...document.querySelectorAll('button')].find((el) => el.textContent?.includes('剧情推演四宫格'))?.click());
    await page.waitForTimeout(1400);
    await expectOneOfText(page, ['九宫格-原图', '当前动作 · 剧情推演四宫格', '-grid']);
    await saveScreenshot(page, artifactDir, artifacts, '05-nine-grid.png', 'Nine-grid action produced visible grid output state.');
  });

  await browser.close();
  fs.writeFileSync(
    path.join(artifactDir, 'manifest.json'),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        baseUrl: 'http://127.0.0.1:5173/',
        artifacts,
      },
      null,
      2
    )
  );
  console.log(`Liblib image-node smoke verification passed. Artifacts: ${artifactDir}`);
}

async function saveScreenshot(page, artifactDir, artifacts, fileName, description) {
  const filePath = path.join(artifactDir, fileName);
  await page.screenshot({ path: filePath });
  const sha256 = crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
  artifacts.push({ fileName, filePath, sha256, description });
}

async function runCase(browser, name, fn) {
  const { context, page } = await openCanvas(browser);
  try {
    await fn(page);
  } catch (error) {
    await page.screenshot({ path: `/tmp/liblib-image-node-${name}.png` }).catch(() => {});
    throw error;
  } finally {
    await context.close();
  }
}

async function expectText(page, text) {
  if ((await page.getByText(text, { exact: false }).count()) === 0) {
    throw new Error(`Expected text not found: ${text}`);
  }
}

async function expectOneOfText(page, texts) {
  for (const text of texts) {
    if ((await page.getByText(text, { exact: false }).count()) > 0) return;
  }
  throw new Error(`Expected one of texts not found: ${texts.join(', ')}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
