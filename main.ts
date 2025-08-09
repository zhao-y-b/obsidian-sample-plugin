import { App, addIcon, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, MarkdownEditView, Menu, Vault, Workspace, ItemView, WorkspaceLeaf, TAbstractFile, TFile, normalizePath, TextComponent, FileView, MarkdownRenderChild } from 'obsidian';
import express from 'express'
import * as http from 'http';       // 引入 node 的 http 模块，用于服务器类型
import * as path from 'path'
import { waitForDebugger } from 'inspector';
// Remember to rename these classes and interfaces!

let viewHTML = '';
let listenerReged = false;

export default class MyPlugin extends Plugin {
	private formatting: boolean = false;
    private lastWrapper: HTMLElement | null = null;
    private vault: Vault;
    private workspace: Workspace;
    private webApp: express.Application;
    private server: http.Server;
    private singleView?: GraphView

	async onload() {
		this.vault = this.app.vault;
        this.workspace = this.app.workspace;
        this.webApp = express();
        const vaultPath = (this.vault.adapter as any).getBasePath();
   
        this.webApp.use(express.static(path.join(vaultPath, this.app.vault.configDir, 'plugins', this.manifest.id, 'assets')));
        this.server = this.webApp.listen(9527, () => {
            console.log('server started.')
        }).on('error', err => {
            console.log(err)
        })

        addIcon("graph", `<svg
            version="1.1"
            viewBox="0 0 100 100"
            id="svg10"
            width="100"
            height="100"
            xmlns="http://www.w3.org/2000/svg"
            xmlns:svg="http://www.w3.org/2000/svg">
            <path
            fill="currentColor"
            stroke="currentColor"
            d="M14,4v92h72V29.2l-0.6-0.6l-24-24L60.8,4L14,4z M18,8h40v24h24v60H18L18,8z M62,10.9L79.1,28H62V10.9z"
            id="path8" />
            <path
            fill="currentColor"
            d="M 72.946,68.7522 H 65.398 L 57.4361,55.1533 c 1.8152,-0.3821 3.121,-1.9744 3.0893,-3.8218 V 41.1086 c 0,-2.1656 -1.7199,-3.9172 -3.8854,-3.9172 H 56.608 43.3272 c -2.1655,0 -3.9171,1.7197 -3.9171,3.8854 v 0.032 10.2229 c 0,1.8474 1.274,3.4397 3.0892,3.8218 l -7.9621,13.599 h -7.5151 c -2.1656,0 -3.9172,1.7196 -3.9172,3.8855 v 0.03 10.2233 c 0,2.1659 1.7198,3.9173 3.8854,3.9173 h 0.032 13.2806 c 2.1656,0 3.9172,-1.7196 3.9172,-3.8856 v -0.03 -10.2233 c 0,-2.166 -1.7198,-3.9173 -3.8855,-3.9173 h -0.032 -1.2742 l 7.8983,-13.5031 h 6.1463 l 7.9289,13.5029 h -1.3054 c -2.1661,0 -3.9177,1.7196 -3.9177,3.8855 v 0.03 10.2233 c 0,2.1659 1.7197,3.9173 3.8853,3.9173 h 0.033 13.2803 c 2.1663,0 3.9177,-1.7196 3.9177,-3.8856 v -0.03 -10.2233 c 0,-2.166 -1.7197,-3.9173 -3.886,-3.9173 -0.032,0 -0.032,0 -0.063,0 z"
            id="path6"
            style="display:inline" />
            </svg>`);

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'format-math-block',
			name: 'Format Math Block',
			callback: () => {
				this.formatting = !this.formatting;
				new Notice('Formatting toggled: ' + this.formatting);
			}
		});

        this.registerEvent(
            this.app.workspace.on('active-leaf-change', () => {
                this.attachMouseupListener();
            })
        );

        // Also attach on plugin load (for the initial editor)
        this.attachMouseupListener();

        this.registerEvent(
            this.app.workspace.on('editor-menu', this.handleEditorMenu, this)
        )

        this.registerView(
            'graph-view', // 这是视图的唯一标识符，我们通常定义为一个常量
            (leaf: WorkspaceLeaf) => new GraphView(this, leaf));
        this.registerExtensions(['graph'], 'graph-view')

        // const s1 = await this.tryCacheRemoteScript("https://cdnjs.cloudflare.com/ajax/libs/d3/3.5.17/d3.min.js","d3.js");
        // const s2 = await this.tryCacheRemoteScript("https://cdn.jsdelivr.net/npm/function-plot@1.18.0/dist/function-plot.min.js", "functionPlot.js")
        // const s3 = await this.tryCacheRemoteScript("https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js", "mermaid.js");

        const basePath = normalizePath(`.obsidian/plugins/${this.manifest.id}/assets/index.html`);
        viewHTML = await this.vault.adapter.read(basePath);

        this.registerMarkdownCodeBlockProcessor(
            'zyb-graph',
            async (source, el, ctx) => {
                el.empty();

                // 不再需要正则表达式！
                // source 就是我们想要的文件路径（可能需要 .trim() 去掉换行符）
                const filePath = source.trim(); 
                
                const file = this.vault.getAbstractFileByPath(filePath) as TFile
                if (file)
                {
                    const child = document.createElement('div');
                    child.innerHTML = await this.vault.read(file);
                    child.dataset.filePath = file.path;

                    child.addEventListener('click', (event) => {
                        // 2. 阻止事件继续传播，这一点非常重要！
                        //    它会阻止 Obsidian 执行默认的“切换到代码块”行为。
                        event.stopPropagation();
                        event.preventDefault();

                        // 3. 调用我们自己的函数来打开编辑器
                        this.initView(file);
                    });
                    
                    // 为了更好的用户体验，让鼠标悬停时显示为“可点击”的手形光标
                    child.style.cursor = 'pointer';

                    el.empty();
                    el.appendChild(child)
                }
            }
        );
        // const jsBlob1 = new Blob([s1], { type: 'text/javascript' });
        // const jsUrl1 = URL.createObjectURL(jsBlob1);
        // const jsBlob2 = new Blob([s1], { type: 'text/javascript' });
        // const jsUrl2 = URL.createObjectURL(jsBlob2);
        // const jsBlob3 = new Blob([s1], { type: 'text/javascript' });
        // const jsUrl3 = URL.createObjectURL(jsBlob3);
        // viewHTML = viewHTML.replace("<!--SCRIPT_PLACEHOLDER-->", `<script src="${jsUrl1}"></script><script src="${jsUrl2}"></script><script src="${jsUrl3}"></script>`);
    }

    handleEditorMenu(menu: Menu, editor: Editor, view: MarkdownView, ctx?: any) {
        const hostView = this.workspace.getActiveViewOfType(MarkdownView);
        if (!hostView || hostView !== view) {
            return; // Only handle the menu for the active Markdown view
        }

        // Add a custom menu item
        menu.addItem((item) => {
            item.setTitle('Insert Graph')
                .setIcon('graph')
                .onClick(async() => {
                    this.initView();
                });
        });
    }

    activeLeafPath(workspace: Workspace) {
        return workspace.activeLeaf?.view.getState().file as string;
    }

    async ensureFolderExists(folderPath: string) {
        const folder = this.app.vault.getAbstractFileByPath(folderPath);
        if (!folder) {
            await this.app.vault.createFolder(folderPath);
        }
    }


    async initView(file: TFile | null = null) {
        const hostView = this.workspace.getActiveViewOfType(MarkdownView)!;
        
        if (!file) {
            await this.ensureFolderExists('__data__/zyb/graphs');
            file = await this.app.vault.create(`__data__/zyb/graphs/${Date.now()}.graph`, `<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n<svg xmlns="http://www.w3.org/2000/svg" version="1.1">\n</svg>`);
            const cursor = hostView.editor.getCursor();
            hostView.editor.replaceRange(`\`\`\`zyb-graph\n${file.path}\n\`\`\``, cursor);
        } else {
            for (const view of this.workspace.getLeavesOfType('graph-view')) {
                if (view.view instanceof GraphView) {
                    view.openFile(file);
                    return await this.workspace.revealLeaf(view);
                }
            }

            const leaf = this.workspace.getLeaf('split', 'vertical');
            await leaf.openFile(file)
        }
    }

	private attachMouseupListener() {
        const editor = this.app.workspace.getActiveViewOfType(MarkdownView)?.editor;
        const cm = (editor as any)?.cm;
        if (cm?.contentDOM) {
            const wrapper = cm.contentDOM as HTMLElement;
            // Remove listener from previous wrapper if different
            if (this.lastWrapper && this.lastWrapper !== wrapper) {
                this.lastWrapper.removeEventListener('mouseup', this.onEditorMouseUp);
            }
            // Always remove before add to avoid stacking
            wrapper.removeEventListener('mouseup', this.onEditorMouseUp);
            wrapper.addEventListener('mouseup', this.onEditorMouseUp);
            this.lastWrapper = wrapper;
        }
    }

    private onEditorMouseUp = (event: MouseEvent) => {
        if (this.formatting) {
			this.applyFormat();
		}
    }
	
	private applyFormat() {
		const editor = this.app.workspace.getActiveViewOfType(MarkdownView)?.editor;

        if (!editor) return;

        // 这里可以添加您的格式处理逻辑
        const selectedText = editor.getSelection();
        // 示例: 只是简单地显示选中的内容

		if (!selectedText) return;

        const from = editor.getCursor("from");
        const to = editor.getCursor("to");

        // Get the full line text for both positions
        const lineText = editor.getLine(from.line);

        // Get previous character (if exists)
        let prevChar = '';
        if (from.ch > 0) {
            prevChar = lineText.charAt(from.ch - 1);
        }

        // Get next character (if exists)
        let nextChar = '';
        if (to.ch < lineText.length) {
            nextChar = lineText.charAt(to.ch);
        }

        if (prevChar === '$' && nextChar === '$') {
            // If the selection is already formatted, do nothing
            return;
        }

		let formatted = selectedText
			.replace(/（/g, '(')
			.replace(/）/g, ')')
			.replace(/，/g, ',')
			.replace(/；/g, ';')

		formatted = '$' + formatted + '$';
        
        // 这里添加您的格式处理逻辑
        // 示例: 保持选中内容不变
        editor.replaceSelection(formatted);
    }  
	
	onunload() {
        // Clean up event listener on unload
        if (this.lastWrapper) {
            this.lastWrapper.removeEventListener('mouseup', this.onEditorMouseUp);
            this.lastWrapper = null;
        }

        if (this.server) {
            this.server.close();
        }
    }

    async tryCacheRemoteScript(url: string, filename: string): Promise<string> {
        if (typeof normalizePath === "undefined") {
            // 测试环境或非 Obsidian 环境，直接加载
            return await (await fetch(url)).text();
        }

        const vendorDir = normalizePath(`.obsidian/plugins/${this.manifest.id}/assets`);
        const filePath = normalizePath(`${vendorDir}/${filename}`);

        if (!(await this.vault.adapter.exists(vendorDir))) {
            await this.vault.adapter.mkdir(vendorDir);
        }

        if (await this.vault.adapter.exists(filePath)) {
            const cached = await this.vault.adapter.read(filePath);
            return cached;
        }

        try {
            const script = await (await fetch(url)).text();
            await this.vault.adapter.write(filePath, script);
            return script;
        } catch (err) {
            console.warn(err);
            throw new Error(
            `无法加载远程脚本：${filename}。请检查网络连接或在 GitHub 上提交问题报告。`
            );
        }
    }
}

function insertMetadata(svgString: string, metadataObj: any) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(svgString, "image/svg+xml");

        // 创建 <metadata> 元素
        const metadataEl = doc.createElement("metadata");
        metadataEl.setAttribute("id", "zyb-metadata");
        metadataEl.textContent = JSON.stringify(metadataObj);

        // 插入到 <svg> 根节点中
        const svgRoot = doc.documentElement;
        const existing = svgRoot.querySelector("metadata#zyb-metadata");
        if (existing) {
            svgRoot.replaceChild(metadataEl, existing);
        } else {
            svgRoot.insertBefore(metadataEl, svgRoot.firstChild);
        }

        // 序列化回字符串
        const serializer = new XMLSerializer();
        return serializer.serializeToString(doc);
    }

function    readMetadata(svgString: string) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(svgString, "image/svg+xml");
        const metadata = doc.querySelector("metadata#zyb-metadata");
        if (metadata) {
            try {
            return JSON.parse(metadata.textContent!);
            } catch {
            return null;
            }
        }
        return null;
    }

class GraphView extends FileView {
    workspace: Workspace;
    vault: Vault;
    plugin: MyPlugin;
    onMessage = async (event: any) => {
        if (event.data.command === 'file') {
            const filePath = event.data.path;
            const source = event.data.source;
            let svg = event.data.svg;

            svg = insertMetadata(svg, source);
        
            await this.vault.adapter.write(normalizePath(filePath), svg);

            // 3. 遍历所有打开的 Markdown 窗口 (WorkspaceLeaf)
            this.app.workspace.getLeavesOfType('markdown').forEach(leaf => {
                // 安全地获取视图的 DOM 容器
                if (leaf.view instanceof MarkdownView) {
                const viewEl = leaf.view.contentEl;
                
                // 4. 这是核心：利用我们之前添加的 `data-file-path` 属性，
                //    精准找到所有正在显示这张图片的 DIV 容器
                const targetDivs: NodeListOf<HTMLDivElement> = 
                    viewEl.querySelectorAll(`div[data-file-path="${filePath}"]`);

                // 5. 遍历所有找到的容器，并更新它们的内容
                if (targetDivs.length > 0) {
                    targetDivs.forEach(divEl => {
                    // 直接用最新的 SVG 内容替换掉旧的 HTML
                    divEl.innerHTML = svg;
                    });
                }
                }
            });
        }
    }

    getViewType(): string {
        return 'graph-view';
    }

    constructor(plugin: MyPlugin, leaf: WorkspaceLeaf) {
        super(leaf);

        this.plugin = plugin;
        this.workspace = this.app.workspace;
        this.vault = this.app.vault;

        if (!listenerReged) {
            window.addEventListener('message', this.onMessage)
            listenerReged = true;
        } 
    }

    async onOpen() {
        const container = this.containerEl.children[1] as HTMLElement;

        container.style.position = 'relative';
        container.style.width = '100%';
        container.style.height = '100%';
        container.style.overflow = 'hidden';

        const iframe = document.createElement('iframe');
        iframe.style.position = 'absolute';
        iframe.style.top = '0';
        iframe.style.left = '0';
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.border = 'none';
        iframe.sandbox.add("allow-scripts")
        iframe.sandbox.add("allow-same-origin")
        iframe.sandbox.add("allow-forms")
        iframe.style.border = 'none';
        iframe.style.outline = 'none';
        iframe.style.overflow = 'hidden';
        iframe.setAttribute('scrolling', 'no')
        iframe.src = `http://localhost:9527/index.html`
        // 插入 iframe 并写入内容
        container.innerHTML = '';
        container.appendChild(iframe);

        let r: any;
        const p = new Promise<void>((resolve, reject) => {
            r = resolve;
        })
        iframe.onload = () => {
            r();
        }

        await p;
    }

    protected async onClose() {
    }

    async onLoadFile(file: TFile): Promise<void> {
        const container = this.containerEl.children[1] as HTMLElement;
        (container.children[0] as any).contentWindow!.postMessage({command: 'file', path:file.path, source: readMetadata(await this.vault.adapter.read(normalizePath(file.path))) || ''}, '*');
        this.file = file;
    }

    getDisplayText(): string {
        return 'Graph View';
    }
}

