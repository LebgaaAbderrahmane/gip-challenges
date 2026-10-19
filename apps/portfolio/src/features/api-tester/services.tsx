import { API_BASE_URLS } from '@/config/api';
import ApiTester from '@/features/api-tester/ApiTester';
import {
  authOperations,
  buildService,
  flashSaleOperations,
  lostFoundOperations,
} from '@/features/api-tester/operations.ts';

const lostFoundService = buildService(
  'Lost & Found API',
  API_BASE_URLS.lostFound,
  lostFoundOperations,
);

const authService = buildService('Authentication API', API_BASE_URLS.auth, authOperations);

const flashSaleService = buildService(
  'Flash Sale API',
  API_BASE_URLS.flashSale,
  flashSaleOperations,
);

export default function LostFoundTester() {
  return <ApiTester service={lostFoundService} />;
}

export { authService, flashSaleService, lostFoundService };
