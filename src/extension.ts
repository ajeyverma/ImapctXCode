import * as vscode from 'vscode';

class WelcomeItem extends vscode.TreeItem {
  constructor(
    label: string,
    options: {
      description?: string;
      command?: vscode.Command;
    } = {},
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.description = options.description;
    this.command = options.command;
  }
}

class WelcomeViewProvider implements vscode.TreeDataProvider<WelcomeItem> {
  getTreeItem(element: WelcomeItem): vscode.TreeItem {
    return element;
  }

  getChildren(): WelcomeItem[] {
    return [
      new WelcomeItem('Welcome to ImpactXCode', {
        description: 'Your extension is ready to build.',
      }),
      new WelcomeItem('Run Hello World', {
        command: {
          command: 'impactxcode.helloWorld',
          title: 'Run Hello World',
        },
      }),
    ];
  }
}

export function activate(context: vscode.ExtensionContext): void {
  const welcomeView = vscode.window.registerTreeDataProvider(
    'impactxcode.main',
    new WelcomeViewProvider(),
  );
  const helloWorld = vscode.commands.registerCommand('impactxcode.helloWorld', () => {
    vscode.window.showInformationMessage('Hello from ImpactXCode!');
  });

  context.subscriptions.push(welcomeView, helloWorld);
}

export function deactivate(): void {}
