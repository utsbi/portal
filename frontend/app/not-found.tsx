import Footer from "@/components/v2/footer";
import Navbar from "@/components/v2/navbar";

export default function Custom404() {
  return (
    <>
      <Navbar />
      <div className="w-full h-screen flex justify-center items-center text-2xl bg-black">
        <div className="font-urbanist flex flex-col justify-center items-center gap-2 text-white">
          <div className="text-9xl">404</div>
          <h1>This page you're looking for does not exist :(</h1>
        </div>
      </div>
      <Footer />
    </>
  );
}
