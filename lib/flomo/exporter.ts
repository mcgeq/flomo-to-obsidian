import * as playwright from 'playwright';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';

import { DOWNLOAD_FILE, AUTH_FILE, FLOMO_PLAYWRIGHT_CACHE_LOC } from './const'

export class FlomoExporter {
    async export(headlessMode: boolean = true): Promise<[boolean, string]> {
        let browser = null;
        let page = null;
        
        const screenshotDir = path.join(FLOMO_PLAYWRIGHT_CACHE_LOC, 'screenshots');
        fs.ensureDirSync(screenshotDir);
        
        try {
            // Setup - 使用可配置的反检测配置
            console.log('[FlomoExporter] 启动浏览器, headlessMode:', headlessMode);
            browser = await playwright.chromium.launch({ 
                headless: headlessMode,
                args: [
                    '--disable-blink-features=AutomationControlled',
                    '--no-sandbox',
                ]
            });

            const context = await browser.newContext({ 
                storageState: AUTH_FILE,
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                viewport: { width: 1920, height: 1080 },
                locale: 'zh-CN',
                timezoneId: 'Asia/Shanghai',
            });
            page = await context.newPage();

            console.log('[FlomoExporter] 正在访问导出页面...');
            await page.goto('https://v.flomoapp.com/mine?source=export', { waitUntil: 'domcontentloaded', timeout: 60000 });

            await page.waitForLoadState('load');
            await page.waitForTimeout(2000);
            await page.screenshot({ path: path.join(screenshotDir, '01_export_page.png'), fullPage: true });
            console.log('[FlomoExporter] 已截图: ' + path.join(screenshotDir, '01_export_page.png'));

            const exportDialog = page.locator('text=导出笔记').first();
            await exportDialog.waitFor({ state: 'visible', timeout: 10000 });

            // 尝试多种方式查找按钮
            let exportButton = null;
            let foundMethod = '';

            // 方式1: 直接查找 Element UI 按钮（最精确的方式）
            try {
                exportButton = page.locator('button.el-button.el-button--text').filter({ hasText: /^[\s]*导出[\s]*$/ }).first();
                await exportButton.waitFor({ state: 'visible', timeout: 5000 });
                foundMethod = '方式1';
            } catch (e) {
                // 方式1失败
            }

            // 方式2: 通过包含"导出全部笔记"文本的行,找同行的按钮
            if (!exportButton) {
                try {
                    const container = page.locator('text=导出全部笔记').locator('..');
                    exportButton = container.locator('button').filter({ hasText: /^[\s]*导出[\s]*$/ }).first();
                    await exportButton.waitFor({ state: 'visible', timeout: 5000 });
                    foundMethod = '方式2';
                } catch (e) {
                    // 方式2失败
                }
            }

            // 方式3: 直接查找所有文本为"导出"的可点击元素
            if (!exportButton) {
                try {
                    exportButton = page.locator('button:has-text("导出"), a:has-text("导出"), [role="button"]:has-text("导出")').filter({ hasText: /^[\s]*导出[\s]*$/ }).first();
                    await exportButton.waitFor({ state: 'visible', timeout: 5000 });
                    foundMethod = '方式3';
                } catch (e) {
                    // 方式3失败
                }
            }

            if (!exportButton) {
                await page.screenshot({ path: path.join(screenshotDir, 'error_export_button_not_found.png'), fullPage: true });
                console.error('[FlomoExporter] 无法找到导出按钮, 已截图保存: ' + path.join(screenshotDir, 'error_export_button_not_found.png'));
                throw new Error('无法找到导出按钮');
            }

            console.log('[FlomoExporter] 找到导出按钮, 使用:', foundMethod);

            await exportButton.scrollIntoViewIfNeeded();
            await page.waitForTimeout(500);

            const downloadPromise = page.waitForEvent('download', { timeout: 10 * 60 * 1000 });

            console.log('[FlomoExporter] 正在点击导出按钮...');
            await exportButton.click({ timeout: 5000 });
            await page.waitForTimeout(1000);
            await page.screenshot({ path: path.join(screenshotDir, '02_export_clicked.png'), fullPage: true });
            console.log('[FlomoExporter] 已截图: ' + path.join(screenshotDir, '02_export_clicked.png'));

            const hasProgress = await page.locator('text=导出中, text=正在导出, text=生成中').count();
            console.log('[FlomoExporter] 导出进度显示:', hasProgress > 0 ? '是' : '否');

            console.log('[FlomoExporter] 等待下载完成...');
            const download = await downloadPromise;
            console.log('[FlomoExporter] 下载文件名:', download.suggestedFilename());
            await download.saveAs(DOWNLOAD_FILE);
            console.log('[FlomoExporter] 文件已保存到:', DOWNLOAD_FILE);

            // Teardown
            await context.close();
            await browser.close();

            return [true, ""]
        } catch (error) {
            console.error('[FlomoExporter] 导出过程出错:', error);

            // 出错时保存截图
            if (page) {
                try {
                    const errorScreenshot = path.join(screenshotDir, `error_${Date.now()}.png`);
                    await page.screenshot({ path: errorScreenshot, fullPage: true });
                    console.log('[FlomoExporter] 出错截图已保存:', errorScreenshot);
                } catch (e) {
                    console.error('[FlomoExporter] 保存出错截图失败:', e);
                }
            }

            // 确保浏览器关闭
            if (browser) {
                try {
                    await browser.close();
                } catch (e) {
                    console.error('关闭浏览器失败:', e);
                }
            }

            return [false, `导出失败: ${error.message || error}`];
        }
    }

}