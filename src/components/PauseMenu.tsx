import { useEffect, useState } from 'react';
import { downloadWorldFile, pickWorldFile } from '@/game/storage';
import { Game } from '@/game/Game';

/** In-game pause menu: save/load world, install app, resume, quit. */

interface Props {
  game: Game;
  onResume: () => void;
  onQuit: () => void;
  username: string;
}

type InstallPromptEvent = Event & { prompt: () => void; userChoice: Promise<{ outcome: string }> };

export function PauseMenu({ game, onResume, onQuit, username }: Props) {
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as InstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const flash = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(null), 2500);
  };

  const saveWorld = () => {
    const json = game.exportSave();
    downloadWorldFile(json, `mcweb-world-${Date.now()}.json`);
    flash('World saved to your downloads.');
  };

  const loadWorld = async () => {
    const text = await pickWorldFile();
    if (!text) return;
    if (game.loadSave(text)) flash('World loaded!');
    else flash('That file is not a valid world save.');
  };

  const install = async () => {
    if (installEvent) {
      await installEvent.prompt();
      setInstallEvent(null);
    } else {
      flash('Use your browser menu > "Install app" / "Add to Home Screen".');
    }
  };

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-xs rounded-lg border-4 border-black/60 bg-stone-800/95 p-6">
        <h2 className="mb-1 text-center text-xl font-bold text-white">Game Paused</h2>
        <p className="mb-5 text-center text-xs text-stone-400">Playing as {username}</p>

        <div className="flex flex-col gap-2.5">
          <button
            className="rounded border-b-4 border-emerald-900 bg-emerald-600 py-2.5 font-bold text-white hover:bg-emerald-500 active:border-b-0 active:mt-0.5"
            onClick={onResume}
          >
            Resume Game
          </button>
          <button
            className="rounded border-b-4 border-stone-900 bg-stone-600 py-2.5 font-bold text-white hover:bg-stone-500 active:border-b-0 active:mt-0.5"
            onClick={saveWorld}
          >
            Save & Download World
          </button>
          <button
            className="rounded border-b-4 border-stone-900 bg-stone-600 py-2.5 font-bold text-white hover:bg-stone-500 active:border-b-0 active:mt-0.5"
            onClick={loadWorld}
          >
            Load World
          </button>
          <button
            className="rounded border-b-4 border-sky-900 bg-sky-600 py-2.5 font-bold text-white hover:bg-sky-500 active:border-b-0 active:mt-0.5"
            onClick={install}
          >
            Install App
          </button>
          <button
            className="rounded border-b-4 border-red-900 bg-red-700 py-2.5 font-bold text-white hover:bg-red-600 active:border-b-0 active:mt-0.5"
            onClick={onQuit}
          >
            Quit to Title
          </button>
        </div>
        {message && <p className="mt-4 rounded bg-black/50 px-3 py-2 text-center text-xs text-emerald-300">{message}</p>}
      </div>
    </div>
  );
}
