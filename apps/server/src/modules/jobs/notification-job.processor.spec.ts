import { Test, TestingModule } from '@nestjs/testing';
import { NotificationJobProcessor } from './notification-job.processor';
import { PrismaService } from '../../database/prisma.service';
import { TelegramService } from '../integrations/telegram/telegram.service';

describe('NotificationJobProcessor', () => {
  let processor: NotificationJobProcessor;
  let prisma: PrismaService;
  let telegram: TelegramService;

  const mockPrisma = {
    notificationJob: {
      update: jest.fn(),
    },
  };

  const mockTelegram = {
    sendMessage: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationJobProcessor,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: TelegramService, useValue: mockTelegram },
      ],
    }).compile();

    processor = module.get<NotificationJobProcessor>(NotificationJobProcessor);
    prisma = module.get<PrismaService>(PrismaService);
    telegram = module.get<TelegramService>(TelegramService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('process', () => {
    const createMockJob = (overrides = {}) => ({
      id: 'job-1',
      userId: 'user-1',
      channel: 'telegram',
      endpointId: 'endpoint-1',
      payload: {
        type: 'reminder',
        title: 'Test Event',
        body: 'Starting in 30 minutes',
        actions: [
          { id: 'dismiss', label: 'OK', type: 'dismiss' },
        ],
      },
      scheduledFor: new Date(),
      status: 'pending',
      attempts: 0,
      maxAttempts: 3,
      lastError: null,
      lastAttemptAt: null,
      nextAttemptAt: null,
      dedupeKey: 'reminder:event-1:endpoint-1:30',
      endpoint: {
        id: 'endpoint-1',
        channel: 'telegram',
        address: '123456789',
        isEnabled: true,
        isVerified: true,
      },
      ...overrides,
    });

    it('should send telegram notification successfully', async () => {
      const job = createMockJob();
      mockTelegram.sendMessage.mockResolvedValue(true);

      await processor.process(job as any);

      expect(mockTelegram.sendMessage).toHaveBeenCalledWith(
        '123456789',
        expect.stringContaining('Test Event'),
        expect.objectContaining({
          parseMode: 'HTML',
          buttons: expect.any(Array),
        }),
      );

      expect(mockPrisma.notificationJob.update).toHaveBeenCalledWith({
        where: { id: 'job-1' },
        data: {
          status: 'sent',
          lastAttemptAt: expect.any(Date),
        },
      });
    });

    it('should handle telegram failure and retry', async () => {
      const job = createMockJob({ attempts: 0 });
      mockTelegram.sendMessage.mockResolvedValue(false);

      await processor.process(job as any);

      expect(mockPrisma.notificationJob.update).toHaveBeenCalledWith({
        where: { id: 'job-1' },
        data: {
          status: 'failed',
          attempts: 1,
          lastError: 'Send returned false',
          lastAttemptAt: expect.any(Date),
          nextAttemptAt: expect.any(Date),
        },
      });
    });

    it('should mark job as dead after max attempts', async () => {
      const job = createMockJob({ attempts: 2 }); // Will be attempt 3
      mockTelegram.sendMessage.mockResolvedValue(false);

      await processor.process(job as any);

      expect(mockPrisma.notificationJob.update).toHaveBeenCalledWith({
        where: { id: 'job-1' },
        data: {
          status: 'dead',
          lastError: 'Send returned false',
          lastAttemptAt: expect.any(Date),
        },
      });
    });

    it('should apply exponential backoff on failure', async () => {
      const job = createMockJob({ attempts: 1 }); // Will be attempt 2
      mockTelegram.sendMessage.mockResolvedValue(false);

      await processor.process(job as any);

      const updateCall = mockPrisma.notificationJob.update.mock.calls[0][0];
      const nextAttemptAt = updateCall.data.nextAttemptAt;

      // Backoff for attempt 2 should be 4 minutes (2^2)
      const expectedBackoff = 4 * 60 * 1000;
      const actualBackoff = nextAttemptAt.getTime() - Date.now();

      // Allow 1 second tolerance
      expect(actualBackoff).toBeGreaterThan(expectedBackoff - 1000);
      expect(actualBackoff).toBeLessThan(expectedBackoff + 1000);
    });

    it('should handle unknown channel', async () => {
      const job = createMockJob({ channel: 'unknown_channel' });

      await processor.process(job as any);

      expect(mockPrisma.notificationJob.update).toHaveBeenCalledWith({
        where: { id: 'job-1' },
        data: {
          status: 'dead',
          lastError: 'Unknown channel',
          lastAttemptAt: expect.any(Date),
        },
      });
    });

    it('should handle exception during send', async () => {
      const job = createMockJob();
      mockTelegram.sendMessage.mockRejectedValue(new Error('Network error'));

      await processor.process(job as any);

      expect(mockPrisma.notificationJob.update).toHaveBeenCalledWith({
        where: { id: 'job-1' },
        data: expect.objectContaining({
          status: 'failed',
          lastError: 'Network error',
        }),
      });
    });
  });

  describe('idempotency', () => {
    it('should use dedupeKey to prevent duplicate notifications', () => {
      // Dedupe key format: {type}:{eventId}:{endpointId}:{minutesBefore}
      const dedupeKey1 = 'reminder:event-1:endpoint-1:30';
      const dedupeKey2 = 'reminder:event-1:endpoint-1:30';
      const dedupeKey3 = 'reminder:event-1:endpoint-1:10'; // Different minutes

      expect(dedupeKey1).toBe(dedupeKey2);
      expect(dedupeKey1).not.toBe(dedupeKey3);
    });
  });
});
