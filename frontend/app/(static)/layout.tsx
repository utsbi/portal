import Footer from "@/components/footer";
import Navbar from "@/components/navbar";

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
