import { RequireAuth } from '../../components/RequireAuth';

export default function OrderLayout({ children }: { children: React.ReactNode }) {
  return <RequireAuth role="CUSTOMER">{children}</RequireAuth>;
}
