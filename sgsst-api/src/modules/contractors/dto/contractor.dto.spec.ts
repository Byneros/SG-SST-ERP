import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { ContractorListQueryDto } from './contractor.dto';

/**
 * El GET paginado desde la UI envia los params de tableParams() como query.
 * El ValidationPipe global usa forbidNonWhitelisted: true, asi que cualquier
 * propiedad fuera del DTO responde 400 (regresion: la UI enviaba companyId y
 * el listado de contratistas moria con "property companyId should not exist";
 * la empresa la resuelve el backend desde el JWT con resolveCompanyScope).
 */
describe('ContractorListQueryDto - validacion con ValidationPipe global', () => {
  // Misma configuracion que main.ts (whitelist + forbidNonWhitelisted + transform).
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });

  function validate(query: Record<string, unknown>) {
    return pipe.transform(query, {
      type: 'query',
      metatype: ContractorListQueryDto,
    }) as Promise<ContractorListQueryDto>;
  }

  it('acepta page y pageSize como strings y los transforma a numero', async () => {
    const result = await validate({ page: '2', pageSize: '10' });
    expect(result).toEqual({ page: 2, pageSize: 10 });
  });

  it('rechaza companyId con 400 (la empresa sale del JWT, no del query)', async () => {
    await expect(
      validate({
        page: '1',
        pageSize: '10',
        companyId: '1472d34f-ba55-4fb9-8491-473b11f7e59d',
      }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      validate({
        page: '1',
        pageSize: '10',
        companyId: '1472d34f-ba55-4fb9-8491-473b11f7e59d',
      }),
    ).rejects.toMatchObject({
      // Cast necesario: la forma del HttpExceptionResponse no es generica.
      response: {
        message: expect.arrayContaining([
          'property companyId should not exist',
        ]) as unknown,
      },
    });
  });

  it('rechaza isActive con 400 (el filtro de la tabla es status, no isActive)', async () => {
    await expect(validate({ isActive: 'all' })).rejects.toThrow(
      BadRequestException,
    );
  });
});
