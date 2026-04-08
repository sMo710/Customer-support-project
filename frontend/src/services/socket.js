import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

const WS_URL = 'http://localhost:8080/ws';

export const subscribeToTicket = (ticketId, onMessage) => {
    const client = new Client({
        webSocketFactory: () => new SockJS(WS_URL),
        reconnectDelay: 3000,
    });

    client.onConnect = () => {
        client.subscribe(`/topic/tickets/${ticketId}`, (frame) => {
            try {
                const payload = JSON.parse(frame.body);
                onMessage(payload);
            } catch (e) {
                // ignore malformed payloads from server
            }
        });
    };

    client.activate();

    return () => {
        client.deactivate();
    };
};
