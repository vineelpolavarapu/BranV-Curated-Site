import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AutocompleteHits {
  products: Array<{ slug: string; title: string; brand: string }>;
  brands: Array<{ slug: string; name: string }>;
  categories: Array<{ slug: string; name: string; path: string }>;
}

const SIMILARITY_THRESHOLD = 0.2;
const PER_GROUP = 5;

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Combined autocomplete across products + brands + categories.
   * Uses pg_trgm `similarity()` for typo tolerance, so "shrit" still hits "shirt".
   */
  async autocomplete(q: string): Promise<AutocompleteHits> {
    const term = q.trim();
    if (term.length === 0) {
      return { products: [], brands: [], categories: [] };
    }

    const [products, brands, categories] = await Promise.all([
      this.prisma.$queryRaw<
        Array<{ slug: string; title: string; brand: string; rank: number }>
      >`
        SELECT p.slug, p.title, b.name AS brand,
               GREATEST(
                 similarity(p.title, ${term}),
                 ts_rank(p.search_vector, plainto_tsquery('simple', ${term}))
               ) AS rank
        FROM products p
        JOIN brands b ON b.id = p."brandId"
        WHERE p.status = 'ACTIVE'
          AND (similarity(p.title, ${term}) > ${SIMILARITY_THRESHOLD}
               OR p.search_vector @@ plainto_tsquery('simple', ${term}))
        ORDER BY rank DESC
        LIMIT ${PER_GROUP};
      `,
      this.prisma.$queryRaw<Array<{ slug: string; name: string }>>`
        SELECT slug, name
        FROM brands
        WHERE status = 'ACTIVE'
          AND similarity(name, ${term}) > ${SIMILARITY_THRESHOLD}
        ORDER BY similarity(name, ${term}) DESC
        LIMIT ${PER_GROUP};
      `,
      this.prisma.category.findMany({
        where: {
          OR: [
            { name: { contains: term, mode: 'insensitive' } },
            { slug: { contains: term.toLowerCase() } },
          ],
        },
        orderBy: { displayOrder: 'asc' },
        take: PER_GROUP,
        select: { slug: true, name: true, path: true },
      }),
    ]);

    return {
      products: products.map((p) => ({
        slug: p.slug,
        title: p.title,
        brand: p.brand,
      })),
      brands,
      categories,
    };
  }
}
