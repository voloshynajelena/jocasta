import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Contact, Prisma } from '@prisma/client';

export interface CreateContactDto {
  name: string;
  email?: string | null;
  phone?: string | null;
  category?: string;
  source?: string;
  confidence?: number;
  metadata?: Prisma.InputJsonValue;
}

export interface UpdateContactDto {
  name?: string;
  email?: string | null;
  phone?: string | null;
  category?: string;
  metadata?: Prisma.InputJsonValue;
}

export interface ContactQueryDto {
  category?: string;
  search?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class ContactsService {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(userId: string, query?: ContactQueryDto): Promise<{
    contacts: Contact[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = query?.page || 1;
    const limit = Math.min(query?.limit || 50, 100);
    const skip = (page - 1) * limit;

    const where: any = { userId };

    if (query?.category) {
      where.category = query.category;
    }

    if (query?.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [contacts, total] = await Promise.all([
      this.prisma.contact.findMany({
        where,
        orderBy: [{ name: 'asc' }],
        skip,
        take: limit,
      }),
      this.prisma.contact.count({ where }),
    ]);

    return { contacts, total, page, limit };
  }

  async findById(id: string, userId: string): Promise<Contact> {
    const contact = await this.prisma.contact.findUnique({
      where: { id },
    });

    if (!contact) {
      throw new NotFoundException('Contact not found');
    }

    if (contact.userId !== userId) {
      throw new ForbiddenException('Not authorized to access this contact');
    }

    return contact;
  }

  async create(userId: string, data: CreateContactDto): Promise<Contact> {
    // Check for duplicate email if provided
    if (data.email) {
      const existing = await this.prisma.contact.findUnique({
        where: {
          userId_email: { userId, email: data.email },
        },
      });
      if (existing) {
        throw new ConflictException('Contact with this email already exists');
      }
    }

    return this.prisma.contact.create({
      data: {
        userId,
        name: data.name,
        email: data.email,
        phone: data.phone,
        category: data.category || 'general',
        source: data.source || 'manual',
        confidence: data.confidence ?? 1.0,
        metadata: data.metadata || {},
      },
    });
  }

  async update(id: string, userId: string, data: UpdateContactDto): Promise<Contact> {
    const contact = await this.findById(id, userId);

    // Check for duplicate email if updating
    if (data.email && data.email !== contact.email) {
      const existing = await this.prisma.contact.findUnique({
        where: {
          userId_email: { userId, email: data.email },
        },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException('Contact with this email already exists');
      }
    }

    return this.prisma.contact.update({
      where: { id },
      data,
    });
  }

  async delete(id: string, userId: string): Promise<void> {
    await this.findById(id, userId);
    await this.prisma.contact.delete({
      where: { id },
    });
  }

  /**
   * Find similar contacts using fuzzy name matching
   * Uses simple Levenshtein-like scoring
   */
  async findSimilar(
    userId: string,
    name: string,
    threshold: number = 0.6,
  ): Promise<Array<Contact & { similarity: number }>> {
    const normalizedSearch = this.normalizeName(name);

    // Get all contacts and filter in memory (fine for typical user contact counts)
    const contacts = await this.prisma.contact.findMany({
      where: { userId },
    });

    const results = contacts
      .map((contact) => {
        const normalizedName = this.normalizeName(contact.name);
        const similarity = this.calculateSimilarity(normalizedSearch, normalizedName);
        return { ...contact, similarity };
      })
      .filter((c) => c.similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity);

    return results.slice(0, 5);
  }

  /**
   * Find exact match by name (case-insensitive)
   */
  async findByName(userId: string, name: string): Promise<Contact | null> {
    return this.prisma.contact.findFirst({
      where: {
        userId,
        name: { equals: name, mode: 'insensitive' },
      },
    });
  }

  /**
   * Match or suggest existing contact for an extracted name
   */
  async matchOrSuggest(
    userId: string,
    extractedName: string,
  ): Promise<{ exact: Contact | null; similar: Array<Contact & { similarity: number }> }> {
    // First try exact match
    const exact = await this.findByName(userId, extractedName);
    if (exact) {
      return { exact, similar: [] };
    }

    // Then find similar
    const similar = await this.findSimilar(userId, extractedName);
    return { exact: null, similar };
  }

  private normalizeName(name: string): string {
    return name.toLowerCase().trim().replace(/\s+/g, ' ');
  }

  /**
   * Simple similarity calculation using longest common subsequence ratio
   */
  private calculateSimilarity(a: string, b: string): number {
    if (a === b) return 1.0;
    if (!a || !b) return 0.0;

    // Split into words and check word overlap
    const wordsA = new Set(a.split(' '));
    const wordsB = new Set(b.split(' '));

    // Calculate Jaccard similarity for words
    const intersection = [...wordsA].filter((w) => wordsB.has(w)).length;
    const union = new Set([...wordsA, ...wordsB]).size;

    const wordSimilarity = intersection / union;

    // Also check if one contains the other (partial match)
    const containsBonus = a.includes(b) || b.includes(a) ? 0.3 : 0;

    return Math.min(1.0, wordSimilarity + containsBonus);
  }
}
