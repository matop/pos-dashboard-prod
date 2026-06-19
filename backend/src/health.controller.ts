import { Controller, Get, UseGuards } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Pool } from 'pg';
import { ApiKeyGuard } from './common/guards/api-key.guard';

@Controller()
@UseGuards(ApiKeyGuard)
export class HealthController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  @Get('health')
  getHealth() {
    const pool = (this.dataSource.driver as any).master as Pool;
    return {
      status: 'ok',
      db: {
        total: pool.totalCount,
        idle: pool.idleCount,
        waiting: pool.waitingCount,
      },
      uptime: Math.floor(process.uptime()),
    };
  }
}
