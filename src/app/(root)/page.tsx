import { redirect } from "next/navigation";

/********************** HomePage *****/
export default function HomePage() {
  redirect("/sign-in");
}
