import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../users/user-role.enum';
import { ROLES_KEY } from '../constants';

export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
