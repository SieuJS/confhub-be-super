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
}