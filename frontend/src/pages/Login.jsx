import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../App.jsx';

export default function Login() {
  const { login } = useApp();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    try {
      const user = await login(email, password);
      nav(user.role === 'admin' ? '/admin' : '/vendedor');
    } catch (e2) {
      setErr(e2.message);
    }
  };

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <h1>Acesso interno</h1>
        <p>Login do vendedor e do administrador</p>
        {err && <div className="err">{err}</div>}
        <div className="field" style={{ marginBottom: 12 }}>
          <label>E-mail</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field" style={{ marginBottom: 18 }}>
          <label>Senha</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <button className="btn" type="submit">Entrar</button>
      </form>
    </div>
  );
}
