import { App, Modal, Plugin, Setting, Notice } from 'obsidian';
import * as fs from 'fs-extra';
import type FlomoImporterPlugin from '../../main';
import { createExpOpt } from './common';
import { FlomoImporter } from '../flomo/importer';
import * as path from 'path';


export class ManualSyncUI extends Modal {
    plugin: FlomoImporterPlugin;
    rawPath: string;

    constructor(app: App, plugin: FlomoImporterPlugin) {
        super(app);
        this.plugin = plugin;
        this.rawPath = "";
    }

    onOpen() {

        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl("h3", { text: "AdHoc Import" });

        new Setting(contentEl)
            .setName('Flomo Backup File')
            .setDesc('Enter the full path to your flomo export zip file')
            .addText((text) => {
                text.setPlaceholder('C:/path/to/flomo_export.zip')
                    .setValue(this.rawPath)
                    .onChange((value) => {
                        this.rawPath = value;
                    });
            });
    
        new Setting(contentEl)
        .addButton((btn) => {
            btn.setButtonText("Cancel")
                .setCta()
                .onClick(async () => {
                    await this.plugin.saveSettings();
                    this.close();
                })
        })
        .addButton((btn) => {
            btn.setButtonText("Import")
                .setCta()
                .onClick(async () => {
                    if (!this.rawPath) {
                        new Notice("No file selected.");
                        return;
                    }

                    try {
                        const config = this.plugin.settings;
                        config["rawDir"] = this.rawPath;
                        config["syncedMemoIds"] = this.plugin.settings.syncedMemoIds || [];

                        const flomo = await (new FlomoImporter(this.app, config)).import();

                        if (flomo.syncedMemoIds && flomo.syncedMemoIds.length > 0) {
                            this.plugin.settings.syncedMemoIds = flomo.syncedMemoIds;
                            await this.plugin.saveSettings();
                        }

                        new Notice(`Import Completed. Total: ${flomo.memos.length}, New: ${flomo.newMemosCount || 0}`);
                        await this.plugin.saveSettings();
                        this.close();
                    } catch (err) {
                        console.error(err);
                        new Notice(`Import Error: ${err}`);
                    }
                })
        });


    }

}