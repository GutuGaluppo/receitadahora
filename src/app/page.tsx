import { App } from "@/components/App";
import { getCatalog } from "@/services/studio-content";

export default async function Page() {
  const { recipes, status } = await getCatalog();
  return <App recipes={recipes} catalogStatus={status} />;
}
