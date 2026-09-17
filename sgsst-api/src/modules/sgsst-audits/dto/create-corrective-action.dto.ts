import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateCorrectiveActionDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  responsible!: string;

  @IsDateString()
  dueDate!: string;
}
