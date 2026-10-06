import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { isDuplicateJobError } from '../common/utils/duplicate-job';
import { QUEUE_PROFILE_REFRESH, QUEUE_USER_EVENTS, PROFILE_WINDOW_MS } from '../queue/queue.constants';
import { ProfileRefreshJob, UserEventJob } from './event-jobs';

export interface EventSink {
  enqueue(job: UserEventJob): Promise<void>;
}

@Injectable()
export class EventProducer implements EventSink {
  constructor(
    @InjectQueue(QUEUE_USER_EVENTS) private readonly events: Queue<UserEventJob>,
    @InjectQueue(QUEUE_PROFILE_REFRESH) private readonly profiles: Queue<ProfileRefreshJob>,
  ) {}

  async enqueue(job: UserEventJob): Promise<void> {
    await this.events.add('ingest', job, {
      jobId: job.clientEventId,
      attempts: 5,
      backoff: { type: 'exponential', delay: 500 },
      removeOnComplete: 1_000,
      removeOnFail: 1_000,
    });
  }

  /**
   * 같은 유저/같은 5초 버킷은 jobId 가 같아 프로필 재계산이 한 번만 예약된다.
   * delay 는 버킷이 끝나는 시각까지라, 그 안에 적재된 이벤트를 워커가 같이 읽는다.
   */
  async enqueueProfileRefresh(userId: string): Promise<void> {
    const bucket = Math.floor(Date.now() / PROFILE_WINDOW_MS);
    const delay = Math.max(300, (bucket + 1) * PROFILE_WINDOW_MS - Date.now());

    try {
      await this.profiles.add(
        'refresh',
        { userId },
        {
          jobId: `profile-${userId}-${bucket}`,
          delay,
          attempts: 8,
          backoff: { type: 'exponential', delay: 500 },
          removeOnComplete: 500,
          removeOnFail: 500,
        },
      );
    } catch (error) {
      if (error instanceof Error && isDuplicateJobError(error)) return;
      throw error;
    }
  }
}
