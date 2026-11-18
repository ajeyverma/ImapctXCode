# ImpactXCode

A starter Visual Studio Code extension.

## Get started

1. Run `npm install`.
2. Press `F5` in VS Code to open an Extension Development Host.
3. Select the ImpactXCode icon in the Activity Bar to open the extension's
   primary sidebar.
4. Expand your opened folder to browse files. Expand a file to see its
   functions and methods; select a function to jump to it. Expand **Current**
   to see functions and methods from the active file.
5. Expand **AI Summary** and select **Generate AI Summary**. Choose an available
   language model when prompted. VS Code may ask you to grant model access.
   The summary is cleared when you switch or edit the active file.
6. Drag the folder, **Current**, and **AI Summary** section headers to reorder
   them; the order is saved for the workspace.

The summary sends the active file's contents to the language model you select
through VS Code's Language Model API.

## Build

- `npm run compile` builds the extension into `out/`.
- `npm run watch` recompiles when source files change.
- `npm run check-types` checks TypeScript without generating output.
