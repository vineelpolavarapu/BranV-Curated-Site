import { Controller, Get, Query } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { AutocompleteDto } from './dto/storefront.dto';
import { SearchService } from './search.service';

@Controller('search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Public()
  @Get('autocomplete')
  autocomplete(@Query() q: AutocompleteDto) {
    return this.search.autocomplete(q.q);
  }
}
