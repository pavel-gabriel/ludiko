import Providers from '@/app/providers';
import AppRoutes from '@/app/AppRoutes';

export default function App() {
  return (
    <Providers>
      <AppRoutes />
    </Providers>
  );
}
