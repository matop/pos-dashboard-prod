import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from '../common/guards/api-key.guard';
import { ParseEmpkeyPipe } from '../common/pipes/parse-empkey.pipe';
import { ParamsService } from './params.service';

@Controller('params')
@UseGuards(ApiKeyGuard)
export class ParamsController {
  constructor(private readonly paramsService: ParamsService) {}

  @Get()
  async getParams(@Query('empkey', ParseEmpkeyPipe) empkey: number) {
    return this.paramsService.getParams(empkey);
  }
}
