import { IsString, MaxLength } from 'class-validator';

export class UpdateSettingDto {
  @IsString() @MaxLength(80) key!: string;
  /** Free-form JSON: number, string, boolean, object — whatever fits the key. */
  value!: unknown;
}
