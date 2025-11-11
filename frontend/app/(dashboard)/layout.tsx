import { dm_sans } from '@/utils/fonts';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className={`${dm_sans.className}`}>{children}</div>;
}
