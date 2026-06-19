import { Module } from '@nestjs/common';
import { ChartsController } from './charts.controller';
import { SalesComparisonService } from './sales-comparison.service';
import { SalesHistoryService } from './sales-history.service';
import { TopCategoriesService } from './top-categories.service';
import { TopProductsService } from './top-products.service';

@Module({
  controllers: [ChartsController],
  providers: [SalesHistoryService, TopProductsService, TopCategoriesService, SalesComparisonService],
})
export class ChartsModule {}
