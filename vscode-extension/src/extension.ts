import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  console.log('MWCode extension ativada.');

  const openChat = vscode.commands.registerCommand('mwcode.openChat', async () => {
    const panel = vscode.window.createWebviewPanel(
      'mwcodeChat',
      'MWCode Chat',
      vscode.ViewColumn.Beside,
      { enableScripts: true, retainContextWhenHidden: true }
    );
    panel.webview.html = getChatHtml();
    panel.webview.onDidReceiveMessage(async message => {
      if (message.type === 'send') {
        const reply = await sendToApi(message.text);
        panel.webview.postMessage({ type: 'reply', text: reply });
      }
    });
  });

  const sendSelection = vscode.commands.registerCommand('mwcode.sendSelection', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;
    const text = editor.document.getText(editor.selection);
    if (!text) {
      vscode.window.showWarningMessage('Nenhum texto selecionado.');
      return;
    }
    const reply = await sendToApi(text);
    vscode.window.showInformationMessage(reply.slice(0, 300));
  });

  const newChat = vscode.commands.registerCommand('mwcode.newChat', () =>
    vscode.commands.executeCommand('mwcode.openChat')
  );

  context.subscriptions.push(openChat, sendSelection, newChat);
}

async function sendToApi(mensagem: string): Promise<string> {
  const config = vscode.workspace.getConfiguration('mwcode');
  const apiUrl = config.get<string>('apiUrl', 'http://localhost:3100');
  const provider = config.get<string>('provider', 'openrouter');
  const model = config.get<string>('model', 'openrouter/auto');

  try {
    const res = await fetch(`${apiUrl}/api/chat/single`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mensagem, adapter: provider, model })
    });
    const data = await res.json() as any;
    return data.resposta || data.error || 'Sem resposta.';
  } catch (err) {
    return `Erro: ${(err as Error).message}`;
  }
}

function getChatHtml(): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>MWCode Chat</title>
<style>
  body { font-family: sans-serif; padding: 10px; }
  #log { border: 1px solid #ccc; height: 60vh; overflow-y: auto; padding: 8px; margin-bottom: 8px; }
  .msg { margin: 6px 0; }
  .user { color: #2563eb; }
  .agent { color: #10b981; white-space: pre-wrap; }
  input { width: 80%; padding: 6px; }
</style>
</head>
<body>
<h3>MWCode Chat</h3>
<div id="log"></div>
<input id="input" placeholder="Digite sua mensagem..." />
<button onclick="send()">Enviar</button>
<script>
  const vscode = acquireVsCodeApi();
  const log = document.getElementById('log');
  const input = document.getElementById('input');

  function addMsg(cls, text) {
    const el = document.createElement('div');
    el.className = 'msg ' + cls;
    el.textContent = text;
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
  }

  function send() {
    if (!input.value) return;
    addMsg('user', '> ' + input.value);
    vscode.postMessage({ type: 'send', text: input.value });
    input.value = '';
  }

  input.addEventListener('keydown', e => { if (e.key === 'Enter') send(); });

  window.addEventListener('message', e => {
    if (e.data.type === 'reply') addMsg('agent', e.data.text);
  });
</script>
</body>
</html>`;
}

export function deactivate() {}
