import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { DatabaseModule } from './database/database.module';
import { BranchesModule } from './branches/branches.module';
import { ProductsModule } from './products/products.module';
import { ChartsModule } from './charts/charts.module';
import { ParamsModule } from './params/params.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 900000, limit: 300 }]),
    DatabaseModule,
    BranchesModule,
    ProductsModule,
    ChartsModule,
    ParamsModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
