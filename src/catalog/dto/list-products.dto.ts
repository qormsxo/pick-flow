import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PageQueryDto } from '../../common/dto/page-query.dto';

export class ListProductsDto extends PageQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  category?: string;
}
