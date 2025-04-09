import { Injectable } from "@nestjs/common";
import { SocketGateway } from "../gateways/socket.gateway";

@Injectable()
export class MessageService {
    constructor(
        private readonly socketGateway : SocketGateway
    ) { }

    async sendMessage(channel : string, message : any) {
        this.socketGateway.server.emit(channel, message);
    }

    async sendMessageToUser(userId : string, message : any, channel : string) {
        const socket = this.socketGateway.connectedUser.get(userId);
        if (socket) {
            socket.emit(channel, message);
        } else {
            console.log(`User ${userId} not connected`);
        }
    }
}