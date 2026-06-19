import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from '../common/guards/api-key.guard';
import { ParseEmpkeyPipe } from '../common/pipes/parse-empkey.pipe';
import { BranchesService } from './branches.service';

@Controller('branches')
@UseGuards(ApiKeyGuard)
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Get()
  async findAll(@Query('empkey', ParseEmpkeyPipe) empkey: number) {
    const branches = await this.branchesService.findAll(empkey);
    return { branches };
  }
}
