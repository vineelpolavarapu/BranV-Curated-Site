import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  BulkUpsertAttributeSchemaDto,
  UpsertAttributeSchemaDto,
} from './dto/category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Returns a flat list of all categories (with parent + path) for tree rendering. */
  async listAll() {
    return this.prisma.category.findMany({
      orderBy: [{ path: 'asc' }, { displayOrder: 'asc' }],
      include: {
        _count: {
          select: {
            productsAsCategory: true,
            productsAsSubcategory: true,
            attributeSchemas: true,
          },
        },
      },
    });
  }

  async getBySlug(slug: string) {
    const category = await this.prisma.category.findUnique({
      where: { slug },
      include: {
        parent: { select: { slug: true } },
        children: { orderBy: { displayOrder: 'asc' } },
        attributeSchemas: { orderBy: { displayOrder: 'asc' } },
      },
    });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  async listAttributeSchemas(categoryId: string) {
    await this.ensureCategoryExists(categoryId);
    return this.prisma.categoryAttributeSchema.findMany({
      where: { categoryId },
      orderBy: { displayOrder: 'asc' },
    });
  }

  async upsertAttributeSchema(
    categoryId: string,
    dto: UpsertAttributeSchemaDto,
    actorId: string,
  ) {
    await this.ensureCategoryExists(categoryId);
    const optionsJson = (dto.optionsJson ?? null) as Prisma.InputJsonValue;

    const result = await this.prisma.categoryAttributeSchema.upsert({
      where: {
        categoryId_attributeKey: {
          categoryId,
          attributeKey: dto.attributeKey,
        },
      },
      create: {
        categoryId,
        attributeKey: dto.attributeKey,
        displayName: dto.displayName,
        filterType: dto.filterType,
        optionsJson,
        displayOrder: dto.displayOrder ?? 0,
      },
      update: {
        displayName: dto.displayName,
        filterType: dto.filterType,
        optionsJson,
        displayOrder: dto.displayOrder ?? 0,
      },
    });
    await this.audit.record({
      actorId,
      action: 'category.attribute.upsert',
      targetType: 'category',
      targetId: categoryId,
      metadata: { attributeKey: dto.attributeKey },
    });
    return result;
  }

  async bulkUpsertAttributeSchemas(
    categoryId: string,
    dto: BulkUpsertAttributeSchemaDto,
    actorId: string,
  ) {
    await this.ensureCategoryExists(categoryId);
    const results = [];
    for (const schema of dto.schemas) {
      results.push(
        await this.upsertAttributeSchema(categoryId, schema, actorId),
      );
    }
    return results;
  }

  async deleteAttributeSchema(
    categoryId: string,
    attributeKey: string,
    actorId: string,
  ): Promise<void> {
    await this.ensureCategoryExists(categoryId);
    await this.prisma.categoryAttributeSchema.delete({
      where: {
        categoryId_attributeKey: { categoryId, attributeKey },
      },
    });
    await this.audit.record({
      actorId,
      action: 'category.attribute.delete',
      targetType: 'category',
      targetId: categoryId,
      metadata: { attributeKey },
    });
  }

  private async ensureCategoryExists(id: string): Promise<void> {
    const exists = await this.prisma.category.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Category not found');
  }
}
