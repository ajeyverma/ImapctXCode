import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext): void {
  const helloWorld = vscode.commands.registerCommand('impactxcode.helloWorld', () => {
    vscode.window.showInformationMessage('Hello from ImpactXCode!');
  });

  context.subscriptions.push(helloWorld);
}

export function deactivate(): void {}
