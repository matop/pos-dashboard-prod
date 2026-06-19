import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

interface Branch {
  ubicod: string;
  nombre: string;
}

@Injectable()
export class BranchesService {
  private readonly logger = new Logger(BranchesService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async findAll(empkey: number): Promise<Branch[]> {
    try {
      return await this.dataSource.query<Branch[]>(
        `SELECT TRIM(dwpubicod) AS ubicod, TRIM(dwpubinom) AS nombre
         FROM dwpubicacion
         WHERE dwpempkey = $1
         ORDER BY TRIM(dwpubinom)`,
        [empkey],
      );
    } catch (e: unknown) {
      this.logger.error('Error en consulta branches', {
        error: e instanceof Error ? e.message : String(e),
        empkey,
      });
      throw new InternalServerErrorException('Error interno del servidor');
    }
  }
}
