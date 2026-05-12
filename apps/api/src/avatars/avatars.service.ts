import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateAvatarDto, UpdateAvatarDto } from './dto/avatar.dto';

@Injectable()
export class AvatarsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list() {
    return this.prisma.avatar.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(id: string) {
    const avatar = await this.prisma.avatar.findUnique({ where: { id } });
    if (!avatar) throw new NotFoundException('Avatar not found');
    return avatar;
  }

  async create(dto: CreateAvatarDto, actorId: string) {
    const avatar = await this.prisma.avatar.create({
      data: {
        name: dto.name,
        referenceImageUrl: dto.referenceImageUrl,
        promptTemplate: dto.promptTemplate,
        tags: dto.tags ?? [],
      },
    });
    await this.audit.record({
      actorId,
      action: 'avatar.create',
      targetType: 'avatar',
      targetId: avatar.id,
    });
    return avatar;
  }

  async update(id: string, dto: UpdateAvatarDto, actorId: string) {
    await this.getById(id);
    const avatar = await this.prisma.avatar.update({
      where: { id },
      data: {
        name: dto.name ?? undefined,
        referenceImageUrl: dto.referenceImageUrl ?? undefined,
        promptTemplate: dto.promptTemplate ?? undefined,
        tags: dto.tags ?? undefined,
      },
    });
    await this.audit.record({
      actorId,
      action: 'avatar.update',
      targetType: 'avatar',
      targetId: id,
    });
    return avatar;
  }

  async delete(id: string, actorId: string): Promise<void> {
    await this.getById(id);
    await this.prisma.avatar.delete({ where: { id } });
    await this.audit.record({
      actorId,
      action: 'avatar.delete',
      targetType: 'avatar',
      targetId: id,
    });
  }
}
