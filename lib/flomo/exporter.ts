import * as playwright from 'playwright';

import { DOWNLOAD_FILE, AUTH_FILE } from './const'

export class FlomoExporter {
    async export(): Promise<[boolean, string]> {
        let browser = null;
        try {
            // Setup - 使用无头模式，添加反检测配置
            browser = await playwright.chromium.launch({ 
                headless: true,
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
            const page = await context.newPage();

            await page.goto('https://v.flomoapp.com/mine', { waitUntil: 'domcontentloaded', timeout: 60000 });
            await page.waitForTimeout(3000);

            await page.goto('https://v.flomoapp.com/mine?source=export', { waitUntil: 'domcontentloaded', timeout: 60000 });

            await page.waitForLoadState('load');
            await page.waitForTimeout(2000);

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
                throw new Error('无法找到导出按钮');
            }

            await exportButton.scrollIntoViewIfNeeded();
            await page.waitForTimeout(500);

            const downloadPromise = page.waitForEvent('download', { timeout: 10 * 60 * 1000 });

            await exportButton.click({ timeout: 5000 });
            await page.waitForTimeout(1000);

            const hasProgress = await page.locator('text=导出中, text=正在导出, text=生成中').count();

            const download = await downloadPromise;
            await download.saveAs(DOWNLOAD_FILE);

            // Teardown
            await context.close();
            await browser.close();

            return [true, ""]
        } catch (error) {
            console.error('导出过程出错:', error);

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