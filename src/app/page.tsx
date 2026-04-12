import { redirect } from "next/navigation";

/** ルートアクセスはログイン画面へリダイレクト */
export default function RootPage() {
  redirect("/login");
}
