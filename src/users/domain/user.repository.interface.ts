import type { UserEntity } from './user.entity';

export interface CreateUserData {
  name: string;
  email: string;
  passwordHash: string;
  roles?: string[];
}

export interface IUserRepository {
  create(data: CreateUserData): Promise<UserEntity>;

  findByEmail(email: string): Promise<UserEntity | null>;

  findById(id: string): Promise<UserEntity | null>;
}
