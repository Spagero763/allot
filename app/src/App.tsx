import { Route, Routes } from 'react-router-dom'
import { Shell } from './ui/Shell'
import { Home } from './pages/Home'
import { OfferPage } from './pages/Offer'
import { Portfolio } from './pages/Portfolio'
import { Issue } from './pages/Issue'
import { Verify } from './pages/Verify'
import { Developers } from './pages/Developers'
import { Privacy, Terms } from './pages/Legal'

export function App() {
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<Home />} />
        <Route path="o/:offer" element={<OfferPage />} />
        <Route path="me" element={<Portfolio />} />
        <Route path="issue" element={<Issue />} />
        <Route path="verify/:offer/:subscriber" element={<Verify />} />
        <Route path="developers" element={<Developers />} />
        <Route path="privacy" element={<Privacy />} />
        <Route path="terms" element={<Terms />} />
      </Route>
    </Routes>
  )
}
