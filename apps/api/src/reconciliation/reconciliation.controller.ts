import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseFilePipeBuilder,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AffiliatePartner, UserRole } from '@prisma/client';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { ReconciliationService } from './reconciliation.service';

@Controller('admin/affiliate/reconciliation')
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN)
export class ReconciliationController {
  constructor(private readonly reconciliation: ReconciliationService) {}

  @Get()
  list() {
    return this.reconciliation.listPayouts();
  }

  @Get('variance')
  variance(@Query('partner') partner?: string) {
    const p =
      partner && Object.values(AffiliatePartner).includes(partner as AffiliatePartner)
        ? (partner as AffiliatePartner)
        : undefined;
    return this.reconciliation.variance(p);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.reconciliation.getPayout(id);
  }

  /**
   * `POST /api/admin/affiliate/reconciliation` (multipart/form-data) with a
   * `file` field. Accepts CSV up to 2 MB.
   */
  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 } }))
  async upload(
    @CurrentUser() user: AuthenticatedUser,
    @Body('notes') notes: string | undefined,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({ fileType: /(csv|plain|excel|sheet)/i })
        .addMaxSizeValidator({ maxSize: 2 * 1024 * 1024 })
        .build({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY }),
    )
    file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('A CSV file is required.');
    }
    return this.reconciliation.ingest(
      { buffer: file.buffer, originalname: file.originalname },
      user.id,
      notes,
    );
  }
}
