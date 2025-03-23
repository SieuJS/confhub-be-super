import { WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';

@WebSocketGateway({
    cors: {
        origin: '*',
    },
})
@Injectable()
export class SocketGateway {
    @WebSocketServer()
    server: Server;

    constructor() {}

    // First channel for conference import status
    @SubscribeMessage('conference-import')
    handleImportStatus(@MessageBody() data: any): void {
        const id = randomUUID();
        data.id = id;
        this.server.emit('conference-import', { status: 'PENDING', message: 'Conference import job has been added to the queue',  id });
    }

    @SubscribeMessage('conference-import-notify')
    handleImportNotify(@MessageBody() data: any): void {
        this.server.emit('conference-import-notify', data);
    }

    // Second channel for conference import progress
    @SubscribeMessage('conference-import-progress')
    handleImportProgress(@MessageBody() data: any): void {
        this.server.emit('conference-import-progress', data);
    }

    // Handle client connection
    handleConnection(client: Socket) {
        console.log(`Client connected: ${client.id}`);
    }

    // Handle client disconnection
    handleDisconnect(client: Socket) {
        console.log(`Client disconnected: ${client.id}`);
    }
} 