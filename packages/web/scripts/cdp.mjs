/**
 * Chrome DevTools Protocol の配線をまとめる。
 *
 * headless-chrome.mjs が「起動・停止・プロファイル削除」を持つのに対し、
 * ここは「起動後のページに話しかける」担当。
 * かつて4つの検査スクリプトが WebSocket・pending Map・send()・evaluate() を
 * それぞれ手書きしており、戻り値の形(message 全体 / message.result)まで食い違っていた。
 *
 * send() は CDP の result をそのまま返す。エラーは reject する。
 */

/**
 * @param {object} options
 * @param {number} [options.port] page target が無いとき新規タブを作るのに使う。
 * @param {Array} options.targets launchHeadlessChrome が返す targets。
 * @param {(message: object) => void} [options.onEvent] id を持たないCDPイベントの受け口。
 */
export async function openCdpSession({ port, targets, onEvent }) {
  let page = targets?.find((target) => target.type === 'page');
  if (!page && port) {
    page = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
  }
  if (!page?.webSocketDebuggerUrl) throw new Error('Chrome page target is missing');

  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });

  let nextId = 0;
  const pending = new Map();
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(String(event.data));
    if (!message.id) {
      onEvent?.(message);
      return;
    }
    const waiter = pending.get(message.id);
    if (!waiter) return;
    pending.delete(message.id);
    if (message.error) waiter.reject(new Error(JSON.stringify(message.error)));
    else waiter.resolve(message.result ?? {});
  });

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++nextId;
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });

  /** ページ内で式を評価して値を取り出す。例外は投げ直す(黙って undefined を返さない)。 */
  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result?.value;
  };

  /**
   * viewports.mjs のケースをそのまま渡せる形。
   * mobile 判定はスクリプトごとに境界が違う(390以下 / 640未満 / 常にtrue)ので呼び出し側が決める。
   */
  const setViewport = async ({ width, height, zoom = 1, mobile = false }) => {
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile,
      screenWidth: width,
      screenHeight: height,
    });
    await send('Emulation.setPageScaleFactor', { pageScaleFactor: zoom });
  };

  const close = () => {
    if (socket.readyState === WebSocket.OPEN) socket.close();
  };

  return { socket, send, evaluate, setViewport, close };
}
