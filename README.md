# ImpactXCode

A starter Visual Studio Code extension.

## Get started

1. Run `npm install`.
2. Press `F5` in VS Code to open an Extension Development Host.
3. Select the ImpactXCode icon in the Activity Bar to open the extension's
   primary sidebar.
4. The active file's section appears second and is expanded by default. It is
   labeled with the file name followed by **(Active)**. Expand your opened
   folder to browse files; expand a file to see its functions and methods.
   Each function shows how many distinct files reference it; select a function
   to jump to it. The left side of the status bar shows the active file's
   function count and the impact count for the function under the cursor.
5. Expand **AI Summary** and select **Generate AI Summary**. Choose an available
   language model when prompted. VS Code may ask you to grant model access.
   The summary is cleared when you switch or edit the active file.
6. Expand **Graph** to explore the active file's outgoing function calls and
   the files that reference the function under the cursor.
7. Drag the folder, **Current**, **AI Summary**, and **Graph** section headers
   to reorder them; the order is saved for the workspace.

The summary sends the active file's contents to the language model you select
through VS Code's Language Model API.

## Build

- `npm run compile` builds the extension into `out/`.
- `npm run watch` recompiles when source files change.
- `npm run check-types` checks TypeScript without generating output.
