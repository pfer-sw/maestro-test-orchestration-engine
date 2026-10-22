// Opens the Maestro Viewer in VS Code's built-in Simple Browser, beside the editor.
// Triggers: command "Maestro: Open Viewer", or the URI vscode://local.maestro-viewer/open
// (sent by scripts/open-maestro-viewer.sh from the Claude Code PreToolUse hook).
const vscode = require('vscode');

function open() {
  const url = vscode.workspace.getConfiguration('maestroViewer').get('url');
  return vscode.commands.executeCommand('simpleBrowser.api.open', vscode.Uri.parse(url), {
    viewColumn: vscode.ViewColumn.Beside,
    preserveFocus: true,
  });
}

function activate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand('maestroViewer.open', open),
    vscode.window.registerUriHandler({ handleUri: (uri) => uri.path === '/open' && open() }),
  );
}

module.exports = { activate };
