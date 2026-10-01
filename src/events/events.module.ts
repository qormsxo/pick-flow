import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogModule } from '../catalog/catalog.module';
import { QUEUE_PROFILE_REFRESH, QUEUE_USER_EVENTS } from '../queue/queue.constants';
import { EventProducer } from './event.producer';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { UserEventEntity } from './user-event.entity';
import { UserEventProcessor } from './user-event.processor';
import { UserEventsRepository } from './user-events.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEventEntity]),
    BullModule.registerQueue({ name: QUEUE_USER_EVENTS }, { name: QUEUE_PROFILE_REFRESH }),
    CatalogModule,
  ],
  controllers: [EventsController],
  providers: [UserEventsRepository, EventProducer, EventsService, UserEventProcessor],
  exports: [UserEventsRepository],
})
export class EventsModule {}
