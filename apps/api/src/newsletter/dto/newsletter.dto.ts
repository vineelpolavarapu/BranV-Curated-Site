import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class SubscribeDto {
  @IsEmail() @MaxLength(254) email!: string;
  @IsOptional() @IsString() @MaxLength(40) source?: string;
}

export class ConfirmDto {
  @IsString() token!: string;
}

export class UnsubscribeDto {
  @IsString() token!: string;
}
