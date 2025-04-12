import { Injectable } from "@nestjs/common";
import { SocketGateway } from "../gateways/socket.gateway";
import { SocketNotification } from "../models/socket-nofication";

@Injectable()
export class MessageService {
    constructor(
        private readonly socketGateway : SocketGateway
    ) { }

    async sendMessage(channel : string, message : any) {
        this.socketGateway.server.emit(channel, message);
    }

    async sendMessageToUser(input : SocketNotification) {
        const socket = this.socketGateway.connectedUser.get(input.userId);
        if (socket) {
            socket.emit(input.channel, input.payload);
        } else {
            console.log(`User ${input.userId} not connected`);
        }
    }
}