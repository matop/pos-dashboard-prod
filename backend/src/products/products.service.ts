import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

interface Product {
  productokey: number;
  descripcion: string;
}

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async findAll(empkey: number): Promise<Product[]> {
    try {
      return await this.dataSource.query<Product[]>(
        `SELECT dwpproductokey AS productokey, TRIM(dwpproductodescripcion) AS descripcion
         FROM dwpproducto
         WHERE dwpempkey = $1
         ORDER BY TRIM(dwpproductodescripcion)`,
        [empkey],
      );
    } catch (e: unknown) {
      this.logger.error('Error en consulta products', {
        error: e instanceof Error ? e.message : String(e),
        empkey,
      });
      throw new InternalServerErrorException('Error interno del servidor');
    }
  }
}
