import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from '../common/guards/api-key.guard';
import { ParseEmpkeyPipe } from '../common/pipes/parse-empkey.pipe';
import { ProductsService } from './products.service';

@Controller('products')
@UseGuards(ApiKeyGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  async findAll(@Query('empkey', ParseEmpkeyPipe) empkey: number) {
    const products = await this.productsService.findAll(empkey);
    return { products };
  }
}
