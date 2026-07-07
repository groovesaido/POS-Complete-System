import { useEffect, useRef } from "react";
import toast from "react-hot-toast";

// Detect Electron environment for correct API base URL
const isElectron = navigator.userAgent.toLowerCase().includes("electron");
const API_BASE = isElectron ? "http://localhost:5000" : "";

/**
 * Listens for auto-backup completion events via Server-Sent Events (SSE)
 * and shows a toast notification when a new auto-backup is created.
 *
 * The EventSource is automatically cleaned up when the component unmounts
 * or when the auth token changes. Reconnects are handled by the browser's
 * built-in EventSource reconnection mechanism.
 */
export default function useAutoBackupNotification() {
  const esRef = useRef(null);

  useEffect(() => {
    // The SSE endpoint is available on localhost (no auth middleware needed
    // since this is a local desktop app). The EventSource auto-reconnects
    // if the connection drops.
    const es = new EventSource(`${API_BASE}/api/events`);
    esRef.current = es;

    es.addEventListener("auto-backup-completed", (event) => {
      try {
        const data = JSON.parse(event.data);
        const time = new Date(data.timestamp).toLocaleTimeString();

        toast.success(
          `🕐 Auto-backup created: ${data.filename} (${formatBytes(data.size)}) at ${time}`,
          { duration: 6000 },
        );
      } catch {
        // Ignore malformed events
      }
    });

    es.onerror = () => {
      // EventSource will auto-reconnect; no action needed
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, []);
}

function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let size = bytes;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }
  return `${size.toFixed(1)} ${units[i]}`;
}
