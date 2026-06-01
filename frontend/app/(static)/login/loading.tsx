import { BrandLoader } from "@/components/brand-loader";

// Route-level Suspense fallback: covers the static layout's navbar + footer
// while the server component decides whether to redirect or render the form.
export default function LoginLoading() {
  return <BrandLoader />;
}
