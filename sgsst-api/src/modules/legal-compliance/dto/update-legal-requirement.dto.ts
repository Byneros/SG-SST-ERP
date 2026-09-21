import { PartialType } from '@nestjs/mapped-types';
import { CreateLegalRequirementDto } from './create-legal-requirement.dto';

export class UpdateLegalRequirementDto extends PartialType(
  CreateLegalRequirementDto,
) {}
