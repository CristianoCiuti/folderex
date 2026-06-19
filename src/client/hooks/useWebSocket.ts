import { useState, useEffect, useRef, useCallback } from "preact/hooks";

interface UseWebSocketOptions {
  onClipboard: (text: string) => void;
  onFsChange: () => void;
}

export function useWebSocket({ onClipboard, onFsChange }: UseWebSocketOptions) {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectDelay = useRef(1000);

  const connect = useCallback(() => {
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${proto}//${location.host}/__ws`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      reconnectDelay.current = 1000;
    };

    ws.onclose = () => {
      setConnected(false);
      setTimeout(connect, reconnectDelay.current);
      reconnectDelay.current = Math.min(reconnectDelay.current * 2, 10000);
    };

    ws.onerror = () => {
      ws.close();
    };

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === "clipboard") {
          onClipboard(msg.text);
        } else if (msg.type === "fschange") {
          onFsChange();
        }
      } catch {}
    };
  }, [onClipboard, onFsChange]);

  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current) {
        wsRef.current.onclose = null; // prevent reconnect
        wsRef.current.close();
      }
    };
  }, [connect]);

  const sendClipboard = useCallback((text: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "clipboard", text }));
    }
  }, []);

  return { connected, sendClipboard };
}
