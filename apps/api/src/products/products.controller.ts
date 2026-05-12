import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsString } from 'class-validator';
import { UserRole } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { ProductsService } from './products.service';
import { ScrapeService } from '../scrape/scrape.service';
import {
  CreateProductDto,
  ImageInput,
  ProductListQueryDto,
  RetailerListingInput,
  UpdateProductDto,
  VariantInput,
} from './dto/product.dto';
import { QuickAddDto, ScrapeUrlDto } from './dto/quick-add.dto';

class ReorderImagesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsString({ each: true })
  ids!: string[];
}

@Controller('admin/products')
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN)
export class ProductsAdminController {
  constructor(
    private readonly products: ProductsService,
    private readonly scrape: ScrapeService,
  ) {}

  // ── Quick Add: scrape URL → autofill payload ──
  @Post('scrape-url')
  scrapeUrl(@Body() dto: ScrapeUrlDto) {
    return this.scrape.scrape(dto.url);
  }

  // ── Quick Add: atomic create (product + variants + images + listing + affiliate) ──
  @Post('quick-add')
  quickAdd(
    @Body() dto: QuickAddDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.products.quickAdd(dto, user.id);
  }

  @Get()
  list(@Query() q: ProductListQueryDto) {
    return this.products.list(q);
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.products.getById(id);
  }

  @Post()
  create(
    @Body() dto: CreateProductDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.products.create(dto, user.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.products.update(id, dto, user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.products.delete(id, user.id);
  }

  // ── images ──────────────────────────────────────────────────────────

  @Post(':id/images')
  addImage(
    @Param('id') id: string,
    @Body() dto: ImageInput,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.products.addImage(id, dto, user.id);
  }

  @Patch(':id/images/reorder')
  reorderImages(
    @Param('id') id: string,
    @Body() dto: ReorderImagesDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.products.reorderImages(id, dto.ids, user.id);
  }

  @Delete(':id/images/:imageId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeImage(
    @Param('id') id: string,
    @Param('imageId') imageId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.products.removeImage(id, imageId, user.id);
  }

  // ── variants ────────────────────────────────────────────────────────

  @Post(':id/variants')
  addVariant(
    @Param('id') id: string,
    @Body() dto: VariantInput,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.products.addVariant(id, dto, user.id);
  }

  @Delete(':id/variants/:variantId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeVariant(
    @Param('id') id: string,
    @Param('variantId') variantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.products.removeVariant(id, variantId, user.id);
  }

  // ── retailer listings ───────────────────────────────────────────────

  @Post(':id/retailer-listings')
  addListing(
    @Param('id') id: string,
    @Body() dto: RetailerListingInput,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.products.addRetailerListing(id, dto, user.id);
  }

  @Delete(':id/retailer-listings/:listingId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeListing(
    @Param('id') id: string,
    @Param('listingId') listingId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.products.removeRetailerListing(id, listingId, user.id);
  }
}
