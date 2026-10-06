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
  capabilities(@CurrentUser() user: AuthenticatedUser) {
    return this.aiAssistantService.capabilities(user);
  }

  @Post('ask')
  @Roles(...ASSISTANT_ALLOWED_ROLES)
  @ApiOperation({
    summary:
      'Consulta al asistente: ayuda del ERP, datos con @datos o asistente especializado',
  })
  ask(@CurrentUser() user: AuthenticatedUser, @Body() dto: AssistantQueryDto) {
    // Fase C: si el DTO trae assistantId/toolName se usa el framework; el
    // flujo clasico (ayuda + @datos) queda intacto.
    if (dto.assistantId || dto.toolName) {
      return this.aiAssistantService.askAssistant(user, dto);
    }
    return this.aiAssistantService.ask(user, dto);
  }
}
