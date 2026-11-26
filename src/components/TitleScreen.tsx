import { useState } from 'react';
import { UserProfile, endSession, logIn, signUp } from '@/game/storage';
import { tap } from '@/hooks/tap';

/** Minecraft-styled title screen with login / signup / guest modes. */

interface Props {
  onPlay: (profile: UserProfile) => void;
}

export function TitleScreen({ onPlay }: Props) {
  const [mode, setMode] = useState<'buttons' | 'login' | 'signup'>('buttons');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (mode === 'signup') {
      const res = await signUp(username, password);
      if (!res.ok) return setError(res.error ?? 'Sign up failed');
      onPlay({ username: username.trim(), guest: false, skin: 'steve', createdAt: Date.now() });
    } else if (mode === 'login') {
      const res = await logIn(username, password);
      if (!res.ok) return setError(res.error ?? 'Login failed');
      onPlay({ username: username.trim(), guest: false, skin: 'steve', createdAt: Date.now() });
    }
  };

  const guest = () =>
    onPlay({ username: `Guest${Math.floor(1000 + Math.random() * 9000)}`, guest: true, skin: 'steve', createdAt: Date.now() });

  const submitTap = tap(() => void submit());
  const guestTap = tap(guest);
  const loginTab = tap(() => setMode('login'));
  const signupTap = tap(() => setMode('signup'));
  const backTap = tap(() => setMode('buttons'));
  const clearTap = tap(() => endSession());

  const panel = (
    <div className="w-full max-w-sm rounded-lg border-4 border-black/60 bg-stone-800/90 p-6 shadow-2xl backdrop-blur">
      <h2 className="mb-4 text-center text-xl font-bold tracking-wide text-white">
        {mode === 'login' ? 'Log In' : 'Create Account'}
      </h2>
      <label className="mb-1 block text-xs font-bold uppercase text-stone-300">Username</label>
      <input
        className="game-buttons mb-3 w-full rounded border-2 border-black/50 bg-black/40 px-3 py-2 text-white outline-none focus:border-emerald-500"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        maxLength={20}
        placeholder="Steve"
      />
      <label className="mb-1 block text-xs font-bold uppercase text-stone-300">Password</label>
      <input
        className="game-buttons mb-3 w-full rounded border-2 border-black/50 bg-black/40 px-3 py-2 text-white outline-none focus:border-emerald-500"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        type="password"
        maxLength={40}
        placeholder="••••••"
        onKeyDown={(e) => e.key === 'Enter' && submit()}
      />
      {error && <p className="mb-3 rounded bg-red-900/70 px-3 py-2 text-sm text-red-200">{error}</p>}
      <button
        className="game-buttons mb-2 w-full rounded border-b-4 border-emerald-900 bg-emerald-600 py-2.5 font-bold text-white transition-colors hover:bg-emerald-500 active:border-b-0 active:mt-0.5"
        {...submitTap}
      >
        {mode === 'signup' ? 'Sign Up & Play' : 'Log In & Play'}
      </button>
      <button className="game-buttons w-full rounded py-2 text-sm text-stone-300 hover:text-white" {...backTap}>
        Back
      </button>
    </div>
  );

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-8 p-4">
      <div className="text-center">
        <h1 className="text-5xl font-black tracking-tight text-white sm:text-7xl" style={{ textShadow: '4px 4px 0 rgba(0,0,0,0.6)' }}>
          MINECRAFT
        </h1>
        <p className="mt-2 text-lg font-semibold text-yellow-300" style={{ textShadow: '2px 2px 0 rgba(0,0,0,0.6)' }}>
          Web Edition
        </p>
      </div>

      {mode === 'buttons' ? (
        <div className="flex w-full max-w-sm flex-col gap-3">
          <button
            className="game-buttons w-full rounded border-b-4 border-stone-900 bg-stone-600 py-3 font-bold text-white transition-colors hover:bg-stone-500 active:border-b-0 active:mt-0.5"
            {...loginTab}
          >
            Log In
          </button>
          <button
            className="game-buttons w-full rounded border-b-4 border-emerald-900 bg-emerald-600 py-3 font-bold text-white transition-colors hover:bg-emerald-500 active:border-b-0 active:mt-0.5"
            {...signupTap}
          >
            Sign Up
          </button>
          <button
            className="game-buttons w-full rounded border-b-4 border-sky-900 bg-sky-600 py-3 font-bold text-white transition-colors hover:bg-sky-500 active:border-b-0 active:mt-0.5"
            {...guestTap}
          >
            Play as Guest
          </button>
          <p className="mt-2 text-center text-xs text-stone-400">Profiles are saved on this device.</p>
        </div>
      ) : (
        panel
      )}

      <button className="game-buttons text-xs text-stone-400 underline hover:text-white" {...clearTap}>
        Clear session
      </button>
    </div>
  );
}
