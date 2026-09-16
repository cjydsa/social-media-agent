import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ToastProvider } from "./components/Common";
import { ActorProvider } from "./context/ActorContext";
import { Dashboard } from "./pages/Dashboard";
import { Submit } from "./pages/Submit";
import { Queue } from "./pages/Queue";
import { ReviewDetail } from "./pages/ReviewDetail";
import { Evaluation } from "./pages/Evaluation";

export function App() {
  return (
    <ActorProvider>
      <ToastProvider>
        <HashRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="submit" element={<Submit />} />
              <Route path="queue" element={<Queue />} />
              <Route path="reviews/:id" element={<ReviewDetail />} />
              <Route path="evaluation" element={<Evaluation />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </HashRouter>
      </ToastProvider>
    </ActorProvider>
  );
}
