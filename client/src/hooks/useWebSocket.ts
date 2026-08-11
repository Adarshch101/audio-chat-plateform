import { useCallback, useEffect, useRef, useState } from "react";
import type { ClientMessage, ServerMessage } from "../types/websocket";

export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<ServerMessage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      // Forcefully remove listener bindings before closing to avoid trigger loops
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onerror = null;
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const connect = useCallback((url: string) => {
    disconnect();
    setError(null);
    setLastMessage(null);

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setError(null);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as ServerMessage;
          setLastMessage(message);
        } catch (err) {
          console.error("Failed to parse incoming WebSocket message:", err);
          setError("Malformed message received from server.");
        }
      };

      ws.onclose = (event) => {
        setIsConnected(false);
        wsRef.current = null;
        if (!event.wasClean) {
          setError(`Connection closed: ${event.reason || "Server terminated connection"}`);
        }
      };

      ws.onerror = () => {
        setError("WebSocket connection error.");
      };
    } catch (err) {
      setError("Failed to initialize WebSocket connection.");
      console.error(err);
    }
  }, [disconnect]);

  const sendMessage = useCallback((message: ClientMessage) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      setError("WebSocket is not connected. Unable to send message.");
    }
  }, []);

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return {
    isConnected,
    connect,
    disconnect,
    sendMessage,
    lastMessage,
    error,
    setError
  };
}
export default useWebSocket;
