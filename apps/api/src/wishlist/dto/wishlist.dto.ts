import {
  IsBoolean,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

export class AddWishlistDto {
  @IsString()
  @Length(1, 64)
  productId!: string;

  @IsOptional()
  @IsBoolean()
  notifyOnPriceDrop?: boolean;
}

export class UpdateWishlistDto {
  @IsBoolean()
  notifyOnPriceDrop!: boolean;
}
