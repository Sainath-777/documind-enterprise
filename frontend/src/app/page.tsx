import { redirect } from "next/navigation";

export default function Home() {
  // Redirects to /chat — the client-side auth store handles
  // bouncing unauthenticated users to /login automatically.
  redirect("/chat");
}
