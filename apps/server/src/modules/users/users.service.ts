import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { User } from '@prisma/client';

export interface CreateUserDto {
  email: string;
  name?: string;
  avatarUrl?: string;
  timezone?: string;
  defaultTransportMode?: string;
}

export interface UpdateUserDto {
  name?: string;
  timezone?: string;
  defaultTransportMode?: string;
  homeLocationId?: string | null;
  workLocationId?: string | null;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        homeLocation: true,
        workLocation: true,
      },
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async create(data: CreateUserDto): Promise<User> {
    return this.prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        avatarUrl: data.avatarUrl,
        timezone: data.timezone || 'America/Edmonton',
        defaultTransportMode: data.defaultTransportMode || 'sedan',
      },
    });
  }

  async update(id: string, data: UpdateUserDto): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.user.update({
      where: { id },
      data,
      include: {
        homeLocation: true,
        workLocation: true,
      },
    });
  }

  async getProfile(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        homeLocation: true,
        workLocation: true,
        notificationEndpoints: {
          where: { isEnabled: true },
          select: { channel: true, isVerified: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      role: user.role,
      timezone: user.timezone,
      defaultTransportMode: user.defaultTransportMode,
      hasGoogleCalendar: !!user.googleRefreshToken,
      hasTelegram: user.notificationEndpoints.some(
        (e) => e.channel === 'telegram' && e.isVerified,
      ),
      homeLocation: user.homeLocation,
      workLocation: user.workLocation,
    };
  }

  async hasGoogleCalendarAccess(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { googleRefreshToken: true },
    });
    return !!user?.googleRefreshToken;
  }

  // Admin methods
  async findAll() {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        role: true,
        isDemo: true,
        timezone: true,
        defaultTransportMode: true,
        createdAt: true,
        updatedAt: true,
        googleRefreshToken: true,
        appleId: true,
        _count: {
          select: {
            events: true,
            tasks: true,
          },
        },
      },
    });

    return users.map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      role: user.role,
      isDemo: user.isDemo,
      timezone: user.timezone,
      defaultTransportMode: user.defaultTransportMode,
      hasGoogleCalendar: !!user.googleRefreshToken,
      hasAppleId: !!user.appleId,
      eventsCount: user._count.events,
      tasksCount: user._count.tasks,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }));
  }

  async adminUpdate(
    id: string,
    data: {
      name?: string;
      email?: string;
      role?: string;
      isDemo?: boolean;
      timezone?: string;
      defaultTransportMode?: string;
    },
  ): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.user.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<void> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.user.delete({
      where: { id },
    });
  }
}
