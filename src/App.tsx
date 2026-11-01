import BuildTag from "@/components/BuildTag";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  BrowserRouter,
  Navigate,
  Routes,
  Route,
} from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import Drive from "./pages/Drive";
import { TelegramProvider } from "@/context/TelegramContext";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider
    attribute="class"
    defaultTheme="system"
    enableSystem
    storageKey="tg-drive-theme"
    disableTransitionOnChange
  >
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={250}>
        <Sonner />
        <TelegramProvider>
          <BrowserRouter>
            <BuildTag />
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
              <Route path="/drive/*" element={<Drive />} />
              <Route path="/home" element={<Navigate to="/drive" replace />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TelegramProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
