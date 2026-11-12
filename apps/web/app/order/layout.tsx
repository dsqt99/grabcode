import { RequireAuth } from '@grabcode/auth-ui';

export default function OrderLayout({ children }: { children: React.ReactNode }) {
  return <RequireAuth role="CUSTOMER">{children}</RequireAuth>;
}
