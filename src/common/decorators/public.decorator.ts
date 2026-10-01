import { SetMetadata } from '@nestjs/common';
import { IS_PUBLIC_KEY } from '../constants';

/** 인증 없이 열리는 핸들러. JwtAuthGuard 가 Reflector 로 이 메타데이터를 읽는다. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
