import { ConflictException, Injectable } from '@nestjs/common';
import { isUniqueViolation } from '../database/is-unique-violation';
import { UserRole } from './user-role.enum';
import { UserEntity } from './user.entity';
import { UsersRepository } from './users.repository';

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  displayName: string;
  role?: UserRole;
}

@Injectable()
export class UsersService {
  constructor(private readonly users: UsersRepository) {}

  findByEmail(email: string): Promise<UserEntity | null> {
    return this.users.findByEmail(email.trim().toLowerCase());
  }

  findById(id: string): Promise<UserEntity | null> {
    return this.users.findById(id);
  }

  async create(input: CreateUserInput): Promise<UserEntity> {
    try {
      return await this.users.save({
        email: input.email.trim().toLowerCase(),
        passwordHash: input.passwordHash,
        displayName: input.displayName.trim(),
        role: input.role ?? UserRole.USER,
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException('Email already registered');
      throw error;
    }
  }
}
