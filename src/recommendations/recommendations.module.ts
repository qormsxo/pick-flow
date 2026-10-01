import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogModule } from '../catalog/catalog.module';
import { EventsModule } from '../events/events.module';
import { QUEUE_PROFILE_REFRESH } from '../queue/queue.constants';
import { PreferenceEntity } from './preference.entity';
import { PreferencesRepository } from './preferences.repository';
import { ProfileRefreshProcessor } from './profile-refresh.processor';
import { RecommendationsController } from './recommendations.controller';
import { RecommendationsService } from './recommendations.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PreferenceEntity]),
    BullModule.registerQueue({ name: QUEUE_PROFILE_REFRESH }),
    CatalogModule,
    EventsModule,
  ],
  controllers: [RecommendationsController],
  providers: [PreferencesRepository, ProfileRefreshProcessor, RecommendationsService],
  exports: [RecommendationsService],
})
export class RecommendationsModule {}
