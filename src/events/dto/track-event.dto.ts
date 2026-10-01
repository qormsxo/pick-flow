import { IsEnum, IsObject, IsOptional, IsString, IsUUID, Matches } from 'class-validator';
import { EventType } from '../event-type.enum';

export class TrackEventDto {
  @IsUUID()
  productId!: string;

  @IsEnum(EventType)
  type!: EventType;

  /** 클라이언트가 재시도해도 같은 값이면 한 번만 처리한다. */
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9_:-]{8,64}$/)
  clientEventId?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
