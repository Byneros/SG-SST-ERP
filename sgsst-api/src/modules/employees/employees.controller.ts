import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { resolveCompanyScope } from '../../common/pipes/company-scope';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { EmployeesService } from './employees.service';

@Controller('employees')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  @Roles('ADMIN', 'SST', 'AUDITOR', 'EMPLOYEE')
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListQueryDto,
    @Query('companyId') companyId?: string,
  ) {
    return this.employeesService.findAll(
      resolveCompanyScope(user, companyId),
      query,
    );
  }

  @Get(':id')
  @Roles('ADMIN', 'SST', 'AUDITOR', 'EMPLOYEE')
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.employeesService.findOne(id, user);
  }

  @Post()
  @Roles('ADMIN', 'SST')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateEmployeeDto,
  ) {
    return this.employeesService.create(
      {
        ...dto,
        // Fuente única de verdad: un companyId ajeno del cliente se rechaza con 403.
        companyId: resolveCompanyScope(user, dto.companyId),
      },
      user,
    );
  }

  @Patch(':id')
  @Roles('ADMIN', 'SST')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmployeeDto,
  ) {
    return this.employeesService.update(
      id,
      {
        ...dto,
        // El cliente nunca decide la empresa: el scope autenticado manda.
        companyId: resolveCompanyScope(user, dto.companyId),
      },
      user,
    );
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.employeesService.remove(id, user);
  }
}
