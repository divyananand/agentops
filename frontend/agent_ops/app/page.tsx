import { redirect } from "next/navigation";

// the dashboard is the home screen, so "/" just sends you there
export default function Home() {
  redirect("/dashboard");
}
