import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { ASSISTANT_ALLOWED_ROLES } from './ai-assistant.types';
import { AiAssistantService } from './ai-assistant.service';
import { AssistantQueryDto } from './dto/assistant-query.dto';

@ApiTags('ai-assistant')
@ApiBearerAuth()
@Controller('ai-assistant')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AiAssistantController {
  constructor(private readonly aiAssistantService: AiAssistantService) {}

  @Get('capabilities')
  @Roles(...ASSISTANT_ALLOWED_ROLES)
  @ApiOperation({ summary: 'Capacidades y limites del asistente' })
  capabilities() {
    return this.aiAssistantService.capabilities();
  }

  @Post('ask')
  @Roles(...ASSISTANT_ALLOWED_ROLES)
  @ApiOperation({
    summary:
      'Consulta al asistente: ayuda del ERP o datos autorizados con @datos',
  })
  ask(@CurrentUser() user: AuthenticatedUser, @Body() dto: AssistantQueryDto) {
    return this.aiAssistantService.ask(user, dto);
  }
}
