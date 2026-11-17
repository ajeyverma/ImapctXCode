import * as vscode from 'vscode';

type ExplorerItemKind = 'workspace' | 'directory' | 'file' | 'current' | 'function' | 'message';
const sectionMimeType = 'application/vnd.impactxcode.explorer-sections';

class ExplorerItem extends vscode.TreeItem {
  constructor(
    label: string,
    readonly kind: ExplorerItemKind,
    options: {
      collapsibleState?: vscode.TreeItemCollapsibleState;
      description?: string;
      resourceUri?: vscode.Uri;
      command?: vscode.Command;
    } = {},
  ) {
    super(label, options.collapsibleState ?? vscode.TreeItemCollapsibleState.None);
    this.description = options.description;
    this.resourceUri = options.resourceUri;
    this.command = options.command;
  }
}

const functionSymbolKinds = new Set<vscode.SymbolKind>([
  vscode.SymbolKind.Function,
  vscode.SymbolKind.Method,
  vscode.SymbolKind.Constructor,
  vscode.SymbolKind.Operator,
]);

class ExplorerViewProvider
  implements
    vscode.TreeDataProvider<ExplorerItem>,
    vscode.TreeDragAndDropController<ExplorerItem>
{
  private readonly changeEmitter = new vscode.EventEmitter<ExplorerItem | undefined>();
  private readonly currentItem = new ExplorerItem('Current', 'current', {
    collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
  });
  private sectionOrder: string[] = [];
  private readonly orderLoaded: Promise<void>;
  readonly dragMimeTypes = [sectionMimeType];
  readonly dropMimeTypes = [sectionMimeType];
  readonly onDidChangeTreeData = this.changeEmitter.event;

  constructor(private readonly workspaceState: vscode.Memento) {
    this.orderLoaded = Promise.resolve(
      workspaceState.get<string[]>('explorerSectionOrder', []),
    ).then((order) => {
      this.sectionOrder = order;
    });
  }

  getTreeItem(element: ExplorerItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: ExplorerItem): Promise<ExplorerItem[]> {
    if (!element) {
      const workspaceFolders = vscode.workspace.workspaceFolders ?? [];
      const folderItems = workspaceFolders.map(
        (folder) =>
          new ExplorerItem(folder.name, 'workspace', {
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            resourceUri: folder.uri,
          }),
      );

      if (folderItems.length === 0) {
        folderItems.push(new ExplorerItem('No folder is open', 'message'));
      }

      folderItems.push(this.currentItem);
      await this.orderLoaded;
      return this.orderSections(folderItems);
    }

    if (element.kind === 'current') {
      return this.getCurrentChildren();
    }

    if (element.kind === 'function') {
      return [];
    }

    if ((element.kind === 'workspace' || element.kind === 'directory') && element.resourceUri) {
      return this.getDirectoryChildren(element.resourceUri);
    }

    return [];
  }

  refresh(): void {
    this.changeEmitter.fire(undefined);
  }

  refreshCurrent(): void {
    this.changeEmitter.fire(this.currentItem);
  }

  handleDrag(source: readonly ExplorerItem[], dataTransfer: vscode.DataTransfer): void {
    const sectionKeys = source
      .map((item) => this.getSectionKey(item))
      .filter((key): key is string => key !== undefined);
    if (sectionKeys.length > 0) {
      dataTransfer.set(sectionMimeType, new vscode.DataTransferItem(JSON.stringify(sectionKeys)));
    }
  }

  async handleDrop(
    target: ExplorerItem | undefined,
    dataTransfer: vscode.DataTransfer,
  ): Promise<void> {
    const transferItem = dataTransfer.get(sectionMimeType);
    if (!transferItem) {
      return;
    }

    const sectionKeys: unknown = JSON.parse(await transferItem.asString());
    if (!Array.isArray(sectionKeys)) {
      return;
    }

    const keys = sectionKeys.filter((key: unknown): key is string => typeof key === 'string');
    if (keys.length !== sectionKeys.length) {
      return;
    }

    const draggedKeys = [...new Set(keys)];
    const currentSections = this.getSectionItems();
    const availableKeys = new Set(currentSections.map((item) => this.getSectionKey(item)));
    const movingKeys = draggedKeys.filter((key) => availableKeys.has(key));
    const targetKey = target ? this.getSectionKey(target) : undefined;

    if (
      movingKeys.length === 0 ||
      (target && targetKey === undefined) ||
      (targetKey !== undefined && movingKeys.includes(targetKey))
    ) {
      return;
    }

    const nextOrder = currentSections
      .map((item) => this.getSectionKey(item))
      .filter((key): key is string => key !== undefined && !movingKeys.includes(key));
    const insertIndex = targetKey === undefined ? nextOrder.length : nextOrder.indexOf(targetKey);
    nextOrder.splice(insertIndex, 0, ...movingKeys);

    this.sectionOrder = nextOrder;
    await this.workspaceState.update('explorerSectionOrder', nextOrder);
    this.refresh();
  }

  dispose(): void {
    this.changeEmitter.dispose();
  }

  private getSectionItems(): ExplorerItem[] {
    const folders = (vscode.workspace.workspaceFolders ?? []).map(
      (folder) =>
        new ExplorerItem(folder.name, 'workspace', {
          collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
          resourceUri: folder.uri,
        }),
    );
    return [...folders, this.currentItem];
  }

  private getSectionKey(item: ExplorerItem): string | undefined {
    if (item.kind === 'current') {
      return 'current';
    }
    if (item.kind === 'workspace' && item.resourceUri) {
      return item.resourceUri.toString();
    }
    return undefined;
  }

  private orderSections(items: ExplorerItem[]): ExplorerItem[] {
    const orderByKey = new Map(this.sectionOrder.map((key, index) => [key, index]));
    return items.sort((left, right) => {
      const leftKey = this.getSectionKey(left);
      const rightKey = this.getSectionKey(right);
      const leftOrder = leftKey === undefined ? Number.MAX_SAFE_INTEGER : orderByKey.get(leftKey);
      const rightOrder = rightKey === undefined ? Number.MAX_SAFE_INTEGER : orderByKey.get(rightKey);
      return (leftOrder ?? Number.MAX_SAFE_INTEGER) - (rightOrder ?? Number.MAX_SAFE_INTEGER);
    });
  }

  private async getCurrentChildren(): Promise<ExplorerItem[]> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return [new ExplorerItem('Open a file to see its functions', 'message')];
    }

    const document = editor.document;
    try {
      const symbols = await vscode.commands.executeCommand<
        (vscode.DocumentSymbol | vscode.SymbolInformation)[] | undefined
      >('vscode.executeDocumentSymbolProvider', document.uri);
      const functionItems: ExplorerItem[] = [];

      const addDocumentSymbol = (symbol: vscode.DocumentSymbol, container?: string): void => {
        const name = container ? `${container}.${symbol.name}` : symbol.name;
        if (functionSymbolKinds.has(symbol.kind)) {
          functionItems.push(
            this.createFunctionItem(name, symbol.kind, document.uri, symbol.selectionRange),
          );
        }
        for (const child of symbol.children) {
          addDocumentSymbol(child, name);
        }
      };

      for (const symbol of symbols ?? []) {
        if ('children' in symbol) {
          addDocumentSymbol(symbol);
        } else if (functionSymbolKinds.has(symbol.kind)) {
          const name = symbol.containerName
            ? `${symbol.containerName}.${symbol.name}`
            : symbol.name;
          functionItems.push(
            this.createFunctionItem(name, symbol.kind, symbol.location.uri, symbol.location.range),
          );
        }
      }

      if (functionItems.length === 0) {
        functionItems.push(new ExplorerItem('No functions found in this file', 'message'));
      }

      return functionItems;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Unable to load symbols for "${document.uri.toString()}": ${message}`);
      return [new ExplorerItem('Unable to load functions', 'message', { description: message })];
    }
  }

  private createFunctionItem(
    name: string,
    kind: vscode.SymbolKind,
    uri: vscode.Uri,
    range: vscode.Range,
  ): ExplorerItem {
    const item = new ExplorerItem(name, 'function', {
      description: `Line ${range.start.line + 1}`,
      command: {
        command: 'vscode.open',
        title: 'Go to Function',
        arguments: [uri, { selection: range }],
      },
    });
    item.iconPath = new vscode.ThemeIcon(this.getSymbolIcon(kind));
    return item;
  }

  private getSymbolIcon(kind: vscode.SymbolKind): string {
    switch (kind) {
      case vscode.SymbolKind.Constructor:
        return 'symbol-constructor';
      case vscode.SymbolKind.Method:
        return 'symbol-method';
      default:
        return 'symbol-function';
    }
  }

  private async getDirectoryChildren(uri: vscode.Uri): Promise<ExplorerItem[]> {
    try {
      const entries = await vscode.workspace.fs.readDirectory(uri);
      entries.sort(([leftName, leftType], [rightName, rightType]) => {
        const leftIsDirectory = (leftType & vscode.FileType.Directory) !== 0;
        const rightIsDirectory = (rightType & vscode.FileType.Directory) !== 0;
        if (leftIsDirectory !== rightIsDirectory) {
          return leftIsDirectory ? -1 : 1;
        }
        return leftName.localeCompare(rightName, undefined, { sensitivity: 'base' });
      });

      if (entries.length === 0) {
        return [new ExplorerItem('Folder is empty', 'message')];
      }

      return entries.map(([name, type]) => {
        const childUri = vscode.Uri.joinPath(uri, name);
        const isDirectory = (type & vscode.FileType.Directory) !== 0;
        return new ExplorerItem(name, isDirectory ? 'directory' : 'file', {
          collapsibleState: isDirectory
            ? vscode.TreeItemCollapsibleState.Collapsed
            : vscode.TreeItemCollapsibleState.None,
          resourceUri: childUri,
          command: isDirectory
            ? undefined
            : {
                command: 'vscode.open',
                title: 'Open File',
                arguments: [childUri],
              },
        });
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Unable to read workspace folder "${uri.toString()}": ${message}`);
      return [new ExplorerItem('Unable to read folder', 'message', { description: message })];
    }
  }
}

export function activate(context: vscode.ExtensionContext): void {
  const explorerProvider = new ExplorerViewProvider(context.workspaceState);
  const welcomeView = vscode.window.createTreeView(
    'impactxcode.main',
    {
      treeDataProvider: explorerProvider,
      dragAndDropController: explorerProvider,
    },
  );
  const workspaceFoldersChanged = vscode.workspace.onDidChangeWorkspaceFolders(() => {
    explorerProvider.refresh();
  });
  const activeEditorChanged = vscode.window.onDidChangeActiveTextEditor(() => {
    explorerProvider.refreshCurrent();
  });
  const activeDocumentChanged = vscode.workspace.onDidChangeTextDocument((event) => {
    if (event.document === vscode.window.activeTextEditor?.document) {
      explorerProvider.refreshCurrent();
    }
  });
  context.subscriptions.push(
    explorerProvider,
    welcomeView,
    workspaceFoldersChanged,
    activeEditorChanged,
    activeDocumentChanged,
  );
}

export function deactivate(): void {}
