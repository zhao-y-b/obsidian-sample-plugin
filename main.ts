import { App, addIcon, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, MarkdownEditView, Menu, Vault, Workspace, ItemView, WorkspaceLeaf, TAbstractFile, TFile, normalizePath, TextComponent, FileView, MarkdownRenderChild, MarkdownPostProcessorContext } from 'obsidian';
import express from 'express'
import * as http from 'http';       // 引入 node 的 http 模块，用于服务器类型
import * as path from 'path'
import { MarkdownRenderer } from 'obsidian';
import AsciiMathParser from 'asciimath2tex';
import { Decoration, DecorationSet, EditorView, ViewUpdate } from '@codemirror/view';
import e from 'express';
import { StateField, EditorState, StateEffect, Transaction, RangeSetBuilder } from '@codemirror/state';
// Remember to rename these classes and interfaces!

const { execFile } = require('child_process')

let listenerReged = false;

const asciimathParser = new AsciiMathParser();


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

        addIcon("graph-icon", `<svg
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

        addIcon("whiteboard-icon", `<svg t="1755394880435" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="5903"><path d="M343.101334 452.785633l-18.942864 30.359778 31.537308-15.15429-12.594444-15.205488zM317.963642 383.055417c3.123013-9.113053 9.420235-18.226106 15.717457-24.267344l264.790513-230.539768c25.188889-21.195528 63.023419-18.17491 85.089294 3.071816l40.957543 42.442253c22.065876 24.267344 18.942863 60.66836-3.123013 81.915085L453.430714 486.114833c-6.297222 6.092434-18.942863 12.133672-28.363098 15.154291l-154.461132 63.688979c-3.123013 0-3.123013 0-6.297223 3.071815-12.594444 3.020619-22.014679-3.071816-31.537307-12.133672-6.297222-9.113053-6.297222-21.246725-3.123013-30.359778l88.263504-142.532248z m321.516709-212.313662L374.587445 401.230326l40.957542 42.493451 264.739316-230.539768-40.957543-42.49345z" fill="#333333" p-id="5904"></path><path d="M653.559506 857.906926h-280.047197L304.140472 1006.531608c-5.990041 15.154291-24.062556 21.195528-39.16565 15.154291-15.051897-6.092434-21.041937-24.267344-15.051897-39.421635L307.212287 857.906926H27.16509a27.083175 27.083175 0 0 1-27.134372-27.287963c0-15.154291 12.031278-27.287963 27.134372-27.287963h966.700398c15.051897 0 27.134372 12.133672 27.134372 27.287963a27.083175 27.083175 0 0 1-27.134372 27.287963h-280.047197l57.186969 124.306141c5.990041 15.154291 0 30.308581-15.051897 36.349819-15.051897 6.092434-30.154991 0-36.145031-12.082475l-66.248826-148.573485zM114.455853 0h798.108913c30.103794 0 60.207588 12.133672 81.300722 33.3292 18.072516 21.246725 30.103794 51.555307 30.103794 81.915085v515.297083c0 30.308581-12.031278 60.617163-33.124413 81.863888-21.093134 21.195528-51.196928 33.3292-81.300722 33.3292H114.455853a115.961042 115.961042 0 0 1-81.300722-33.3292A117.548147 117.548147 0 0 1 0.030718 630.541368V115.193088C0.030718 51.555307 51.227646 0 114.455853 0z m0 57.596544A57.34056 57.34056 0 0 0 57.268884 115.193088v515.34828c0 30.308581 24.062556 57.596544 57.186969 57.596544h798.108913a57.34056 57.34056 0 0 0 57.186969-57.596544V115.193088a57.34056 57.34056 0 0 0-57.186969-57.596544H114.455853z" fill="#333333" p-id="5905"></path></svg>`);

        // This adds a simple command that can be triggered anywhere
        this.addCommand({
            id: 'format-math-block',
            name: 'Format Math Block',
            callback: () => {
                this.formatting = !this.formatting;
                new Notice('Format AsciiMath To Tex: ' + this.formatting);
            }
        });

        // this.registerEvent(
        //     this.app.workspace.on('active-leaf-change', () => {
        //         this.attachMouseupListener();
        //     })
        // );

        // Also attach on plugin load (for the initial editor)
        //this.attachMouseupListener();

        this.registerEvent(
            this.app.workspace.on('editor-menu', this.handleEditorMenu, this)
        )


        function findDollars(state: EditorState): DecorationSet {
            const builder = new RangeSetBuilder<Decoration>();
            const text = state.doc.toString();

            // 使用正则表达式找到所有 $...$ 和 $$...$$ 的位置
            const regex = /(\$\$)(.*?)(\$\$)|(\$)(.*?)(\$)/gs;
            let match;

            while ((match = regex.exec(text)) !== null) {
                const from = match.index;
                const to = match.index + match[0].length;

                const block = match[0][1] === '$' && match[0].length > 2;
                // 创建一个 Decoration 对象，它只包含样式信息，没有位置
                const decoration = Decoration.mark({ type: block ? 'block' : 'inline' });

                // 使用 builder.add() 方法将 decoration 和其位置添加到 RangeSetBuilder 中
                // builder.add() 接受 from, to, 和 decoration 三个参数
                builder.add(from, to, decoration);
            }

            // builder.finish() 方法返回一个正确的 DecorationSet
            return builder.finish();
        }

        const dollarPositionsField = StateField.define<DecorationSet>({
            // 1. 定义初始值
            create(state: EditorState) {
                return findDollars(state);
            },

            // 2. 定义如何根据状态更新计算新值
            update(dollars: DecorationSet, transaction: Transaction) {
                // 如果文档没有发生变化，或者变化与公式位置无关，则直接返回旧值
                if (!transaction.docChanged) {
                    return dollars;
                }

                // 否则，重新计算所有公式的位置
                return findDollars(transaction.state);
            }
        });

        function findGrids(state: EditorState): DecorationSet {
            const builder = new RangeSetBuilder<Decoration>();
            const text = state.doc.toString();

            // 使用正则表达式找到所有 $...$ 和 $$...$$ 的位置
            const regex = /(\`\`\`\`grid)(.*?)(\`\`\`\`)/gs;
            let match;

            while ((match = regex.exec(text)) !== null) {
                const from = match.index;
                const to = match.index + match[0].length;

                // 创建一个 Decoration 对象，它只包含样式信息，没有位置
                const decoration = Decoration.mark({});

                // 使用 builder.add() 方法将 decoration 和其位置添加到 RangeSetBuilder 中
                // builder.add() 接受 from, to, 和 decoration 三个参数
                builder.add(from, to, decoration);
            }

            // builder.finish() 方法返回一个正确的 DecorationSet
            return builder.finish();
        }

        const gridPositionsField = StateField.define<DecorationSet>({
            // 1. 定义初始值
            create(state: EditorState) {
                return findGrids(state);
            },

            // 2. 定义如何根据状态更新计算新值
            update(grids: DecorationSet, transaction: Transaction) {
                // 如果文档没有发生变化，或者变化与公式位置无关，则直接返回旧值
                if (!transaction.docChanged) {
                    return grids;
                }

                // 否则，重新计算所有公式的位置
                return findGrids(transaction.state);
            }
        });

        let gridPreview: HTMLElement | null = null;
        let gridPreviewRender: any
        let lastFormula: any;
        this.registerEditorExtension([
            dollarPositionsField,
            gridPositionsField,

            EditorView.updateListener.of(async (update: ViewUpdate) => {
                if (!this.formatting) return;

                /// grid 编辑处理
                if (update.selectionSet) {
                    const cursorPos = update.view.state.selection.main.head;
                    const editor = this.app.workspace.activeEditor?.editor;
                    if (editor) {
                        const allGridRanges = update.view.state.field(gridPositionsField);
                        const cursorPos = update.view.state.selection.main.head;

                        let gridStart = -1;
                        let gridEnd = -1;
                        allGridRanges.between(cursorPos, cursorPos, (from, to, value) => {
                            if (cursorPos > from && cursorPos < to) {
                                gridStart = from;
                                gridEnd = to;
                                return false;
                            }
                        });


                        if (gridStart !== -1 && gridEnd !== -1) {
                            const activeLeaf = this.app.workspace.activeLeaf;
                            if (!activeLeaf) return;

                            if (gridPreviewRender) clearTimeout(gridPreviewRender);
                            gridPreviewRender = setTimeout(async () => {
                                const container = document.createElement('div');
                                container.style.position = 'fixed';
                                container.style.zIndex = '9999';
                                container.style.left = "-9999px";
                                container.style.top = "0px";
                                container.style.backgroundColor = "#fff"
                                document.body.appendChild(container);
                                await MarkdownRenderer.render(this.app, editor.getRange(editor.offsetToPos(gridStart), editor.offsetToPos(gridEnd)), container, this.app.workspace.activeEditor!.file!.path, new MarkdownRenderChild(container));
                                (container.firstChild as HTMLElement).style.left = "0px"
                                if (gridPreview) {
                                    document.body.removeChild(gridPreview)
                                    gridPreview = null;
                                }
                                container.style.left = "0px"
                                container.style.transformOrigin = "0 0"
                                container.style.transform = "scale(0.5,0.5)"
                                gridPreview = container;
                            }, 1000);
                        } else {
                            if (gridPreviewRender) clearTimeout(gridPreviewRender);
                            if (gridPreview) {
                                document.body.removeChild(gridPreview)
                                gridPreview = null;
                            }
                        }
                    }
                }

                /// math 编辑处理
                if (update.selectionSet) {
                    const allDollarRanges = update.view.state.field(dollarPositionsField);
                    const cursorPos = update.view.state.selection.main.head;

                    let currentFormula: any
                    allDollarRanges.between(cursorPos, cursorPos, (from, to, value) => {
                        if (cursorPos > from && cursorPos < to) {
                            currentFormula = { from, to, decoration: value };
                            return false;
                        }
                    });

                    if (lastFormula && lastFormula.decoration.spec.type === 'inline') {
                        if (!currentFormula || currentFormula.from !== lastFormula.from) {
                            ///需要重新计算lastFormula，to会发生变化
                            let toFormat:any = undefined
                            allDollarRanges.between(cursorPos, cursorPos, (from, to, value) => {
                                if (from === lastFormula.from) {
                                    toFormat = { from, to, decoration: value };
                                    return false;
                                }
                            });
                            if (toFormat) {
                                const math = update.view.state.doc.sliceString(toFormat.from + 1, toFormat.to - 1);
                                if (!math.includes('\\')) {
                                    this.app.workspace.activeEditor?.editor?.replaceRange('\\displaystyle ' + asciimathParser.parse(math).replaceAll('\\left', '').replaceAll('\\right', '').replaceAll('\\vec', '\\overrightarrow').replaceAll(' d h ', ' \\text{、} '),
                                        this.app.workspace.activeEditor?.editor?.offsetToPos(toFormat.from + 1),
                                        this.app.workspace.activeEditor?.editor?.offsetToPos(toFormat.to - 1));
                                }
                            }
                        }
                    }
                    lastFormula = currentFormula

                    if (this.formatting) {
                        if (currentFormula) {
                            this.switchToEnglish();
                        } else {
                            this.switchToChinese();
                        }
                    }

                    // 新增：处理输入变化，检测连续的///
                    if (update.transactions.some(tr => tr.isUserEvent('input'))) {
                        const editor = update.view;
                        const doc = editor.state.doc;
                        const lastChange = update.transactions[0]; // 获取最近的输入事务

                        // 从变更中获取输入位置和内容
                        const changes = lastChange.changes;
                        let inputText = '';
                        let pos = -1;

                        // 提取输入的文本和位置
                        changes.iterChanges((fromA, toA, fromB, toB, inserted) => {
                            inputText = Array.from(inserted).join(''); // 输入的字符
                            pos = fromA; // 输入位置
                        });

                        // 只处理单字符输入（连续输入时会逐字符触发）
                        if (inputText.length !== 1) return;

                        function tripleInput(char: string) {
                            // 检查当前输入是否为'/'，并检测前两个字符是否也是'/'
                            if (inputText === char) {
                                // 确保有足够的前置字符可以检查
                                if (pos >= 2) {
                                    // 获取当前位置前两个字符
                                    const prev1 = doc.sliceString(pos - 1, pos);
                                    const prev2 = doc.sliceString(pos - 2, pos - 1);

                                    // 检测是否形成了///
                                    if (prev1 === char && prev2 === char) {
                                        // 找到连续的///，执行你的动作
                                        return true;
                                    }
                                }
                            }
                            return false;
                        }

                        if (tripleInput('/')) {
                            // 计算///的起始和结束位置
                            const startPos = pos - 2;
                            const endPos = pos + 1; // 因为当前输入的/在inputPos位置

                            const start = this.app.workspace.activeEditor?.editor?.offsetToPos(startPos)!;
                            const end = this.app.workspace.activeEditor?.editor?.offsetToPos(endPos);

                            // 2. 正确替换///为$$（使用EditorPosition参数）
                            this.app.workspace.activeEditor?.editor?.replaceRange('$$', start, end);

                            // 3. 计算光标位置（$$中间）并转换为EditorPosition
                            const cursorOffset = startPos + 1;
                            const cursorPos = this.app.workspace.activeEditor?.editor?.offsetToPos(cursorOffset)!;
                            this.app.workspace.activeEditor?.editor?.setCursor(cursorPos);
                        } else if (currentFormula && tripleInput(',')) {
                            // 后面是不是一个结束的'$'
                            if (doc.sliceString(pos + 1, pos + 2) === '$') {
                                // 移除,,,
                                const a = this.app.workspace.activeEditor?.editor?.offsetToPos(pos - 2)!;
                                const b = this.app.workspace.activeEditor?.editor?.offsetToPos(pos + 1)!;
                                this.app.workspace.activeEditor?.editor?.replaceRange('', a, b);
                                // pos -> pos - 3 -> pos - 2
                                const cursorPos = this.app.workspace.activeEditor?.editor?.offsetToPos(pos - 1)!;
                                this.app.workspace.activeEditor?.editor?.setCursor(cursorPos);
                            }
                        }
                    }
                }

            })
        ]);


        const style = document.createElement('style');
        style.textContent = `
            .grid-container {
                position:absolute;
                box-sizing: border-box;
                margin: 0px;
                padding: 0px;
                border: 1px solid #ccc; /* 外边框 */
            }
            .grid-cell {
                position: absolute;
                margin: 0px;
                padding: 0px;
                box-sizing: border-box;
                /* 关键边框处理：只显示右和下边框，避免重叠 */
                border-right: 1px solid #ccc;
                border-bottom: 1px solid #ccc;
            }
            /* 最后一列和最后一行移除多余边框 */
            .grid-cell.last-col { border-right: none; }
            .grid-cell.last-row { border-bottom: none; }
        `;
        document.head.appendChild(style);

        this.registerMarkdownCodeBlockProcessor('runner', async (source, el, ctx) => {
            window.eval(source)
        })

        this.registerMarkdownCodeBlockProcessor('grid', async (source, el, ctx) => {
            el.empty();
            const lines = source.split('\n').filter(l => l.trim());

            // 解析配置
            const config = {
                width: '',
                height: '',
                rows: ['*', '*'],
                cols: ['*', '*'],
                border: { w: 0, color: '#ccc' },
                align: 'left',
                docWidth: 0,
                padding: { h: 0, v: 0 },
            };
            const cells = new Map<string, { content: string, config: string }>();

            lines.forEach(line => {
                const trim = line.trim();
                if (trim.startsWith('# height:')) config.height = trim.split(':')[1].trim();
                if (trim.startsWith('# width:')) config.width = trim.split(':')[1].trim();
                if (trim.startsWith('# align:')) config.align = trim.split(':')[1].trim();
                if (trim.startsWith('# rows:')) {
                    config.rows = trim.split(':')[1].trim().split(/\s+/).filter(d => d);
                }
                if (trim.startsWith('# cols:')) {
                    config.cols = trim.split(':')[1].trim().split(/\s+/).filter(d => d);
                }
                if (trim.startsWith('# grid:')) {
                    const [w, c] = trim.split(':')[1].trim().split(/\s+/);
                    config.border.w = parseInt(w) || 1;
                    config.border.color = c || '#ccc';
                }
                if (trim.startsWith('# padding:')) {
                    const [h, v] = trim.split(':')[1].trim().split(/\s+/);
                    config.padding.h = parseInt(h) || 0;
                    config.padding.v = parseInt(v) || 0;
                }
            });

            const cell_text = source.match(/####(.*?)####/sm)
            let text = ''
            if (cell_text) {
                text = cell_text[1]
            }
            const cell_segs = text.split('||').slice(1, -1);
            for (let i = 0; i < cell_segs.length; i++) {
                const cell_index = i;
                const str = cell_segs[i];
                const row = Math.floor(cell_index / config.cols.length) + 1;
                const col = (cell_index % config.cols.length) + 1;
                const im = str.trim().match(/([FLRTB]+\:)?(.*)/sm)
                if (im) {
                    cells.set(`${row}-${col}`, {
                        config: im[1] || '',
                        content: im[2]
                    })
                } else {
                    cells.set(`${row}-${col}`, {
                        config: "",
                        content: "ERROR FORMAT"
                    })
                }
            }

            // 容器尺寸
            const containerW = config.width !== '' ? parseInt(config.width) : 700;
            const containerH = parseInt(config.height);

            // 计算单元格
            const { cells: cellInfo, rowCount, colCount } = calculateCells(
                containerW,
                containerH,
                config.rows,
                config.cols
            );

            // 创建容器
            el.className = 'grid-container';
            el.style.width = `${containerW}px`;
            el.style.height = `${containerH}px`;
            el.style.borderColor = config.border.color;
            el.style.borderWidth = `${config.border.w}px`;
            if (config.align === 'center') {
                el.style.left = "0"
                el.style.right = "0"
                el.style.margin = "auto"
            } else if (config.align === 'left') {
                el.style.left = "0"
                el.style.right = "auto"
                el.style.marginLeft = "0"
            } else if (config.align === 'right') {
                el.style.left = "auto"
                el.style.right = "0"
                el.style.marginRight = "0"
            }

            const spacer = document.createElement('div');
            spacer.className = 'grid-spacer';

            // 3. 设置占位符的高度来撑开父容器
            // spacer 元素必须在正常文档流中，所以它能撑开父容器
            spacer.style.height = `${containerH}px`;
            spacer.style.width = '100%'; // 确保占据父容器宽度
            spacer.style.visibility = 'hidden'; // 让它不可见，只用于占位
            spacer.style.pointerEvents = 'none'; // 避免干扰用户交互

            // 4. 将占位符插入到 el 之后（或者之前）
            el.parentElement!.insertBefore(spacer, el.nextSibling);

            const renderChild = new MarkdownRenderChild(el);
            ctx.addChild(renderChild);

            // 关键修复：生成所有单元格（即使未定义内容）
            for (let row = 1; row <= rowCount; row++) {
                for (let col = 1; col <= colCount; col++) {
                    const key = `${row}-${col}`;
                    const info = cellInfo[key];

                    // 创建单元格
                    const cell = document.createElement('div');
                    cell.className = `grid-cell ${col === colCount ? 'last-col' : ''} ${row === rowCount ? 'last-row' : ''}`;
                    cell.style.cssText = `
                        left: ${info.x}px;
                        top: ${info.y}px;
                        width: ${info.w}px;
                        height: ${info.h}px;
                        border-right-width: ${config.border.w}px;
                        border-bottom-width: ${config.border.w}px;
                        border-color: ${config.border.color};
                    `;
                    el.appendChild(cell);

                    // 填充内容
                    const content = cells.get(key) || '';
                    if (content) {
                        // const offscreen = document.createElement('div');
                        // // 关键：将容器放置在屏幕外，不影响视觉
                        // offscreen.style.cssText = `
                        //     position: absolute;
                        //     top: -9999px;
                        //     left: -9999px;
                        //     visibility: hidden; /* 完全隐藏，不占用绘制资源 */
                        //     width: auto;
                        //     height: auto;
                        //     box-sizing: border-box;
                        //     padding: 4px; /* 与实际单元格内边距一致 */
                        // `;
                        // document.body.appendChild(offscreen);
                        await MarkdownRenderer.render(this.app, content.content, cell, ctx.sourcePath, renderChild);
                        let contentEl = cell.firstElementChild as HTMLElement;
                        if (contentEl) {
                            contentEl.style.margin = "0";
                            contentEl.style.padding = "1";
                            contentEl.style.boxSizing = 'border-box';
                            contentEl.style.overflow = 'hidden';
                            contentEl.style.display = 'inline-block'
                            let { width: contentW, height: contentH } = contentEl.getBoundingClientRect();
                            //document.body.removeChild(offscreen);
                            //offscreen.removeChild(contentEl);

                            requestAnimationFrame(() => {
                                if (contentEl) {
                                    //cell.appendChild(contentEl)
                                    setContentStyle(
                                        contentEl,
                                        info.w,  // cellWidth
                                        info.h,  // cellHeight
                                        contentW,
                                        contentH,
                                        content.config    // 直接使用config，无需额外返回值
                                    );
                                }
                            });
                        }
                    }
                }
            }
        });

        this.registerMarkdownCodeBlockProcessor(
            'zyb-graph',
            async (source, el, ctx) => {
                el.empty();

                // 不再需要正则表达式！
                // source 就是我们想要的文件路径（可能需要 .trim() 去掉换行符）
                const filePath = source.trim();

                const file = this.vault.getAbstractFileByPath(filePath) as TFile
                if (file) {
                    const child = document.createElement('div');
                    child.innerHTML = await this.vault.read(file);
                    child.dataset.filePath = file.path;

                    child.addEventListener('dblclick', (event) => {
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

    }

    async switchToEnglish() {
        if (await this.getCurrentIME() !== '英语模式') {
            this.toggleIME();
        }
    }

    // 切换到中文输入法（以搜狗拼音为例）
    async switchToChinese() {
        if (await this.getCurrentIME() !== '中文模式') {
            this.toggleIME();
        }
    }

    getCurrentIME() {
        const vaultPath = (this.vault.adapter as any).getBasePath();
        return new Promise((resolve, reject) => {
            // 使用 execFile 执行 im-select.exe
            execFile(path.join(vaultPath, this.app.vault.configDir, 'plugins', this.manifest.id, 'im-select'), { encoding: 'buffer' }, (err: any, stdout: any) => {
                //const imeId = stdout.trim();
                const ime = stdout[0] === 211 ? '英语模式' : '中文模式'
                resolve(ime);
            });
        });
    }

    /**
     * 切换微软拼音的中英文输入模式
     */
    toggleIME() {
        const vaultPath = (this.vault.adapter as any).getBasePath();
        execFile('powershell.exe', ['-ExecutionPolicy', 'Bypass', '-File', path.join(vaultPath, this.app.vault.configDir, 'plugins', this.manifest.id, 'im-shift.ps1')]);
    }

    // 基础切换函数（复用）
    switchInput(inputId: string) {
        return new Promise<void>((resolve, reject) => {
            const vaultPath = (this.vault.adapter as any).getBasePath();
            execFile(path.join(vaultPath, this.app.vault.configDir, 'plugins', this.manifest.id, 'im-select'), [inputId], (err: any) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    async htmlToPdfBuffer(html: string): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            // @ts-ignore
            const electron = require('electron');
            // 创建隐藏窗口
            const win = new electron.remote.BrowserWindow({
                show: false,
                webPreferences: {
                    nodeIntegration: false,
                    contextIsolation: true,
                },
            });

            win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

            win.webContents.on('did-finish-load', async () => {
                try {
                    // 导出 PDF
                    const pdfBuffer = await win.webContents.printToPDF({
                        printBackground: true,
                        marginsType: 1,
                    });
                    win.close();
                    resolve(pdfBuffer);
                } catch (err) {
                    win.close();
                    reject(err);
                }
            });
        });
    }


    handleEditorMenu(menu: Menu, editor: Editor, view: MarkdownView, ctx?: any) {
        const hostView = this.workspace.getActiveViewOfType(MarkdownView);
        if (!hostView || hostView !== view) {
            return; // Only handle the menu for the active Markdown view
        }

        function convertToObsidianLinks(inputText: string) {
            const lines = inputText.split('\n');
            const blocks: any[] = [];
            let currentBlock: any = null;

            lines.forEach(line => {
                // 匹配块的开始标记：m-n-[params]:
                const startRegex = /^(\d+)-(\d+)(?:-([FRTBL]+))?:/;
                const match = line.match(startRegex);

                if (match) {
                    // 如果存在前一个块，先保存它
                    if (currentBlock) {
                        currentBlock.content = currentBlock.content.trim()
                        blocks.push(currentBlock);
                    }

                    // 创建新的块
                    const m = parseInt(match[1], 10);
                    const n = parseInt(match[2], 10);
                    const params = match[3] ? match[3].trim() : null;
                    const content = '';

                    currentBlock = { m, n, params, content };
                } else if (currentBlock) {
                    // 如果在块内部，将当前行追加到内容中
                    currentBlock.content += line.trim() + '\n';
                }
            });

            // 处理最后一个块
            if (currentBlock) {
                blocks.push(currentBlock);
            }

            // 过滤掉内容为空的块
            const filteredBlocks = blocks;

            // 按行（m）和列（n）对块进行排序
            filteredBlocks.sort((a, b) => {
                if (a.m !== b.m) {
                    return a.m - b.m;
                }
                return a.n - b.n;
            });


            // 生成新的文本格式
            const result = filteredBlocks.map(item => {
                const cleanedContent = item.content.trim();
                if (item.params) {
                    return `||${item.params}:${cleanedContent}`;
                } else {
                    return `||${cleanedContent}`;
                }
            }).join('\n');

            return result + '\n||';
        }
        // Add a custom menu item
        menu.addItem((item) => {
            item.setTitle('Insert Graph')
                .setIcon('graph-icon')
                .onClick(async () => {
                    this.initView();
                });
        });

        menu.addItem((item) => {
            item.setTitle('Insert Grid')
                .setIcon('graph-icon')
                .onClick(() => {
                    const hostView = this.workspace.getActiveViewOfType(MarkdownView)!;

                    const cursor = hostView.editor.getCursor();
                    hostView.editor.replaceRange(`\`\`\`\`grid
# grid: 2 #000
# rows: *
# cols: *
####
||
||
####
\`\`\`\``, cursor);
                })
        })

        menu.addItem((item) => {
            item.setTitle('Insert Options 1x4')
                .setIcon('graph-icon')
                .onClick(() => {
                    const hostView = this.workspace.getActiveViewOfType(MarkdownView)!;

                    const cursor = hostView.editor.getCursor();
                    hostView.editor.replaceRange(`\`\`\`\`grid
# height: 50
# rows: *
# cols: 50px * 50px * 50px * 50px *
####
||（A）||L:
||（B）||L:
||（C）||L:
||（D）||L:
||
####
\`\`\`\``, cursor);
                })
        })

        menu.addItem((item) => {
            item.setTitle('Insert Options 2x2')
                .setIcon('graph-icon')
                .onClick(() => {
                    const hostView = this.workspace.getActiveViewOfType(MarkdownView)!;

                    const cursor = hostView.editor.getCursor();
                    hostView.editor.replaceRange(`\`\`\`\`grid
# height: 100
# rows: * *
# cols: 50px * 50px *
####
||（A）||L:
||（B）||L:
||（C）||L:
||（D）||L:
||
####
\`\`\`\``, cursor);
                })
        })

        menu.addItem((item) => {
            item.setTitle('Insert Options 4x1')
                .setIcon('graph-icon')
                .onClick(() => {
                    const hostView = this.workspace.getActiveViewOfType(MarkdownView)!;

                    const cursor = hostView.editor.getCursor();
                    hostView.editor.replaceRange(`\`\`\`\`grid
# height: 200
# rows: * * * *
# cols: 50px *
####
||（A）||L:
||（B）||L:
||（C）||L:
||（D）||L:
||
####
\`\`\`\``, cursor);
                })
        })

            menu.addItem((item) => {
            item.setTitle('Insert Figure')
                .setIcon('graph-icon')
                .onClick(() => {
                    const hostView = this.workspace.getActiveViewOfType(MarkdownView)!;

                    const cursor = hostView.editor.getCursor();
                    hostView.editor.replaceRange(`\`\`\`\`grid
# height: 200
# width: 200
# align: right
# rows: *
# cols: *
####
||F:
||
####
\`\`\`\``, cursor);
                })
        })


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
        }

        for (const view of this.workspace.getLeavesOfType('graph-view')) {
            if (view.view instanceof GraphView) {
                await view.view.onLoadFile(file);
                return await this.workspace.revealLeaf(view);
            }
        }

        const leaf = this.workspace.getLeaf('split', 'vertical');
        const gv = new GraphView(this, leaf);
        await leaf.open(gv);
        await gv.onLoadFile(file);
    }

    // private attachMouseupListener() {
    //     const editor = this.app.workspace.getActiveViewOfType(MarkdownView)?.editor;
    //     const cm = (editor as any)?.cm;
    //     if (cm?.contentDOM) {
    //         const wrapper = cm.contentDOM as HTMLElement;
    //         // Remove listener from previous wrapper if different
    //         if (this.lastWrapper && this.lastWrapper !== wrapper) {
    //             this.lastWrapper.removeEventListener('mouseup', this.onEditorMouseUp);
    //         }
    //         // Always remove before add to avoid stacking
    //         wrapper.removeEventListener('mouseup', this.onEditorMouseUp);
    //         wrapper.addEventListener('mouseup', this.onEditorMouseUp);
    //         this.lastWrapper = wrapper;
    //     }
    // }

    // private onEditorMouseUp = (event: MouseEvent) => {
    //     if (this.formatting) {
    //         this.applyFormat();
    //     }
    // }

    // private applyFormat() {
    //     const editor = this.app.workspace.getActiveViewOfType(MarkdownView)?.editor;

    //     if (!editor) return;

    //     // 这里可以添加您的格式处理逻辑
    //     const selectedText = editor.getSelection();
    //     // 示例: 只是简单地显示选中的内容

    //     if (!selectedText) return;

    //     const from = editor.getCursor("from");
    //     const to = editor.getCursor("to");

    //     // Get the full line text for both positions
    //     const lineText = editor.getLine(from.line);

    //     // Get previous character (if exists)
    //     let prevChar = '';
    //     if (from.ch > 0) {
    //         prevChar = lineText.charAt(from.ch - 1);
    //     }

    //     // Get next character (if exists)
    //     let nextChar = '';
    //     if (to.ch < lineText.length) {
    //         nextChar = lineText.charAt(to.ch);
    //     }

    //     if (prevChar === '$' && nextChar === '$') {
    //         // If the selection is already formatted, do nothing
    //         return;
    //     }

    //     let formatted = selectedText
    //         .replace(/（/g, '(')
    //         .replace(/）/g, ')')
    //         .replace(/，/g, ',')
    //         .replace(/；/g, ';')

    //     formatted = '$' + formatted + '$';

    //     // 这里添加您的格式处理逻辑
    //     // 示例: 保持选中内容不变
    //     editor.replaceSelection(formatted);
    // }

    onunload() {
        // Clean up event listener on unload
        // if (this.lastWrapper) {
        //     this.lastWrapper.removeEventListener('mouseup', this.onEditorMouseUp);
        //     this.lastWrapper = null;
        // }

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

function getDocumentContentWidth(): number {
    const contentSelectors = [
        // 编辑模式（CodeMirror）
        '.cm-content > .cm-line',          // 标准编辑行
        '.cm-line',                        // 备选编辑行
        // 预览模式
        '.markdown-preview-view p',        // 预览段落
        '.markdown-preview-view h1, .markdown-preview-view h2', // 预览标题
        '.markdown-preview-section > *',   // 预览区任意元素
        // 通用文本内容
        'p, h1, h2, h3, ul, ol'            // 最后尝试通用选择器
    ];

    // 2. 依次尝试选择器，直到找到有效元素
    let contentElements: HTMLElement[] = [];
    for (const selector of contentSelectors) {
        contentElements = Array.from(document.querySelectorAll<HTMLElement>(selector));
        if (contentElements.length > 0) break;
    }

    return contentElements[0].getBoundingClientRect().width;
}

// 解析行列定义
function parseDimensions(def: string[], totalSize: number): number[] {
    const dims: number[] = [];
    let starTotal = 0;
    let fixedTotal = 0;
    const hasPercent = def.some(d => d.endsWith('%'));

    def.forEach(d => {
        const trim = d.trim();
        if (trim.endsWith('*')) {
            const weight = parseFloat(trim) || 1;
            starTotal += weight;
            dims.push(weight);
        } else if (trim.endsWith('%')) {
            const val = (totalSize * parseFloat(trim)) / 100;
            fixedTotal += val;
            dims.push(val);
        } else if (trim.endsWith('px')) {
            const val = parseFloat(trim) || 0;
            fixedTotal += val;
            dims.push(val);
        } else {
            starTotal += 1;
            dims.push(1);
        }
    });

    if (starTotal > 0) {
        const available = hasPercent ? totalSize : Math.max(totalSize - fixedTotal, 0);
        const starUnit = available / starTotal;
        def.forEach((d, i) => {
            if (d.trim().endsWith('*')) {
                dims[i] *= starUnit;
            }
        });
    }

    return dims;
}

// 计算单元格（含边框位置修正）
function calculateCells(
    containerW: number,
    containerH: number,
    rowDef: string[],
    colDef: string[],
) {
    const rowCount = rowDef.length;
    const colCount = colDef.length;
    const rowHeights = parseDimensions(rowDef, containerH);
    const colWidths = parseDimensions(colDef, containerW);
    const cells: { [key: string]: { x: number, y: number, w: number, h: number } } = {};
    let y = 0;

    rowHeights.forEach((rowH, rowIdx) => {
        let x = 0;
        colWidths.forEach((colW, colIdx) => {
            let key = `${rowIdx + 1}-${colIdx + 1}`;
            // 计算单元格尺寸（包含边框策略）
            cells[key] = {
                x: x,
                y: y,
                w: colW,
                h: rowH
            };
            x += colW;
        });
        y += rowH;
    });

    return { cells, rowCount, colCount };
}

function setContentStyle(contentEl: HTMLElement, cellWidth: number, cellHeight: number, contentW: number, contentH: number, config: string) {
    // 直接从config解析所有参数，无需中间变量
    const alignLeft = config.includes('L');
    const alignRight = config.includes('R');
    const alignTop = config.includes('T');
    const alignBottom = config.includes('B');
    const needScale = config.includes('F'); // 直接用config判断，无需返回值

    // 基础样式
    contentEl.style.position = 'absolute';

    let scale = 1;
    if (needScale) {
        // 基于原始内容尺寸计算缩放比例
        scale = Math.min(
            (cellWidth) / contentW,  // 减去内边距
            (cellHeight) / contentH
        );
        // 先应用缩放（此时还未排版）
        contentEl.style.transform = `scale(${scale})`;
        // 缩放原点固定为内容自身左上角（确保缩放计算准确）
        contentEl.style.transformOrigin = 'top left';
    }

    // 【第二步：计算缩放后的实际尺寸】
    const scaledWidth = contentW * scale;
    const scaledHeight = contentH * scale;

    // 【第三步：基于缩放后的尺寸进行排版对齐】
    // 水平排版
    if (alignLeft) {
        contentEl.style.left = '0';
    } else if (alignRight) {
        // 右对齐 = 单元格宽度 - 缩放后内容宽度
        contentEl.style.left = `${cellWidth - scaledWidth}px`;  // 减去内边距
    } else {
        // 居中 = (单元格宽度 - 缩放后内容宽度) / 2
        contentEl.style.left = `${(cellWidth - scaledWidth) / 2}px`;
    }

    // 垂直排版
    if (alignTop) {
        contentEl.style.top = '0';
    } else if (alignBottom) {
        // 底部对齐 = 单元格高度 - 缩放后内容高度
        contentEl.style.top = `${cellHeight - scaledHeight}px`;  // 减去内边距
    } else {
        // 居中 = (单元格高度 - 缩放后内容高度) / 2
        contentEl.style.top = `${(cellHeight - scaledHeight) / 2}px`;
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

function readMetadata(svgString: string) {
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

class WhiteboardView extends ItemView {
    workspace: Workspace;
    vault: Vault;
    plugin: MyPlugin;
    pdfBlob: Blob | undefined;

    getViewType(): string {
        return 'whiteboard-view';
    }

    getDisplayText(): string {
        return ""
    }

    constructor(plugin: MyPlugin, leaf: WorkspaceLeaf, pdfBlob: Blob | undefined = undefined) {
        super(leaf);

        this.plugin = plugin;
        this.workspace = this.app.workspace;
        this.vault = this.app.vault;
        this.pdfBlob = pdfBlob;
    }

    async onOpen(): Promise<void> {
        this.workspace.leftSplit.collapse();
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
        iframe.src = `http://localhost:9527/blackboard.html`
        // 插入 iframe 并写入内容
        container.innerHTML = '';
        container.appendChild(iframe);

        let r: any;
        const p = new Promise<void>((resolve, reject) => {
            r = resolve;
        })
        iframe.onload = () => {
            if (this.pdfBlob) {
                const container = this.containerEl.children[1] as HTMLElement;
                (container.children[0] as any).contentWindow!.postMessage({
                    command: 'open-pdf',
                    pdf: this.pdfBlob
                }, '*');
            }
            r();
        }

        await p;
    }

    protected async onClose(): Promise<void> {
        if (this.workspace.getLeavesOfType('whiteboard-view').length === 0) {
            this.workspace.leftSplit.expand();
        }
    }
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
        iframe.src = `http://localhost:9527/graph.html`
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
        (container.children[0] as any).contentWindow!.postMessage({ command: 'file', path: file.path, source: readMetadata(await this.vault.adapter.read(normalizePath(file.path))) || '' }, '*');
        this.file = file;
    }

    getDisplayText(): string {
        return 'Graph View';
    }
}

