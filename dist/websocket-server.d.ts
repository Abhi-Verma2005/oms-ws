interface NotificationMessage {
    type: 'notification';
    data: {
        id: string;
        title: string;
        body: string;
        imageUrl?: string;
        typeId: string;
        isActive: boolean;
        isGlobal: boolean;
        targetUserIds: string[];
        priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
        expiresAt?: string;
        createdAt: string;
        updatedAt: string;
        type: {
            id: string;
            name: string;
            displayName: string;
            icon?: string;
            color?: string;
        };
    };
}
declare class NotificationWebSocketServer {
    private wss;
    private clients;
    private adminClients;
    constructor();
    private setupWebSocketServer;
    createWebSocketServer(server: any): void;
    private generateClientId;
    private handleMessage;
    private authenticateClient;
    broadcastNotification(notification: NotificationMessage['data']): void;
    private shouldSendToUser;
    broadcastToAdmins(message: any): void;
    getConnectedClientsCount(): number;
    getAdminClientsCount(): number;
}
export declare const notificationWebSocketServer: NotificationWebSocketServer;
export {};
//# sourceMappingURL=websocket-server.d.ts.map