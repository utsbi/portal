import { Suspense } from "react";
import { ChatsView } from "@/components/dashboard/explore/ChatsView";

export default function ChatsPage() {
  return (
    <Suspense fallback={null}>
      <ChatsView />
    </Suspense>
  );
}
