import * as vscode from 'vscode';

type ExplorerItemKind = 'workspace' | 'directory' | 'file' | 'current' | 'message';

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

class ExplorerViewProvider implements vscode.TreeDataProvider<ExplorerItem> {
  private readonly changeEmitter = new vscode.EventEmitter<ExplorerItem | undefined>();
  readonly onDidChangeTreeData = this.changeEmitter.event;

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

      folderItems.push(
        new ExplorerItem('Current', 'current', {
          collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
        }),
      );
      return folderItems;
    }

    if (element.kind === 'current') {
      return [
        new ExplorerItem('Welcome to ImpactXCode', 'message', {
          description: 'Your extension is ready to build.',
        }),
        new ExplorerItem('Run Hello World', 'message', {
          command: {
            command: 'impactxcode.helloWorld',
            title: 'Run Hello World',
          },
        }),
      ];
    }

    if ((element.kind === 'workspace' || element.kind === 'directory') && element.resourceUri) {
      return this.getDirectoryChildren(element.resourceUri);
    }

    return [];
  }

  refresh(): void {
    this.changeEmitter.fire(undefined);
  }

  dispose(): void {
    this.changeEmitter.dispose();
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
  const explorerProvider = new ExplorerViewProvider();
  const welcomeView = vscode.window.registerTreeDataProvider(
    'impactxcode.main',
    explorerProvider,
  );
  const workspaceFoldersChanged = vscode.workspace.onDidChangeWorkspaceFolders(() => {
    explorerProvider.refresh();
  });
  const helloWorld = vscode.commands.registerCommand('impactxcode.helloWorld', () => {
    vscode.window.showInformationMessage('Hello from ImpactXCode!');
  });

  context.subscriptions.push(explorerProvider, welcomeView, workspaceFoldersChanged, helloWorld);
}

export function deactivate(): void {}
