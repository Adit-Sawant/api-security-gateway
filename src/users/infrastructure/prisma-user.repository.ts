import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';

import type {
  IUserRepository,
  CreateUserData,
} from '../domain/user.repository.interface';

import type { UserEntity } from '../domain/user.entity';

import type { Prisma } from '../../generated/prisma/client';

type PrismaUserWithRoles = Prisma.UserGetPayload<{
  include: {
    userRoles: {
      include: {
        role: true;
      };
    };
  };
}>;

@Injectable()
export class PrismaUserRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toEntity(user: PrismaUserWithRoles): UserEntity {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      passwordHash: user.passwordHash,
      isActive: user.isActive,
      subscriptionPlan: user.subscriptionPlan,
      roles: user.userRoles.map((userRole) => userRole.role.name),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async create(data: CreateUserData): Promise<UserEntity> {
    const user = await this.prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash: data.passwordHash,

        ...(data.roles?.length
          ? {
              userRoles: {
                create: data.roles.map((roleName) => ({
                  role: {
                    connect: {
                      name: roleName,
                    },
                  },
                })),
              },
            }
          : {}),
      },

      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    return this.toEntity(user);
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },

      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      return null;
    }

    return this.toEntity(user);
  }

  async findById(id: string): Promise<UserEntity | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },

      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      return null;
    }

    return this.toEntity(user);
  }
}
