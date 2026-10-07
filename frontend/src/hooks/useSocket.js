import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { SOCKET_URL } from '../config/network.js';

export default function useSocket(url) {
  const socketRef = useRef(null);
  const [announcements, setAnnouncements] = useState([]);

  useEffect(() => {
    const targetUrl = url || SOCKET_URL;
    if (!targetUrl) return undefined;

    const s = io(targetUrl, { withCredentials: true });
    socketRef.current = s;
    s.on('announcement', (payload) => setAnnouncements((a) => [payload, ...a].slice(0, 20)));
    return () => { s.close(); };
  }, [url]);

  const announce = (message) => socketRef.current?.emit('announce', message);
  return { announcements, announce };
}
