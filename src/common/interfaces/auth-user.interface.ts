import { UserRole } from '../../users/user-role.enum';

/** JWT 검증 후 request.user 에 실리는 최소 신원. DB 조회 결과가 아니다. */
export interface AuthUser {
  userId: string;
  email: string;
  role: UserRole;
}
