import { Module } from '@nestjs/common';
import { SocketGateway } from './gateways/socket.gateway';
import { BullModule } from '@nestjs/bullmq';
import { CONFERENCE_QUEUE_NAME } from '../../constants/queue-name';
import { MessageService } from './services/message.service';

@Module({
    imports : [
        BullModule.registerQueue({
            name : CONFERENCE_QUEUE_NAME.NOTIFY
        }),
    ],
    providers: [SocketGateway, MessageService],
    exports    : [MessageService]
})
export class SocketGatewayModule {}
