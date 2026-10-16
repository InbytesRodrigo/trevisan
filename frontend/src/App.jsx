import React, { createContext, useContext, useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { api, getToken, setToken } from './api';
import Home from './pages/Home.jsx';
import Catalog from './pages/Catalog.jsx';
import Login from './pages/Login.jsx';
import Admin from './pages/Admin.jsx';
import Seller from './pages/Seller.jsx';
import ContactBubbles from './components/ContactBubbles.jsx';
import { trackClickedItem, trackSiteEvent } from './analytics.js';

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

function SeoManager({ settings, path }) {
  useEffect(() => {
    if (!settings) return;
    const controller = new AbortController();
    fetch(`/api/seo-tags?path=${encodeURIComponent(path)}`, { signal: controller.signal })
      .then((response) => response.ok ? response.text() : '')
      .then((html) => {
        if (!html || controller.signal.aborted) return;
        const template = document.createElement('template');
        template.innerHTML = html;
        document.head.querySelectorAll('[data-managed-seo]').forEach((node) => node.remove());
        document.head.append(...template.content.childNodes);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [settings, path]);
  return null;
}

function Guard({ children, roles }) {
  const { user, loading } = useApp();
  if (loading) return <div className="auth-page"><div className="auth-card">Carregando...</div></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) {
    return <Navigate to={user.role === 'admin' ? '/admin' : '/vendedor'} replace />;
  }
  return children;
}

export default function App() {
  const [settings, setSettings] = useState(null);
  const [products, setProducts] = useState([]);
  const [solutions, setSolutions] = useState([]);
  const [segments, setSegments] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const loc = useLocation();
  const publicPage = !/^\/(admin|vendedor|login)(\/|$)/.test(loc.pathname);

  useEffect(() => {
    if (/^\/(admin|vendedor|login)(\/|$)/.test(loc.pathname)) return;
    trackSiteEvent('pageview');
    document.addEventListener('click', trackClickedItem, true);
    return () => document.removeEventListener('click', trackClickedItem, true);
  }, [loc.pathname]);

  useEffect(() => {
    Promise.all([
      api('/api/settings'),
      api('/api/products'),
      api('/api/solutions'),
      api('/api/segments'),
    ])
      .then(([s, p, so, se]) => {
        setSettings(s);
        setProducts(p);
        setSolutions(so);
        setSegments(se);
      })
      .catch(() => {});
  }, [loc.pathname]);

  useEffect(() => {
    const t = getToken();
    if (!t) {
      setLoading(false);
      return;
    }
    api('/api/auth/me')
      .then(setUser)
      .catch(() => setToken(''))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const data = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    setToken('');
    setUser(null);
  };

  const refresh = async () => {
    const [s, p, so, se] = await Promise.all([
      api('/api/settings'),
      api('/api/products'),
      api('/api/solutions'),
      api('/api/segments'),
    ]);
    setSettings(s);
    setProducts(p);
    setSolutions(so);
    setSegments(se);
  };

  return (
    <Ctx.Provider value={{ settings, products, solutions, segments, user, login, logout, refresh, loading }}>
      <SeoManager settings={settings} path={loc.pathname} />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/equipamentos" element={<Catalog />} />
        <Route path="/equipamentos/:productId" element={<Catalog />} />
        <Route path="/login" element={<Login />} />
        <Route
          path="/admin/*"
          element={
            <Guard roles={['admin']}>
              <Admin />
            </Guard>
          }
        />
        <Route
          path="/vendedor"
          element={
            <Guard roles={['seller', 'admin']}>
              <Seller />
            </Guard>
          }
        />
      </Routes>
      {publicPage && settings && <ContactBubbles settings={settings} />}
    </Ctx.Provider>
  );
}
