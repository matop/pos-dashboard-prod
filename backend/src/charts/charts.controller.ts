import { Controller, Get, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiKeyGuard } from '../common/guards/api-key.guard';
import { ChartCacheInterceptor } from '../common/interceptors/chart-cache.interceptor';
import { ParseEmpkeyPipe } from '../common/pipes/parse-empkey.pipe';
import { SalesComparisonService } from './sales-comparison.service';
import { SalesHistoryService } from './sales-history.service';
import { TopCategoriesService } from './top-categories.service';
import { TopProductsService } from './top-products.service';

@Controller('charts')
@UseGuards(ApiKeyGuard)
@UseInterceptors(ChartCacheInterceptor)
export class ChartsController {
  constructor(
    private readonly salesHistoryService: SalesHistoryService,
    private readonly topProductsService: TopProductsService,
    private readonly topCategoriesService: TopCategoriesService,
    private readonly salesComparisonService: SalesComparisonService,
  ) {}

  @Get('sales-history')
  getSalesHistory(
    @Query('empkey', ParseEmpkeyPipe) empkey: number,
    @Query('ubicod') ubicod?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('refDate') refDate?: string,
    @Query('products') products?: string,
  ) {
    return this.salesHistoryService.getSalesHistory({
      empkey,
      ubicod,
      from,
      to,
      refDate,
      products,
    });
  }

  @Get('top-products')
  getTopProducts(
    @Query('empkey', ParseEmpkeyPipe) empkey: number,
    @Query('ubicod') ubicod?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('products') products?: string,
  ) {
    return this.topProductsService.getTopProducts({
      empkey,
      ubicod,
      from,
      to,
      products,
    });
  }

  @Get('top-categories')
  getTopCategories(
    @Query('empkey', ParseEmpkeyPipe) empkey: number,
    @Query('ubicod') ubicod?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.topCategoriesService.getTopCategories({
      empkey,
      ubicod,
      from,
      to,
    });
  }

  @Get('sales-comparison')
  getSalesComparison(
    @Query('empkey', ParseEmpkeyPipe) empkey: number,
    @Query('ubicod') ubicod?: string,
    @Query('refDate') refDate?: string,
    @Query('products') products?: string,
  ) {
    return this.salesComparisonService.getSalesComparison({
      empkey,
      ubicod,
      refDate,
      products,
    });
  }
}
