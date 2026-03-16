import { redirect } from "next/navigation";

// Root redirect — auth-context handles the actual role-based redirect after token check
export default function RootPage() {
  redirect("/login");
}
