// src/common/utils/pagination.util.ts
import { PaginatedResult, PaginationDto } from '../dto/pagination.dto';

export function paginate<T>(
  data: T[],
  total: number,
  pagination: PaginationDto,
): PaginatedResult<T> {
  const { page = 1, limit = 20 } = pagination;
  return {
    data,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export function getPaginationParams(pagination: PaginationDto) {
  const { page = 1, limit = 20 } = pagination;
  return {
    skip: (page - 1) * limit,
    take: limit,
  };
}
