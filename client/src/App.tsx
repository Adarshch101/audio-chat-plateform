import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Toaster } from "./components/Toaster";
import { Landing } from "./pages/Landing";
import { Screening } from "./pages/Screening";
import { Dashboard } from "./pages/Dashboard";

function App() {
  return (
    <BrowserRouter>
      <Toaster />
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Landing />} />
          <Route path="/screening" element={<Screening />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="*" element={<Landing />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;