import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UserRole } from '../users/user-role.enum';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

export interface AuthResult {
  accessToken: string;
  user: {
    id: string;
    email: string;
    displayName: string;
    role: UserRole;
  };
}

@Injectable()
export class AuthService {
  /** 없는 이메일도 bcrypt 를 돌려 응답 시간으로 가입 여부를 가늠하기 어렵게 한다. */
  private readonly dummyHash = bcrypt.hashSync('pick-flow-timing-pad', 10);

  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResult> {
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.users.create({
      email: dto.email,
      passwordHash,
      displayName: dto.displayName,
    });
    return this.issue(user.id, user.email, user.displayName, user.role);
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.users.findByEmail(dto.email);
    const hash = user?.passwordHash ?? this.dummyHash;
    const matches = await bcrypt.compare(dto.password, hash);
    if (!user || !matches) throw new UnauthorizedException('Invalid credentials');
    return this.issue(user.id, user.email, user.displayName, user.role);
  }

  private async issue(id: string, email: string, displayName: string, role: UserRole): Promise<AuthResult> {
    const accessToken = await this.jwt.signAsync({ sub: id, email, role });
    return {
      accessToken,
      user: { id, email, displayName, role },
    };
  }
}
