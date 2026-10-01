import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../users/user-role.enum';
import { CatalogService } from './catalog.service';
import { CreateProductDto } from './dto/create-product.dto';
import { ListProductsDto } from './dto/list-products.dto';

@ApiTags('products')
@Controller('products')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: '상품 목록' })
  list(@Query() query: ListProductsDto) {
    return this.catalog.list(query.page ?? 1, query.limit ?? 20, query.category);
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Post('reindex')
  @ApiOperation({ summary: '전체 상품 임베딩 작업을 다시 넣는다' })
  reindex() {
    return this.catalog.reindexAll().then((queued) => ({ queued }));
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: '상품 상세' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalog.getById(id);
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Post()
  @ApiOperation({ summary: '상품 등록. 임베딩은 큐에서 비동기로 만든다' })
  create(@Body() dto: CreateProductDto) {
    return this.catalog.create(dto);
  }
}
