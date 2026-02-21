import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Task, Prisma } from '@prisma/client';

export interface CreateTaskDto {
  title: string;
  type: string;
  durationMinutes: number;
  durationMinutesMin?: number | null;
  durationMinutesMax?: number | null;
  locationId?: string | null;
  windowStartAt?: Date | null;
  windowEndAt?: Date | null;
  deadlineAt?: Date | null;
  priority?: number;
  notes?: string | null;
}

export interface UpdateTaskDto {
  title?: string;
  type?: string;
  durationMinutes?: number;
  locationId?: string | null;
  windowStartAt?: Date | null;
  windowEndAt?: Date | null;
  deadlineAt?: Date | null;
  priority?: number;
  status?: string;
  notes?: string | null;
  scheduledEventId?: string | null;
}

export interface TaskQueryDto {
  status?: string[];
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string, userId: string): Promise<Task | null> {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: {
        location: true,
        scheduledEvent: true,
      },
    });

    if (task && task.userId !== userId) {
      throw new ForbiddenException('Not authorized to access this task');
    }

    return task;
  }

  async findMany(userId: string, query: TaskQueryDto) {
    const where: Prisma.TaskWhereInput = { userId };

    if (query.status && query.status.length > 0) {
      where.status = { in: query.status };
    }

    if (query.startDate) {
      where.OR = [
        { windowStartAt: { gte: query.startDate } },
        { deadlineAt: { gte: query.startDate } },
      ];
    }

    if (query.endDate) {
      where.AND = [
        {
          OR: [
            { windowEndAt: { lte: query.endDate } },
            { deadlineAt: { lte: query.endDate } },
          ],
        },
      ];
    }

    const page = query.page || 1;
    const limit = Math.min(query.limit || 50, 100);
    const skip = (page - 1) * limit;

    const [tasks, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        include: {
          location: true,
          scheduledEvent: true,
        },
        orderBy: [{ priority: 'asc' }, { deadlineAt: 'asc' }],
        skip,
        take: limit,
      }),
      this.prisma.task.count({ where }),
    ]);

    return {
      tasks,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOpenTasks(userId: string): Promise<Task[]> {
    return this.prisma.task.findMany({
      where: {
        userId,
        status: 'open',
      },
      include: {
        location: true,
      },
      orderBy: [{ priority: 'asc' }, { deadlineAt: 'asc' }],
    });
  }

  async create(userId: string, data: CreateTaskDto): Promise<Task> {
    return this.prisma.task.create({
      data: {
        userId,
        title: data.title,
        type: data.type,
        durationMinutes: data.durationMinutes,
        durationMinutesMin: data.durationMinutesMin,
        durationMinutesMax: data.durationMinutesMax,
        locationId: data.locationId,
        windowStartAt: data.windowStartAt,
        windowEndAt: data.windowEndAt,
        deadlineAt: data.deadlineAt,
        priority: data.priority ?? 2,
        notes: data.notes,
        status: 'open',
      },
      include: {
        location: true,
      },
    });
  }

  async update(id: string, userId: string, data: UpdateTaskDto): Promise<Task> {
    const task = await this.findById(id, userId);
    if (!task) {
      throw new NotFoundException('Task not found');
    }

    return this.prisma.task.update({
      where: { id },
      data,
      include: {
        location: true,
        scheduledEvent: true,
      },
    });
  }

  async delete(id: string, userId: string): Promise<void> {
    const task = await this.findById(id, userId);
    if (!task) {
      throw new NotFoundException('Task not found');
    }

    await this.prisma.task.delete({
      where: { id },
    });
  }

  async markAsScheduled(
    id: string,
    userId: string,
    eventId: string,
  ): Promise<Task> {
    return this.update(id, userId, {
      status: 'scheduled',
      scheduledEventId: eventId,
    });
  }

  async markAsDone(id: string, userId: string): Promise<Task> {
    return this.update(id, userId, {
      status: 'done',
    });
  }
}
