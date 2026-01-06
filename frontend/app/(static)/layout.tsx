import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";

export default function StaticLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="font-old-standard scrollbar">
      <Navbar />
      {children}
      <Footer />
    </div>
  );
}
