import { Injectable } from '@nestjs/common';
import { ConferenceErrorDTO } from '../models/conference-error.dto';
import { SocketGateway } from '../gateways/socket.gateway';
import { LoggerService, PrismaService } from 'src/modules/common';

@Injectable()
export class ErrorService {
  constructor(
    private readonly socketGateway: SocketGateway,
    private readonly prismaService: PrismaService,
    private readonly logger: LoggerService,
  ) {}

  async handleConferenceError(error: ConferenceErrorDTO) {
    // Log the error or perform any other error handling logic
    const createdError = await this.prismaService.errorConferenceLogger.create({
      data: error,
    });
    this.logger.error('An error occurred:' + error);
    this.socketGateway.server.emit('error', error);
    return createdError;
  }
}
