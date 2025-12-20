import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import SwapPage from './pages/Swap';
import PoolsPage from './pages/Pools';
import AddLiquidityPage from './pages/AddLiquidity';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<SwapPage />} />
        <Route path="swap" element={<SwapPage />} />
        <Route path="pools" element={<PoolsPage />} />
        <Route path="pools/add" element={<AddLiquidityPage />} />
      </Route>
    </Routes>
  );
}

export default App;
