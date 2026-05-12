import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { PresignUploadDto } from './dto/upload.dto';
import { UploadsService } from './uploads.service';

@Controller('uploads')
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN)
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @Post('presign')
  presign(@Body() dto: PresignUploadDto) {
    return this.uploads.presign(dto);
  }
}
