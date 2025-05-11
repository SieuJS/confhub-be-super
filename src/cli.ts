import { CommandFactory } from 'nest-commander';
import { JournalCommandModule } from './modules/journal/command/journal-command.module';

async function bootstrap() {
  await CommandFactory.run(JournalCommandModule, ['warn', 'error']);
}

bootstrap(); 