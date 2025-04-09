import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
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

  connectedUser = new Map<string, Socket>();

  constructor() {}

  // First channel for conference import status
  @SubscribeMessage('conference-import')
  handleImportStatus(@MessageBody() data: any): void {
    const id = randomUUID();
    data.id = id;
    this.server.emit('conference-import', {
      status: 'PENDING',
      message: 'Conference import job has been added to the queue',
      id,
    });
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

  @SubscribeMessage('register')
  handleRegister(
    @MessageBody() userId: string,
    @ConnectedSocket() socket: Socket,
  ) {
    this.connectedUser.set(userId, socket);
    console.log(`User ${userId} connected`);
  }

  // Handle client connection
  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  // Handle client disconnection
  handleDisconnect(client: Socket) {
    this.connectedUser.forEach((socket, userId) => {
      if (socket.id === client.id) {
        this.connectedUser.delete(userId);
        console.log(`User ${userId} disconnected`);
      }
    });
    console.log(`Client disconnected: ${client.id}`);
  }
}
