import { Footer } from "@/components/v2/footer";
import Navbar from "@/components/v2/navbar";

export default function StaticLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="font-urbanist bg-sbi-dark min-h-screen">
      <Navbar />
      {children}
      <Footer />
    </div>
  );
}
