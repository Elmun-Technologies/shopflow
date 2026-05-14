export interface ApiError {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  perPage: number;
}

export interface ListQuery {
  page?: number;
  perPage?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface ProductListQuery extends ListQuery {
  categoryId?: string;
  warehouseId?: string;
  status?: string;
  inStock?: boolean;
}

export interface OrderListQuery extends ListQuery {
  status?: string;
  paymentStatus?: string;
  channel?: string;
  customerId?: string;
  dateFrom?: string;
  dateTo?: string;
}
