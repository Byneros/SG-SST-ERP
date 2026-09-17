import { PartialType } from '@nestjs/mapped-types';
import { CreateLegalNormDto } from './create-legal-norm.dto';

export class UpdateLegalNormDto extends PartialType(CreateLegalNormDto) {}
