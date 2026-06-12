import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ClientsPage from './pages/ClientsPage';
import ClientBoardPage from './pages/ClientBoardPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ClientsPage />} />
        <Route path="/client/:id" element={<ClientBoardPage />} />
      </Routes>
    </BrowserRouter>
  );
}
