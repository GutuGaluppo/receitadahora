import { Navigate, Route, Routes } from "react-router-dom";
import { useApi } from "./api";
import { Sidebar } from "./components/Sidebar";
import { BatchPage } from "./pages/BatchPage";
import { BatchesPage } from "./pages/BatchesPage";
import { DashboardPage } from "./pages/DashboardPage";
import { IngredientPage } from "./pages/IngredientPage";
import { IngredientsPage } from "./pages/IngredientsPage";
import { RecipePage } from "./pages/RecipePage";
import { RecipesPage } from "./pages/RecipesPage";
import { ReviewPage } from "./pages/ReviewPage";
import { GeneratePage } from "./pages/factory/GeneratePage";
import { HistoryPage } from "./pages/factory/HistoryPage";
import { JobPage } from "./pages/factory/JobPage";
import { QueuePage } from "./pages/factory/QueuePage";
import { SettingsPage, TemplatesPage } from "./pages/factory/TemplatesSettingsPages";

export function App() {
  const me = useApi<{ user: string; environment: string }>("/me");
  const dash = useApi<{ review: { recipes: number; images: number; ingredients_without_asset: number } }>("/dashboard");
  const reviewCount = dash.data ? dash.data.review.recipes + dash.data.review.images : undefined;

  return (
    <div className="flex h-full">
      <Sidebar environment={me.data?.environment} user={me.data?.user} reviewCount={reviewCount} />
      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-8 py-8">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/receitas" element={<RecipesPage />} />
            <Route path="/receitas/nova" element={<RecipePage />} />
            <Route path="/receitas/:id" element={<RecipePage />} />
            <Route path="/ingredientes" element={<IngredientsPage />} />
            <Route path="/ingredientes/:id" element={<IngredientPage />} />
            <Route path="/lotes" element={<BatchesPage />} />
            <Route path="/lotes/:id" element={<BatchPage />} />
            <Route path="/revisao" element={<ReviewPage />} />
            <Route path="/factory" element={<Navigate to="/factory/generate" replace />} />
            <Route path="/factory/generate" element={<GeneratePage />} />
            <Route path="/factory/queue" element={<QueuePage />} />
            <Route path="/factory/history" element={<HistoryPage />} />
            <Route path="/factory/templates" element={<TemplatesPage />} />
            <Route path="/factory/settings" element={<SettingsPage />} />
            <Route path="/factory/jobs/:id" element={<JobPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
