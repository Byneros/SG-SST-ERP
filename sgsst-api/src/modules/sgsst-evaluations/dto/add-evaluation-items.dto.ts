import { IsArray } from 'class-validator';

export class AddEvaluationItemsDto {
  @IsArray()
  items!: {
    numeral?: string;
    section?: string;
    question: string;
    maxScore?: number;
  }[];
}
